"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getData } from "@/lib/fetch-util";
import { Button } from "@/components/ui/button";

type SubmissionStatus = "SUBMITTED" | "APPROVED" | "REJECTED";

type SubmissionItem = {
  _id: string;
  title: string;
  status: SubmissionStatus;
  createdAt: string;
};

function StatusBadge({ status }: { status: SubmissionStatus }) {
  const styleMap: Record<SubmissionStatus, string> = {
    SUBMITTED:
      "bg-amber-600/15 text-amber-700 dark:text-amber-300 border border-amber-600/30",
    APPROVED:
      "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border border-emerald-600/30",
    REJECTED:
      "bg-rose-600/15 text-rose-700 dark:text-rose-300 border border-rose-600/30",
  };
  const labelMap: Record<SubmissionStatus, string> = {
    SUBMITTED: "Submitted",
    APPROVED: "Approved",
    REJECTED: "Rejected",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${styleMap[status]}`}
    >
      {labelMap[status]}
    </span>
  );
}

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

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-white text-3xl md:text-4xl font-black leading-tight tracking-tight">
            Your Submissions
          </h1>
          <p className="text-text-muted text-base md:text-lg font-normal leading-normal">
            Manage and track your film entries.
          </p>
        </div>
        <Button asChild>
          <Link href="/submissions/new">New Submission</Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-muted-foreground">
            You haven&apos;t submitted any films yet.
          </p>
          <div className="mt-4">
            <Button asChild>
              <Link href="/submissions/new">Create your first submission</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-12 px-6 py-3 text-[#bab29c] text-xs uppercase tracking-widest bg-surface-dark">
            <div className="col-span-6">Title</div>
            <div className="col-span-3">Status</div>
            <div className="col-span-3 text-right">Created</div>
          </div>
          {items.map((s) => (
            <div
              key={s._id}
              className="grid grid-cols-12 px-6 py-4 items-center"
            >
              <div className="col-span-6 min-w-0">
                <Link
                  href={`/submissions/${s._id}`}
                  className="text-white hover:underline font-medium truncate"
                >
                  {s.title}
                </Link>
              </div>
              <div className="col-span-3">
                <StatusBadge status={s.status} />
              </div>
              <div className="col-span-3 text-right text-sm text-muted-foreground">
                {new Date(s.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
