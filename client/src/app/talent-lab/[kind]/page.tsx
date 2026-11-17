"use client";

import { useCallback, useEffect, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { deleteData, getData, updateData } from "@/lib/fetch-util";
import { useAuth } from "@/providers/auth-context";
import PageShell from "@/components/page-shell";
import RecordList, { type Column } from "@/components/record-list";
import ConfirmDialog from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { requestError } from "@/lib/talent-lab";
import { CONTENT_KINDS, isContentKind, type ContentItem } from "@/lib/talent-lab-content";

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

/**
 * Talent Lab Events, Opportunities, Mentors or Programs: the list, in the order
 * the public site shows them. (Applications and Registrations have their own
 * static routes beside this one, which Next resolves first.)
 *
 * Archivable kinds (programs) get Current / Archived tabs. Hide is for drafts;
 * Archive is for past records kept for the record. Both keep it off the site.
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
  const [tab, setTab] = useState<"current" | "archived">("current");

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

  const archivable = config.archivable === true;
  const currentList = archivable ? list.filter((i) => i.isArchived !== true) : list;
  const archivedList = archivable ? list.filter((i) => i.isArchived === true) : [];
  const viewingArchive = archivable && tab === "archived";
  const showing = viewingArchive ? archivedList : currentList;

  /** Reorders the current list. Archived records keep their old position, unseen. */
  const move = async (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= currentList.length) return;
    const next = [...currentList];
    [next[index], next[target]] = [next[target], next[index]];
    setList([...next, ...archivedList]);
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

  /** Sends the record back with every field, as the update route validates the whole record. */
  const save = async (item: ContentItem, change: Partial<ContentItem>, success: string) => {
    setBusy(true);
    try {
      const { _id, order, archivedAt, ...fields } = item;
      void order;
      void archivedAt;
      await updateData(`/talent-lab/${config.kind}/${_id}`, { ...fields, ...change });
      toast.success(success);
      await load();
    } catch (e) {
      toast.error(requestError(e).message || "Couldn't update");
    } finally {
      setBusy(false);
    }
  };

  const togglePublished = (item: ContentItem) =>
    save(item, { isPublished: !item.isPublished }, item.isPublished ? "Hidden from the website" : "Shown on the website");

  const setArchived = (item: ContentItem, archived: boolean) =>
    save(
      item,
      { isArchived: archived },
      archived
        ? "Archived. It's off the website and listed under Archived."
        : item.isPublished
          ? "Restored to the website"
          : "Restored to Current. It's still set to Hidden: use Show to put it on the website.",
    );

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
      cell: (item) =>
        item.isArchived ? (
          <span className="text-muted-foreground">
            {item.archivedAt ? `Archived ${formatDate(item.archivedAt)}` : "Archived"}
          </span>
        ) : (
          <span className={item.isPublished ? "text-emerald-400" : "text-muted-foreground"}>
            {item.isPublished ? "Shown" : "Hidden"}
          </span>
        ),
    },
  ];

  const plural = config.plural.toLowerCase();
  const singular = config.singular.toLowerCase();

  return (
    <PageShell title={`Talent Lab ${plural}`} description={config.description}>
      <div className="mb-6 flex flex-wrap gap-3">
        <Button type="button" onClick={() => router.push(`/talent-lab/${config.kind}/new`)}>
          {`Add ${singular}`}
        </Button>
      </div>

      {archivable && (
        <div role="tablist" aria-label={`Current or archived ${plural}`} className="mb-6 flex flex-wrap gap-2">
          {(
            [
              { value: "current", label: "Current", n: currentList.length },
              { value: "archived", label: "Archived", n: archivedList.length },
            ] as const
          ).map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                tab === t.value
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {!loading && <span className="ml-2 font-mono text-xs tabular-nums opacity-70">{t.n}</span>}
            </button>
          ))}
        </div>
      )}

      <RecordList
        items={showing}
        columns={columns}
        getKey={(item) => item._id}
        loading={loading}
        error={error}
        empty={
          viewingArchive
            ? `No archived ${plural}. Archive a past ${singular} to take it off the website but keep it here for the record.`
            : `No ${plural} yet. Until there are, the website shows its built-in ${plural}.`
        }
        actions={(item) => {
          if (item.isArchived) {
            return (
              <>
                <Button variant="rowAction" size="inline" onClick={() => router.push(`/talent-lab/${config.kind}/${item._id}`)}>
                  Edit
                </Button>
                <Button variant="rowAction" size="inline" disabled={busy} onClick={() => void setArchived(item, false)}>
                  Restore
                </Button>
                <Button variant="rowDanger" size="inline" onClick={() => setPendingDelete(item)}>
                  Delete
                </Button>
              </>
            );
          }
          const index = currentList.findIndex((i) => i._id === item._id);
          return (
            <>
              <Button variant="rowAction" size="inline" disabled={busy || index === 0} onClick={() => void move(index, -1)} aria-label="Move up">
                ↑
              </Button>
              <Button
                variant="rowAction"
                size="inline"
                disabled={busy || index === currentList.length - 1}
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
              {archivable && (
                <Button variant="rowAction" size="inline" disabled={busy} onClick={() => void setArchived(item, true)}>
                  Archive
                </Button>
              )}
              <Button variant="rowDanger" size="inline" onClick={() => setPendingDelete(item)}>
                Delete
              </Button>
            </>
          );
        }}
      />

      {!loading && !error && showing.length > 0 && (
        <p className="mt-8 border-t border-border pt-6 text-xs text-muted-foreground">
          {viewingArchive
            ? `Archived ${plural} are past ones kept for the record. They don't appear on ${config.siteHref}. Restore puts one back on the Current list.`
            : `${showing.length} ${showing.length === 1 ? singular : plural}, shown on the website in this order. Hidden ones stay here but don't appear on ${config.siteHref}.${
                archivable ? " Use Hide for drafts and Archive for past ones." : ""
              }`}
        </p>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        tone="danger"
        title={`Delete this ${singular}?`}
        description={
          <>
            <span className="text-foreground">{String(pendingDelete?.[config.titleField] ?? "")}</span> will be removed
            from the CMS and the website for good. To take it off the website but keep it, use{" "}
            {archivable ? "Hide or Archive" : "Hide"} instead.
          </>
        }
        confirmLabel={`Delete ${singular}`}
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
