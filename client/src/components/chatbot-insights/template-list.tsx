"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import ConfirmDialog from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { deleteData, getData, patchData } from "@/lib/fetch-util";
import { requestError } from "@/lib/distribution-enquiry";
import { cn } from "@/lib/utils";
import type { ChatTemplate, TemplateDraft } from "@/lib/chatbot-insights";

/**
 * The "Fixed answers" tab: staff-approved replies the chatbot gives instantly,
 * without the AI. New ones usually start from a question ("Make fixed answer"
 * on the Report or All questions tab); this list is for checking and editing.
 */
export default function TemplateList({
  refreshKey,
  onEdit,
}: {
  /** Changes whenever a fixed answer was saved elsewhere, so the list reloads. */
  refreshKey: number;
  onEdit: (draft: TemplateDraft) => void;
}) {
  const [items, setItems] = useState<ChatTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ChatTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getData<{ success: boolean; data: ChatTemplate[] }>("/chatbot-templates");
      if (res?.success && Array.isArray(res.data)) setItems(res.data);
      else setError("Failed to load fixed answers");
    } catch (e) {
      setError(requestError(e).message || "Failed to load fixed answers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function toggle(t: ChatTemplate) {
    try {
      await patchData(`/chatbot-templates/${t._id}`, { active: !t.active });
      toast.success(t.active ? "Turned off: the chatbot won't use it" : "Turned on: the chatbot will use it");
      load();
    } catch (e) {
      toast.error(requestError(e).message || "Failed to update");
    }
  }

  async function remove() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteData(`/chatbot-templates/${pendingDelete._id}`);
      toast.success("Fixed answer deleted");
      setPendingDelete(null);
      load();
    } catch (e) {
      toast.error(requestError(e).message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-prose text-sm text-muted-foreground">
          The chatbot answers these instantly, with this exact wording and without using the AI quota, whenever
          a visitor asks one of them. Changes reach the chatbot within 5 minutes.
        </p>
        <Button onClick={() => onEdit({ question: "", phrasings: [], answer: "", active: true })}>
          <Plus aria-hidden /> New fixed answer
        </Button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-destructive/40 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading && items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          No fixed answers yet. On the Report tab, use &quot;Make fixed answer&quot; next to a frequently asked
          question.
        </p>
      ) : (
        <ul className="rounded-lg border border-border">
          {items.map((t) => (
            <li key={t._id} className="border-t border-border px-4 py-4 first:border-t-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{t.question}</p>
                  {t.phrasings.length > 0 && (
                    <p className="mt-0.5 text-xs text-muted-foreground">Also matches: {t.phrasings.join(" · ")}</p>
                  )}
                </div>
                <span
                  className={cn(
                    "shrink-0 self-start rounded-full border px-2 py-0.5 text-xs",
                    t.active
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {t.active ? "Active" : "Off"}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-line rounded-md bg-muted/40 px-3 py-2 text-sm text-foreground/80">
                {t.answer}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onEdit({ _id: t._id, question: t.question, phrasings: t.phrasings, answer: t.answer, active: t.active })
                  }
                >
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => toggle(t)}>
                  {t.active ? "Turn off" : "Turn on"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPendingDelete(t)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this fixed answer?"
        description={pendingDelete ? `"${pendingDelete.question}". The chatbot will go back to answering it with the AI.` : undefined}
        confirmLabel="Delete"
        tone="danger"
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}
