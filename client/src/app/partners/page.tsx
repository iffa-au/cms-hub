"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-context";
import { getData, postData, updateData, deleteData } from "@/lib/fetch-util";
import PartnerLogoUpload from "@/components/partners/partner-logo-upload";
import { Pencil, Trash2, Plus, X } from "lucide-react";

const TIERS = [
  { value: "PRESENTING", label: "Presenting Partner" },
  { value: "CULTURAL", label: "Cultural Partner" },
  { value: "SUPPORTING", label: "Supporting Partner" },
] as const;

type Tier = (typeof TIERS)[number]["value"];

type Partner = {
  _id: string;
  name: string;
  logoUrl: string;
  websiteUrl?: string;
  tier: Tier;
  order?: number;
  isActive?: boolean;
};

type ListResponse = { success: boolean; data: Partner[]; message?: string };

type FormState = {
  name: string;
  logoUrl: string;
  websiteUrl: string;
  tier: Tier;
  order: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  name: "",
  logoUrl: "",
  websiteUrl: "",
  tier: "SUPPORTING",
  order: "0",
  isActive: true,
};

const tierLabel = (tier: Tier) => TIERS.find((t) => t.value === tier)?.label ?? tier;

const errorMessage = (e: unknown, fallback: string) =>
  e instanceof Error && e.message ? e.message : fallback;

export default function PartnersAdminPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user?.role !== "admin" && user?.role !== "staff") {
      router.replace("/");
    }
  }, [isAuthenticated, user, router]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getData<ListResponse>("/partners/manage");
      setPartners(res?.data ?? []);
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to load partners"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    return TIERS.map((tier) => ({
      ...tier,
      items: partners.filter((p) => p.tier === tier.value),
    }));
  }, [partners]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormOpen(false);
  };

  const startCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormOpen(true);
    setSuccess(null);
  };

  const startEdit = (partner: Partner) => {
    setForm({
      name: partner.name,
      logoUrl: partner.logoUrl,
      websiteUrl: partner.websiteUrl ?? "",
      tier: partner.tier,
      order: String(partner.order ?? 0),
      isActive: partner.isActive !== false,
    });
    setEditingId(partner._id);
    setFormOpen(true);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    if (!form.logoUrl.trim()) {
      setError("Please upload a logo");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const payload = {
        name: form.name.trim(),
        logoUrl: form.logoUrl.trim(),
        websiteUrl: form.websiteUrl.trim(),
        tier: form.tier,
        order: Number(form.order) || 0,
        isActive: form.isActive,
      };

      if (editingId) {
        await updateData(`/partners/${editingId}`, payload);
        setSuccess("Partner updated.");
      } else {
        await postData("/partners", payload);
        setSuccess("Partner added.");
      }

      resetForm();
      await load();
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to save partner"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (partner: Partner) => {
    if (!window.confirm(`Remove "${partner.name}" from the partners page?`)) return;
    try {
      setError(null);
      await deleteData(`/partners/${partner._id}`);
      setSuccess("Partner removed.");
      await load();
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to delete partner"));
    }
  };

  if (!isAuthenticated) return null;
  if (isAuthenticated && user?.role !== "admin" && user?.role !== "staff") return null;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="mb-2 font-serif text-3xl text-white md:text-4xl">Partners</h1>
          <p className="text-sm text-accent-foreground">
            Manage the logos shown on the public Partner With Us page. Partners appear
            grouped by tier, ordered by the position set below.
          </p>
        </div>
        <button
          onClick={startCreate}
          className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-xs font-bold tracking-widest text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus size={14} /> ADD PARTNER
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm text-red-400">
          {error}
        </p>
      )}
      {success && (
        <p className="mb-4 rounded border border-green-400/30 bg-green-400/10 px-4 py-2 text-sm text-green-400">
          {success}
        </p>
      )}

      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="mb-10 space-y-4 rounded-lg border border-border bg-card/60 p-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {editingId ? "Edit partner" : "New partner"}
            </h2>
            <button
              type="button"
              onClick={resetForm}
              className="text-muted-foreground hover:text-primary"
              aria-label="Close form"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground" htmlFor="partner-name">
                Name *
              </label>
              <input
                id="partner-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground"
                placeholder="e.g. Oman Film Society"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground" htmlFor="partner-website">
                Website URL
              </label>
              <input
                id="partner-website"
                value={form.websiteUrl}
                onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                className="w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground"
                placeholder="https://example.com"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground" htmlFor="partner-tier">
                Tier *
              </label>
              <select
                id="partner-tier"
                value={form.tier}
                onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value as Tier }))}
                className="w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                {TIERS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground" htmlFor="partner-order">
                Order within tier
              </label>
              <input
                id="partner-order"
                type="number"
                value={form.order}
                onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
                className="w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-muted-foreground">Logo *</label>
              <PartnerLogoUpload
                value={form.logoUrl}
                onChange={(logoUrl) => setForm((f) => ({ ...f, logoUrl }))}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground md:col-span-2">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              Show on the public website
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-foreground px-6 py-2.5 text-xs font-bold tracking-widest text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "SAVING..." : editingId ? "SAVE CHANGES" : "ADD PARTNER"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded border border-border px-6 py-2.5 text-xs font-bold tracking-widest text-muted-foreground hover:border-primary hover:text-primary"
            >
              CANCEL
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="h-20 animate-pulse rounded bg-card/60" />
          <div className="h-20 animate-pulse rounded bg-card/60" />
        </div>
      ) : partners.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No partners yet. Use “Add Partner” to create the first one.
        </p>
      ) : (
        <div className="space-y-10">
          {grouped.map((group) => (
            <section key={group.value}>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                {group.label} ({group.items.length})
              </h2>
              {group.items.length === 0 ? (
                <p className="text-xs text-muted-foreground/70">None in this tier.</p>
              ) : (
                <div className="space-y-2">
                  {group.items.map((partner) => (
                    <div
                      key={partner._id}
                      className="flex items-center gap-4 rounded border border-border bg-card/60 p-3"
                    >
                      <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded bg-black/40 p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={partner.logoUrl}
                          alt={partner.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">
                          {partner.name}
                          {partner.isActive === false && (
                            <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                              Hidden
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {partner.websiteUrl || "No website"} · order {partner.order ?? 0}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          onClick={() => startEdit(partner)}
                          className="p-1.5 text-muted-foreground hover:text-primary"
                          aria-label={`Edit ${partner.name}`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => void handleDelete(partner)}
                          className="p-1.5 text-muted-foreground hover:text-red-400"
                          aria-label={`Delete ${partner.name}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
