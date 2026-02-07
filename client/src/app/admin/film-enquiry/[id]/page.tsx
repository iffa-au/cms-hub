"use client";

import { useEffect, useState } from "react";
import { getData, deleteData } from "@/lib/fetch-util";
import { useAuth } from "@/providers/auth-context";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

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
  trailerUrl: string;
  contentType: PopulatedRef;
  genreIds?: PopulatedRef[] | { _id: string; name?: string }[];
  country: PopulatedRef;
  language: PopulatedRef;
  createdAt?: string;
  updatedAt?: string;
};

const LABEL =
  "text-accent-foreground text-xs font-bold uppercase tracking-widest";
const VALUE = "text-foreground mt-1";

export default function FilmEnquiryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [item, setItem] = useState<FilmEnquiryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") {
      router.replace("/");
      return;
    }
    const id = params.id;
    if (!id) return;
    let isMounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getData<{
          success: boolean;
          data: FilmEnquiryItem;
        }>(`/getfilmenquiry/${id}`);
        if (!isMounted) return;
        if (res?.success && res.data) {
          setItem(res.data);
        } else {
          setError("Enquiry not found");
        }
      } catch (e: any) {
        if (!isMounted) return;
        setError(e?.response?.status === 404 ? "Enquiry not found" : e?.message || "Failed to load enquiry");
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [params.id, isAuthenticated, user?.role, router]);

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

  if (loading) {
    return (
      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto w-full">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-border rounded w-1/3" />
          <div className="h-4 bg-border rounded w-full" />
          <div className="h-4 bg-border rounded w-2/3" />
        </div>
      </main>
    );
  }

  if (error || !item) {
    return (
      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto w-full">
        <p className="text-red-400 mb-4">{error || "Enquiry not found"}</p>
        <Link
          href="/admin/film-enquiry"
          className="text-primary hover:underline text-sm font-semibold tracking-wider"
        >
          ← Back to Film Enquiry list
        </Link>
      </main>
    );
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete enquiry "${item.title}"? This cannot be undone.`)) return;
    try {
      await deleteData(`/film-enquiries/${item._id}`);
      router.push("/admin/film-enquiry");
    } catch (e: any) {
      setError(e?.message || "Failed to delete enquiry");
    }
  };

  return (
    <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto w-full">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/admin/film-enquiry"
            className="text-primary hover:underline text-xs font-bold tracking-widest mb-4 inline-block"
          >
            ← BACK TO LIST
          </Link>
          <h1 className="font-serif text-3xl md:text-4xl text-white mt-2">
            Review Enquiry
          </h1>
          <p className="text-accent-foreground text-sm mt-1">
            {item.title}
          </p>
        </div>
        <button
          onClick={handleDelete}
          className="text-red-500 hover:text-red-400 transition-colors text-[10px] font-bold tracking-widest self-start sm:self-center"
        >
          DELETE ENQUIRY
        </button>
      </div>

      <div className="bg-card/60 rounded-lg border border-border overflow-hidden">
        <div className="p-6 space-y-6">
          <section>
            <p className={LABEL}>Contact</p>
            <p className={VALUE}>
              <strong>{item.name}</strong> · {item.role}
            </p>
            <p className={VALUE}>
              <a
                href={`mailto:${item.email}`}
                className="text-primary hover:underline"
              >
                {item.email}
              </a>
            </p>
          </section>

          <section>
            <p className={LABEL}>Film title</p>
            <p className={VALUE}>{item.title}</p>
          </section>

          <section>
            <p className={LABEL}>Synopsis</p>
            <p className={`${VALUE} whitespace-pre-wrap text-sm`}>
              {item.synopsis || "—"}
            </p>
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className={LABEL}>Content type</p>
              <p className={VALUE}>{item.contentType?.name ?? "—"}</p>
            </div>
            <div>
              <p className={LABEL}>Genres</p>
              <p className={VALUE}>
                {(Array.isArray(item.genreIds) ? item.genreIds : [])
                  .map((g) =>
                    typeof g === "object" && g && "name" in g
                      ? (g as { name?: string }).name
                      : null
                  )
                  .filter(Boolean)
                  .join(", ") || "—"}
              </p>
            </div>
            <div>
              <p className={LABEL}>Country</p>
              <p className={VALUE}>{item.country?.name ?? "—"}</p>
            </div>
            <div>
              <p className={LABEL}>Language</p>
              <p className={VALUE}>{item.language?.name ?? "—"}</p>
            </div>
          </section>

          <section>
            <p className={LABEL}>Release date</p>
            <p className={VALUE}>
              {item.releaseDate ? formatDate(item.releaseDate) : "—"}
            </p>
          </section>

          <section>
            <p className={LABEL}>Trailer URL</p>
            <p className={VALUE}>
              {item.trailerUrl ? (
                <a
                  href={item.trailerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline break-all"
                >
                  {item.trailerUrl}
                </a>
              ) : (
                "—"
              )}
            </p>
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className={LABEL}>Production house</p>
              <p className={VALUE}>{item.productionHouse || "—"}</p>
            </div>
            <div>
              <p className={LABEL}>Distributor</p>
              <p className={VALUE}>{item.distributor || "—"}</p>
            </div>
          </section>

          <section className="pt-4 border-t border-border">
            <p className={LABEL}>Submitted</p>
            <p className="text-muted-foreground text-sm mt-1">
              {item.createdAt ? formatDate(item.createdAt) : "—"}
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
