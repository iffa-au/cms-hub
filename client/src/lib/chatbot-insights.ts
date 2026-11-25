import { getData, patchData } from "@/lib/fetch-util";

/**
 * Shared bits for the CMS "Chatbot insights" page (app/admin/chatbot-insights
 * and components/chatbot-insights). Backend: backend/controllers/chatQuestion
 * and chatTemplate controllers.
 */

export type ChatStatus = "open" | "done" | "ignored";

export type ChatTemplate = {
  _id: string;
  question: string;
  phrasings: string[];
  answer: string;
  active: boolean;
  updatedAt: string;
};

/** What the editor dialog starts with: a new answer (maybe prefilled from a question) or an existing one. */
export type TemplateDraft = {
  _id?: string;
  question: string;
  phrasings: string[];
  answer: string;
  active: boolean;
};

export const SOURCE_LABEL: Record<string, string> = {
  ai: "AI",
  cache: "Cache",
  smalltalk: "Small talk",
  template: "Fixed answer",
};

/**
 * Marks every question asked this way (same normalized wording) as done,
 * ignored or open again. Returns how many were changed.
 */
export async function setQuestionStatus(normalized: string, status: ChatStatus): Promise<number> {
  const res = await patchData<{ success: boolean; updated: number }>("/chatbot-questions/status", {
    normalized,
    status,
  });
  return res?.updated ?? 0;
}

/** Downloads the questions matching `params` (newest 10,000) as a CSV file. */
export async function downloadQuestionsCsv(params: URLSearchParams) {
  const p = new URLSearchParams(params);
  p.set("format", "csv");
  p.delete("page");
  p.delete("limit");
  const csv = await getData<string>(`/chatbot-questions?${p}`);
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `chatbot-questions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
