"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getData } from "@/lib/fetch-util";
import { Button } from "@/components/ui/button";
import PageShell from "@/components/page-shell";
import RecordList, { type Column } from "@/components/record-list";
import { StatusChip, type RecordStatus } from "@/components/status";

type SubmissionStatus = "SUBMITTED" | "APPROVED" | "REJECTED";

type SubmissionItem = {
  _id: string;
  title: string;
  status: SubmissionStatus;
  createdAt: string;
  releaseDate?: string;
};

const shortDate = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString("en-AU", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      })
    : "—";

export default function Dashboard() {
  const [items, setItems] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getData<{
          success: boolean;
          data: SubmissionItem[];
          message?: string;
        }>("/submissions/my/list");
        if (!mounted) return;
        if (res?.success) setItems(res.data || []);
        else setError(res?.message || "Failed to load submissions");
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.response?.data?.message || "Failed to load submissions");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const columns: Column<SubmissionItem>[] = [
    {
      key: "title",
      header: "Film",
      role: "title",
      cell: (s) =>
        // Editing closes once a film has been reviewed, so the title is only a
        // link while that's still possible.
        s.status === "SUBMITTED" ? (
          <Link
            href={`/submissions/${s._id}/edit`}
            className="font-serif text-lg text-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            {s.title}
          </Link>
        ) : (
          <span className="font-serif text-lg text-foreground/80">{s.title}</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      role: "cardHidden", // the card already shows a chip in its header
      cell: (s) => <StatusChip status={s.status as RecordStatus} />,
    },
    {
      key: "release",
      header: "Release date",
      cell: (s) => (
        <span className="text-muted-foreground">{shortDate(s.releaseDate)}</span>
      ),
    },
    {
      key: "submitted",
      header: "Submitted",
      align: "right",
      cell: (s) => (
        <span className="text-muted-foreground">{shortDate(s.createdAt)}</span>
      ),
    },
  ];

  return (
    <PageShell
      width="medium"
      title="Your submissions"
      description="Track your film entries and edit them while they're still awaiting review."
      actions={
        <Button asChild>
          <Link href="/submissions/new">New submission</Link>
        </Button>
      }
    >
      <RecordList
        items={items}
        columns={columns}
        getKey={(s) => s._id}
        getStatus={(s) => s.status as RecordStatus}
        loading={loading}
        error={error}
        empty={
          <div className="space-y-4">
            <p>You haven&apos;t entered a film yet.</p>
            <Button asChild>
              <Link href="/submissions/new">Create your first submission</Link>
            </Button>
          </div>
        }
      />
    </PageShell>
  );
}
