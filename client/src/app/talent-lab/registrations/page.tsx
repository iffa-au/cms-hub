"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteData, getData } from "@/lib/fetch-util";
import { useAuth } from "@/providers/auth-context";
import PageShell from "@/components/page-shell";
import RecordList, { type Column } from "@/components/record-list";
import ConfirmDialog from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  downloadCsv,
  formatDate,
  requestError,
  type TalentLabRegistration,
} from "@/lib/talent-lab";

export default function TalentLabRegistrationsPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const isStaff = user?.role === "admin" || user?.role === "staff";
  const [list, setList] = useState<TalentLabRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TalentLabRegistration | null>(null);
  // Access requirements are fetched one record at a time, on request.
  const [access, setAccess] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getData<{ success: boolean; data: TalentLabRegistration[] }>(
        "/talent-lab/registrations",
      );
      setList(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      const { status, message } = requestError(e);
      setError(
        status === 404
          ? "Registrations aren't available yet. Deploy the latest backend so /talent-lab/registrations exists."
          : message || "Failed to load registrations",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && !isStaff) {
      router.replace("/");
      return;
    }
    if (isAuthenticated) void load();
  }, [isAuthenticated, isStaff, router, load]);

  if (isAuthenticated && !isStaff) return null;

  const showAccess = async (id: string) => {
    try {
      const res = await getData<{ success: boolean; data: TalentLabRegistration }>(
        `/talent-lab/registrations/${id}`,
      );
      setAccess((prev) => ({ ...prev, [id]: res.data.accessRequirements?.trim() || "None given" }));
    } catch (e) {
      toast.error(requestError(e).message || "Failed to load");
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteData(`/talent-lab/registrations/${id}`);
      toast.success("Registration deleted");
      await load();
    } catch (e) {
      toast.error(requestError(e).message || "Failed to delete");
    }
  };

  const optedIn = list.filter((r) => r.mailingList);

  const columns: Column<TalentLabRegistration>[] = [
    {
      key: "person",
      header: "Name",
      role: "title",
      cell: (r) => (
        <div className="min-w-0">
          <h3 className="truncate font-serif text-lg text-foreground">{r.fullName}</h3>
          <p className="truncate text-xs text-muted-foreground">
            <a href={`mailto:${r.email}`} className="text-primary underline-offset-4 hover:underline">
              {r.email}
            </a>{" "}
            · {r.state}
          </p>
          {access[r._id] && (
            <p className="mt-1 whitespace-pre-wrap text-xs text-foreground/80">Access needs: {access[r._id]}</p>
          )}
        </div>
      ),
    },
    {
      key: "discipline",
      header: "Discipline",
      cell: (r) => (
        <span className="text-foreground/80">
          {r.discipline} · {r.careerStage}
        </span>
      ),
    },
    {
      key: "programs",
      header: "Interested in",
      showFrom: "xl",
      cell: (r) => <span className="text-foreground/80">{r.programs.length ? r.programs.join(", ") : "—"}</span>,
    },
    { key: "mailing", header: "Mailing list", cell: (r) => <span>{r.mailingList ? "Yes" : "No"}</span> },
    {
      key: "received",
      header: "Received",
      cell: (r) => (
        <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
          {r.createdAt ? formatDate(r.createdAt) : "—"}
        </span>
      ),
    },
  ];

  return (
    <PageShell
      title="Talent Lab registrations"
      description="People who registered their interest from the public site. Only those who ticked the mailing list box may be added to it."
    >
      <div className="mb-6 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!optedIn.length}
          onClick={() =>
            downloadCsv("talent-lab-mailing-list.csv", [
              ["Name", "Email", "State", "Discipline", "Career stage", "Programs", "Registered"],
              ...optedIn.map((r) => [
                r.fullName,
                r.email,
                r.state,
                r.discipline,
                r.careerStage,
                r.programs.join("; "),
                r.createdAt ? formatDate(r.createdAt) : "",
              ]),
            ])
          }
        >
          {`Export mailing list (${optedIn.length})`}
        </Button>
      </div>

      <RecordList
        items={list}
        columns={columns}
        getKey={(r) => r._id}
        loading={loading}
        error={error}
        empty="No one has registered their interest yet."
        actions={(r) => (
          <>
            {!access[r._id] && (
              <Button variant="rowAction" size="inline" onClick={() => void showAccess(r._id)}>
                Access needs
              </Button>
            )}
            <Button variant="rowDanger" size="inline" onClick={() => setPendingDelete(r)}>
              Delete
            </Button>
          </>
        )}
      />

      {!loading && !error && list.length > 0 && (
        <p className="mt-8 border-t border-border pt-6 text-xs text-muted-foreground">
          {`Showing ${list.length} ${list.length === 1 ? "registration" : "registrations"}`}
        </p>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        tone="danger"
        title="Delete this registration?"
        description={
          <>
            <span className="text-foreground">{pendingDelete?.fullName}</span>&apos;s registration will be removed.
            This can&apos;t be undone.
          </>
        }
        confirmLabel="Delete registration"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const id = pendingDelete?._id;
          setPendingDelete(null);
          if (id) void remove(id);
        }}
      />
    </PageShell>
  );
}
