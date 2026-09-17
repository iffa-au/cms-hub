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

type PopulatedRef = { _id: string; name: string };
type FilmEnquiryItem = {
  _id: string;
  name: string;
  email: string;
  role: string;
  title: string;
  synopsis: string;
  productionHouse: string;
  distributor?: string;
  releaseDate: string;
  contentType: PopulatedRef;
  genreIds?: PopulatedRef[] | { _id: string; name?: string }[];
  country: PopulatedRef;
  language: PopulatedRef;
  trailerUrl?: string;
  createdAt?: string;
};

export default function AdminFilmEnquiryPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [list, setList] = useState<FilmEnquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FilmEnquiryItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getData<{ success: boolean; data: FilmEnquiryItem[] }>(
        "/film-enquiries"
      );
      if (res?.success && Array.isArray(res.data)) {
        setList(res.data);
      } else {
        setError("Failed to load enquiries");
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message;
      if (status === 404) {
        setError(
          "Enquiry list not available. Deploy the latest backend so the /film-enquiries route exists."
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
        await deleteData(`/film-enquiries/${id}`);
        toast.success("Enquiry deleted");
        await load();
      } catch (e: any) {
        toast.error(e?.message || "Failed to delete enquiry");
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

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("en-AU", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };

  const columns: Column<FilmEnquiryItem>[] = [
    {
      key: "film",
      header: "Film",
      role: "title",
      cell: (item) => (
        <div className="min-w-0">
          <h3 className="truncate font-serif text-lg text-foreground">{item.title}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {item.name}{" "}
            <a
              href={`mailto:${item.email}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              {item.email}
            </a>
          </p>
          <p className="line-clamp-1 max-w-md text-xs text-muted-foreground">
            {item.synopsis || "\u2014"}
          </p>
        </div>
      ),
    },
    {
      key: "contentType",
      header: "Type",
      cell: (item) => (
        <span className="text-foreground/80">{item.contentType?.name ?? "\u2014"}</span>
      ),
    },
    {
      key: "release",
      header: "Release",
      align: "center",
      cell: (item) => (
        <span className="font-mono text-xs text-muted-foreground">
          {item.releaseDate ? formatDate(item.releaseDate) : "\u2014"}
        </span>
      ),
    },
    {
      key: "genres",
      header: "Genres",
      showFrom: "xl",
      cell: (item) => {
        const genres = Array.isArray(item.genreIds) ? item.genreIds : [];
        if (!genres.length)
          return <span className="text-muted-foreground">\u2014</span>;
        return (
          <div className="flex flex-wrap gap-1.5">
            {genres.map((g, i) => (
              <span
                key={typeof g === "object" && g && "_id" in g ? (g as any)._id : i}
                className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
              >
                {typeof g === "object" && g && "name" in g ? (g as any).name : "\u2014"}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: "submitted",
      header: "Received",
      cell: (item) => (
        <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
          {item.createdAt ? formatDate(item.createdAt) : "\u2014"}
        </span>
      ),
    },
  ];

  return (
    <PageShell
      title="Film enquiries"
      description="Enquiries submitted from the public site. Send the submission link once an enquiry is approved."
    >
      <RecordList
        items={list}
        columns={columns}
        getKey={(item) => item._id}
        loading={loading}
        error={error}
        empty="No enquiries have come in yet."
        actions={(item) => (
          <>
            <Button
              variant="rowAction"
              size="inline"
              onClick={() => router.push(`/admin/film-enquiry/${item._id}`)}
            >
              Open
            </Button>
            <Button
              variant="rowDanger"
              size="inline"
              onClick={() => setPendingDelete(item)}
            >
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
