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

type Values = Record<string, string | boolean>;

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
          next[field.key] = field.type === "tags" ? (Array.isArray(raw) ? raw.join(", ") : "") : String(raw ?? "");
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
  const set = (key: string, value: string | boolean) => setValues((v) => ({ ...v, [key]: value }));

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
            <label htmlFor={field.key} className={labelClass}>
              {field.label}
            </label>
            {field.type === "textarea" ? (
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
