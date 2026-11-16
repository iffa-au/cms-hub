"use client";

import { useCallback, useEffect, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { deleteData, getData, updateData } from "@/lib/fetch-util";
import { useAuth } from "@/providers/auth-context";
import PageShell from "@/components/page-shell";
import RecordList, { type Column } from "@/components/record-list";
import ConfirmDialog from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { requestError } from "@/lib/talent-lab";
import { CONTENT_KINDS, isContentKind, type ContentItem } from "@/lib/talent-lab-content";

/**
 * Talent Lab Events, Opportunities or Mentors: the list, in the order the
 * public site shows them. (Applications and Registrations have their own
 * static routes beside this one, which Next resolves first.)
 */
export default function TalentLabContentListPage() {
  const params = useParams<{ kind: string }>();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const isStaff = user?.role === "admin" || user?.role === "staff";
  const config = isContentKind(params.kind) ? CONTENT_KINDS[params.kind] : null;

  const [list, setList] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ContentItem | null>(null);

  const load = useCallback(async () => {
    if (!config) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getData<{ success: boolean; data: ContentItem[] }>(`/talent-lab/${config.kind}/manage`);
      setList(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      const { status, message } = requestError(e);
      setError(
        status === 404
          ? `${config.plural} aren't available yet. Deploy the latest backend.`
          : message || `Failed to load ${config.plural.toLowerCase()}`,
      );
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    if (isAuthenticated && !isStaff) {
      router.replace("/");
      return;
    }
    if (isAuthenticated) void load();
  }, [isAuthenticated, isStaff, router, load]);

  if (!config) notFound();
  if (isAuthenticated && !isStaff) return null;

  const move = async (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    setList(next);
    setBusy(true);
    try {
      await updateData(`/talent-lab/${config.kind}/order`, { ids: next.map((i) => i._id) });
    } catch (e) {
      toast.error(requestError(e).message || "Couldn't save the new order");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const togglePublished = async (item: ContentItem) => {
    setBusy(true);
    try {
      const { _id, order, ...fields } = item;
      void order;
      await updateData(`/talent-lab/${config.kind}/${_id}`, { ...fields, isPublished: !item.isPublished });
      toast.success(item.isPublished ? "Hidden from the website" : "Shown on the website");
      await load();
    } catch (e) {
      toast.error(requestError(e).message || "Couldn't update");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteData(`/talent-lab/${config.kind}/${id}`);
      toast.success(`${config.singular} deleted`);
      await load();
    } catch (e) {
      toast.error(requestError(e).message || "Couldn't delete");
    }
  };

  const columns: Column<ContentItem>[] = [
    {
      key: "title",
      header: config.singular,
      role: "title",
      cell: (item) => (
        <div className="min-w-0">
          <h3 className="truncate font-serif text-lg text-foreground">{String(item[config.titleField] ?? "")}</h3>
          <p className="truncate text-xs text-muted-foreground">{config.subtitle(item)}</p>
        </div>
      ),
    },
    {
      key: "published",
      header: "On website",
      cell: (item) => (
        <span className={item.isPublished ? "text-emerald-400" : "text-muted-foreground"}>
          {item.isPublished ? "Shown" : "Hidden"}
        </span>
      ),
    },
  ];

  return (
    <PageShell title={`Talent Lab ${config.plural.toLowerCase()}`} description={config.description}>
      <div className="mb-6 flex flex-wrap gap-3">
        <Button type="button" onClick={() => router.push(`/talent-lab/${config.kind}/new`)}>
          {`Add ${config.singular.toLowerCase()}`}
        </Button>
      </div>

      <RecordList
        items={list}
        columns={columns}
        getKey={(item) => item._id}
        loading={loading}
        error={error}
        empty={`No ${config.plural.toLowerCase()} yet. Until there are, the website shows its built-in ${config.plural.toLowerCase()}.`}
        actions={(item) => {
          const index = list.findIndex((i) => i._id === item._id);
          return (
            <>
              <Button variant="rowAction" size="inline" disabled={busy || index === 0} onClick={() => void move(index, -1)} aria-label="Move up">
                ↑
              </Button>
              <Button
                variant="rowAction"
                size="inline"
                disabled={busy || index === list.length - 1}
                onClick={() => void move(index, 1)}
                aria-label="Move down"
              >
                ↓
              </Button>
              <Button variant="rowAction" size="inline" onClick={() => router.push(`/talent-lab/${config.kind}/${item._id}`)}>
                Edit
              </Button>
              <Button variant="rowAction" size="inline" disabled={busy} onClick={() => void togglePublished(item)}>
                {item.isPublished ? "Hide" : "Show"}
              </Button>
              <Button variant="rowDanger" size="inline" onClick={() => setPendingDelete(item)}>
                Delete
              </Button>
            </>
          );
        }}
      />

      {!loading && !error && list.length > 0 && (
        <p className="mt-8 border-t border-border pt-6 text-xs text-muted-foreground">
          {`${list.length} ${list.length === 1 ? config.singular.toLowerCase() : config.plural.toLowerCase()}, shown on the website in this order. Hidden ones stay here but don't appear on ${config.siteHref}.`}
        </p>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        tone="danger"
        title={`Delete this ${config.singular.toLowerCase()}?`}
        description={
          <>
            <span className="text-foreground">{String(pendingDelete?.[config.titleField] ?? "")}</span> will be removed
            from the CMS and the website. To take it off the website but keep it, use Hide instead.
          </>
        }
        confirmLabel={`Delete ${config.singular.toLowerCase()}`}
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
