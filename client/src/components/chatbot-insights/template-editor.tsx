"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { inputClass, labelClass, textareaClass } from "@/components/form-section";
import { patchData, postData } from "@/lib/fetch-util";
import { requestError } from "@/lib/distribution-enquiry";
import type { TemplateDraft } from "@/lib/chatbot-insights";

/**
 * Create or edit one fixed answer. Opened from "Fixed answers", or from a
 * question ("Make fixed answer") with the question and the bot's last answer
 * filled in, so staff only have to check and tidy the wording.
 *
 * The chatbot picks changes up within 5 minutes.
 */
export default function TemplateEditor({
  draft,
  onClose,
  onSaved,
}: {
  draft: TemplateDraft | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [phrasings, setPhrasings] = useState("");
  const [answer, setAnswer] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!draft) return;
    setQuestion(draft.question);
    setPhrasings(draft.phrasings.join("\n"));
    setAnswer(draft.answer);
    setActive(draft.active);
  }, [draft]);

  useEffect(() => {
    if (!draft) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !saving && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [draft, saving, onClose]);

  if (!draft) return null;

  async function save() {
    const body = {
      question: question.trim(),
      phrasings: phrasings
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean),
      answer: answer.trim(),
      active,
    };
    setSaving(true);
    try {
      if (draft?._id) await patchData(`/chatbot-templates/${draft._id}`, body);
      else await postData("/chatbot-templates", body);
      toast.success(draft?._id ? "Fixed answer updated" : "Fixed answer created");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(requestError(e).message || "Failed to save the fixed answer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={() => !saving && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-editor-title"
        className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-lg border border-border bg-surface-overlay p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="template-editor-title" className="text-base font-semibold">
          {draft._id ? "Edit fixed answer" : "New fixed answer"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Whenever a visitor asks this question, the chatbot replies with this answer instantly, without the
          AI. Changes reach the chatbot within 5 minutes.
        </p>

        <div className="mt-5 space-y-4">
          <label className="block space-y-1.5">
            <span className={labelClass}>Question</span>
            <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} className={inputClass} />
            <span className="block text-xs text-muted-foreground">
              Write it so it makes sense on its own, e.g. &quot;Is there parking at the venue?&quot; rather than
              &quot;what about parking?&quot;, and avoid single words: it is matched in the middle of chats too.
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className={labelClass}>Other ways visitors ask it (one per line, optional)</span>
            <textarea
              value={phrasings}
              onChange={(e) => setPhrasings(e.target.value)}
              rows={3}
              placeholder={"how to submit a film\nwhere do i send my film"}
              className={textareaClass}
            />
            <span className="block text-xs text-muted-foreground">
              Matching ignores capital letters and punctuation, so &quot;How do I submit my film?&quot; already
              covers &quot;how do i submit my film&quot;.
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className={labelClass}>Answer</span>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={6}
              maxLength={3000}
              className={textareaClass}
            />
            <span className="block text-xs text-muted-foreground">
              Links work like this: [Submit Film Enquiry](/submit-film-enquiry). Use site pages only.
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active (the chatbot uses it)
          </label>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || question.trim().length < 3 || answer.trim().length < 3}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
