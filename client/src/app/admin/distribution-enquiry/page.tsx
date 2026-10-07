"use client";

import { useCallback, useEffect, useState } from "react";
import { getData, deleteData } from "@/lib/fetch-util";
import { useAuth } from "@/providers/auth-context";
import { useRouter } from "next/navigation";
import PageShell from "@/components/page-shell";
import RecordList, { type Column } from "@/components/record-list";
import ConfirmDialog from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  RIGHTS_LABELS,
  TERRITORY_LABELS,
  formatDate,
  labelsOf,
  requestError,
  type DistributionEnquiryItem,
} from "@/lib/distribution-enquiry";

function Chips({ values }: { values: string[] }) {
  if (!values.length) return <span className="text-muted-foreground">{"—"}</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v) => (
        <span
          key={v}
          className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
        >
          {v}
        </span>
      ))}
    </div>
  );
}

export default function AdminDistributionEnquiryPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [list, setList] = useState<DistributionEnquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DistributionEnquiryItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getData<{ success: boolean; data: DistributionEnquiryItem[] }>(
        "/distribution-enquiries"
      );
      if (res?.success && Array.isArray(res.data)) {
        setList(res.data);
      } else {
        setError("Failed to load enquiries");
      }
    } catch (e) {
      const { status, message: msg } = requestError(e);
      if (status === 404) {
        setError(
          "Enquiry list not available. Deploy the latest backend so the /distribution-enquiries route exists."
        );
      } else {
        setError(msg || "Failed to load enquiries");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteData(`/distribution-enquiries/${id}`);
        toast.success("Enquiry deleted");
        await load();
      } catch (e) {
        toast.error(requestError(e).message || "Failed to delete enquiry");
      }
    },
    [load]
  );

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") {
      router.replace("/");
      return;
    }
    load();
  }, [isAuthenticated, user?.role, router, load]);

  if (!isAuthenticated || user?.role !== "admin") return null;

  const columns: Column<DistributionEnquiryItem>[] = [
    {
      key: "film",
      header: "Film",
      role: "title",
      cell: (item) => (
        <div className="min-w-0">
          <h3 className="truncate font-serif text-lg text-foreground">{item.title}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {item.name}
            {item.company ? ` · ${item.company}` : ""}{" "}
            <a
              href={`mailto:${item.email}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              {item.email}
            </a>
          </p>
        </div>
      ),
    },
    {
      key: "contentType",
      header: "Type",
      cell: (item) => (
        <span className="text-foreground/80">{item.contentType?.name ?? "—"}</span>
      ),
    },
    {
      key: "rights",
      header: "Rights",
      showFrom: "xl",
      cell: (item) => <Chips values={labelsOf(RIGHTS_LABELS, item.rights)} />,
    },
    {
      key: "territories",
      header: "Territories",
      showFrom: "xl",
      cell: (item) => <Chips values={labelsOf(TERRITORY_LABELS, item.territories)} />,
    },
    {
      key: "received",
      header: "Received",
      cell: (item) => (
        <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
          {item.createdAt ? formatDate(item.createdAt) : "—"}
        </span>
      ),
    },
  ];

  return (
    <PageShell
      title="Distribution enquiries"
      description="Filmmakers and rights holders looking for distribution, submitted from the public site."
    >
      <RecordList
        items={list}
        columns={columns}
        getKey={(item) => item._id}
        loading={loading}
        error={error}
        empty="No distribution enquiries have come in yet."
        actions={(item) => (
          <>
            <Button
              variant="rowAction"
              size="inline"
              onClick={() => router.push(`/admin/distribution-enquiry/${item._id}`)}
            >
              Open
            </Button>
            <Button variant="rowDanger" size="inline" onClick={() => setPendingDelete(item)}>
              Delete
            </Button>
          </>
        )}
      />

      {!loading && !error && list.length > 0 && (
        <p className="mt-8 border-t border-border pt-6 text-xs text-muted-foreground">
          {`Showing ${list.length} ${list.length === 1 ? "enquiry" : "enquiries"}`}
        </p>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        tone="danger"
        title="Delete this enquiry?"
        description={
          <>
            <span className="text-foreground">{pendingDelete?.title}</span> from{" "}
            {pendingDelete?.name} will be removed. This can&apos;t be undone.
          </>
        }
        confirmLabel="Delete enquiry"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const id = pendingDelete?._id;
          setPendingDelete(null);
          if (id) void handleDelete(id);
        }}
      />
    </PageShell>
  );
}
