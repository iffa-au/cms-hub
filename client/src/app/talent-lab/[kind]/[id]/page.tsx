"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { getData, postData, updateData } from "@/lib/fetch-util";
import { useAuth } from "@/providers/auth-context";
import { inputClass, labelClass, textareaClass } from "@/components/form-section";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { requestError } from "@/lib/talent-lab";
import { CONTENT_KINDS, isContentKind, type ContentItem } from "@/lib/talent-lab-content";

type Values = Record<string, unknown>;
type Row = Record<string, string>;
type RefOption = { key: string; label: string };

const smallButton =
  "text-xs font-semibold text-primary underline-offset-4 hover:underline disabled:opacity-40 disabled:no-underline";

/** Edit one Event, Opportunity or Mentor; `/talent-lab/<kind>/new` creates one. */
export default function TalentLabContentEditPage() {
  const params = useParams<{ kind: string; id: string }>();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const isStaff = user?.role === "admin" || user?.role === "staff";
  const config = isContentKind(params.kind) ? CONTENT_KINDS[params.kind] : null;
  const isNew = params.id === "new";

  const [values, setValues] = useState<Values>({ isPublished: true });
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refOptions, setRefOptions] = useState<Record<string, RefOption[]>>({});

  // Choices for "refs" fields (a program's mentors), loaded from that kind's CMS list.
  useEffect(() => {
    if (!config || !isAuthenticated || !isStaff) return;
    let alive = true;
    for (const field of config.fields) {
      if (field.type !== "refs" || !field.refKind) continue;
      const ref = CONTENT_KINDS[field.refKind];
      (async () => {
        try {
          const res = await getData<{ data: ContentItem[] }>(`/talent-lab/${ref.kind}/manage`);
          const options = (res.data ?? []).map((item) => ({
            key: String(item[ref.keyField] ?? ""),
            label: `${String(item[ref.titleField] ?? "")}${item.isPublished ? "" : " (hidden)"}`,
          }));
          if (alive) setRefOptions((o) => ({ ...o, [field.key]: options }));
        } catch {
          if (alive) setRefOptions((o) => ({ ...o, [field.key]: [] }));
        }
      })();
    }
    return () => {
      alive = false;
    };
  }, [config, isAuthenticated, isStaff]);

  useEffect(() => {
    if (isAuthenticated && !isStaff) {
      router.replace("/");
      return;
    }
    if (!config || isNew || !isAuthenticated) return;
    let alive = true;
    (async () => {
      try {
        const res = await getData<{ success: boolean; data: ContentItem }>(`/talent-lab/${config.kind}/manage/${params.id}`);
        if (!alive) return;
        const next: Values = { isPublished: res.data.isPublished };
        next[config.keyField] = String(res.data[config.keyField] ?? "");
        for (const field of config.fields) {
          const raw = res.data[field.key];
          if (field.type === "tags") next[field.key] = Array.isArray(raw) ? raw.join(", ") : "";
          else if (field.type === "paragraphs" || field.type === "refs") next[field.key] = Array.isArray(raw) ? raw.map(String) : [];
          else if (field.type === "rows") next[field.key] = Array.isArray(raw) ? (raw as Row[]).map((r) => ({ ...r })) : [];
          else next[field.key] = String(raw ?? "");
        }
        setValues(next);
      } catch (e) {
        if (alive) setError(requestError(e).message || "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [config, isNew, params.id, isAuthenticated, isStaff, router]);

  if (!config) notFound();
  if (isAuthenticated && !isStaff) return null;

  const listHref = `/talent-lab/${config.kind}`;
  const set = (key: string, value: unknown) => setValues((v) => ({ ...v, [key]: value }));
  const listOf = <T,>(key: string) => (Array.isArray(values[key]) ? (values[key] as T[]) : []);
  const move = <T,>(list: T[], from: number, to: number) => {
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: Record<string, unknown> = { ...values };
    for (const field of config.fields) {
      if (field.type === "tags") {
        payload[field.key] = String(values[field.key] ?? "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      }
    }
    try {
      if (isNew) {
        await postData(`/talent-lab/${config.kind}`, payload);
        toast.success(`${config.singular} added`);
      } else {
        await updateData(`/talent-lab/${config.kind}/${params.id}`, payload);
        toast.success(`${config.singular} saved`);
      }
      router.push(listHref);
    } catch (err) {
      setError(requestError(err).message || "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/3 rounded bg-border" />
          <div className="h-4 w-full rounded bg-border" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <Link href={listHref} className="mb-4 inline-block text-xs font-bold tracking-widest text-primary hover:underline">
        {`← BACK TO ${config.plural.toUpperCase()}`}
      </Link>
      <h1 className="mt-2 mb-8 font-serif text-3xl text-white md:text-4xl">
        {isNew ? `New ${config.singular.toLowerCase()}` : `Edit ${config.singular.toLowerCase()}`}
      </h1>

      <form onSubmit={save} className="space-y-6 rounded-lg border border-border bg-card/60 p-6">
        <div className="space-y-2">
          <label htmlFor={config.keyField} className={labelClass}>
            {config.keyField === "slug" ? "Slug" : "Id"}
          </label>
          <input
            id={config.keyField}
            className={inputClass}
            value={String(values[config.keyField] ?? "")}
            onChange={(e) => set(config.keyField, e.target.value.toLowerCase())}
            required
          />
          <p className="text-xs text-muted-foreground">{config.keyHelp}</p>
        </div>

        {config.fields.map((field) => (
          <div key={field.key} className="space-y-2">
            <label htmlFor={["paragraphs", "rows", "refs"].includes(field.type) ? undefined : field.key} className={labelClass}>
              {field.label}
            </label>
            {field.type === "paragraphs" ? (
              <div className="space-y-3">
                {listOf<string>(field.key).map((para, i, list) => (
                  <div key={i} className="space-y-1">
                    <textarea
                      aria-label={`${field.label} paragraph ${i + 1}`}
                      className={textareaClass}
                      rows={4}
                      value={para}
                      onChange={(e) => set(field.key, list.map((p, j) => (j === i ? e.target.value : p)))}
                    />
                    <div className="flex gap-4">
                      <button type="button" className={smallButton} disabled={i === 0} onClick={() => set(field.key, move(list, i, i - 1))}>
                        Move up
                      </button>
                      <button type="button" className={smallButton} disabled={i === list.length - 1} onClick={() => set(field.key, move(list, i, i + 1))}>
                        Move down
                      </button>
                      <button type="button" className={`${smallButton} text-status-rejected`} onClick={() => set(field.key, list.filter((_, j) => j !== i))}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => set(field.key, [...listOf<string>(field.key), ""])}>
                  {field.addLabel ?? "Add"}
                </Button>
              </div>
            ) : field.type === "rows" ? (
              <div className="space-y-3">
                {listOf<Row>(field.key).map((row, i, list) => (
                  <div key={i} className="space-y-3 rounded-md border border-border p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {field.columns?.map((col) => {
                        const update = (value: string) =>
                          set(field.key, list.map((r, j) => (j === i ? { ...r, [col.key]: value } : r)));
                        return (
                          <div key={col.key} className={col.multiline ? "sm:col-span-2" : undefined}>
                            <label className={labelClass}>{col.label}</label>
                            {col.multiline ? (
                              <textarea
                                className={textareaClass}
                                rows={3}
                                value={row[col.key] ?? ""}
                                onChange={(e) => update(e.target.value)}
                              />
                            ) : (
                              <input
                                className={inputClass}
                                placeholder={col.placeholder}
                                value={row[col.key] ?? ""}
                                onChange={(e) => update(e.target.value)}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-4">
                      <button type="button" className={smallButton} disabled={i === 0} onClick={() => set(field.key, move(list, i, i - 1))}>
                        Move up
                      </button>
                      <button type="button" className={smallButton} disabled={i === list.length - 1} onClick={() => set(field.key, move(list, i, i + 1))}>
                        Move down
                      </button>
                      <button type="button" className={`${smallButton} text-status-rejected`} onClick={() => set(field.key, list.filter((_, j) => j !== i))}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    set(field.key, [
                      ...listOf<Row>(field.key),
                      Object.fromEntries((field.columns ?? []).map((c) => [c.key, ""])),
                    ])
                  }
                >
                  {field.addLabel ?? "Add row"}
                </Button>
              </div>
            ) : field.type === "refs" ? (
              (() => {
                const chosen = listOf<string>(field.key);
                const options = refOptions[field.key];
                if (options === undefined) return <p className="text-sm text-muted-foreground">Loading…</p>;
                // Keep chosen keys that no longer match a record visible, so saving never drops them silently.
                const all = [
                  ...options,
                  ...chosen.filter((k) => !options.some((o) => o.key === k)).map((k) => ({ key: k, label: `${k} (not found)` })),
                ];
                if (!all.length) {
                  return <p className="text-sm text-muted-foreground">Nothing to choose from yet.</p>;
                }
                return (
                  <div className="grid grid-cols-1 gap-2 rounded-md border border-border p-4 sm:grid-cols-2">
                    {all.map((o) => (
                      <label key={o.key} className="flex items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={chosen.includes(o.key)}
                          onChange={(e) =>
                            set(field.key, e.target.checked ? [...chosen, o.key] : chosen.filter((k) => k !== o.key))
                          }
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                );
              })()
            ) : field.type === "textarea" ? (
              <textarea
                id={field.key}
                className={textareaClass}
                rows={5}
                value={String(values[field.key] ?? "")}
                onChange={(e) => set(field.key, e.target.value)}
              />
            ) : field.type === "select" ? (
              <select
                id={field.key}
                className={inputClass}
                value={String(values[field.key] ?? "")}
                onChange={(e) => set(field.key, e.target.value)}
              >
                <option value="">Choose…</option>
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {field.optionLabels?.[option] ?? option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={field.key}
                className={inputClass}
                type={field.type === "url" ? "url" : "text"}
                placeholder={field.placeholder}
                value={String(values[field.key] ?? "")}
                onChange={(e) => set(field.key, e.target.value)}
              />
            )}
            {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
          </div>
        ))}

        <label className="flex items-center gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            checked={values.isPublished === true}
            onChange={(e) => set("isPublished", e.target.checked)}
          />
          Show on the website
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : isNew ? `Add ${config.singular.toLowerCase()}` : "Save changes"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push(listHref)}>
            Cancel
          </Button>
        </div>
      </form>
    </main>
  );
}
