"use client";

import { useCallback, useEffect, useState } from "react";
import { getData, deleteData } from "@/lib/fetch-util";
import { useAuth } from "@/providers/auth-context";
import { useRouter } from "next/navigation";

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
  contentType: PopulatedRef;
  genreIds?: PopulatedRef[] | { _id: string; name?: string }[];
  country: PopulatedRef;
  language: PopulatedRef;
  trailerUrl?: string;
  createdAt?: string;
};

export default function AdminFilmEnquiryPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [list, setList] = useState<FilmEnquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getData<{ success: boolean; data: FilmEnquiryItem[] }>(
        "/film-enquiries"
      );
      if (res?.success && Array.isArray(res.data)) {
        setList(res.data);
      } else {
        setError("Failed to load enquiries");
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message;
      if (status === 404) {
        setError(
          "Enquiry list not available. Deploy the latest backend so the /film-enquiries route exists."
        );
      } else {
        setError(msg || "Failed to load enquiries");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDelete = useCallback(
    async (id: string, title: string) => {
      if (!window.confirm(`Delete enquiry "${title}"? This cannot be undone.`)) return;
      try {
        await deleteData(`/film-enquiries/${id}`);
        await load();
      } catch (e: any) {
        setError(e?.message || "Failed to delete enquiry");
      }
    },
    [load]
  );

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") {
      router.replace("/");
      return;
    }
    load();
  }, [isAuthenticated, user?.role, router, load]);

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

  return (
    <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl text-white mb-2">
            Film Enquiry
          </h1>
          <p className="text-accent-foreground text-sm">
            All film enquiries submitted by the public. Review and send them the submission link when approved.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-separate border-spacing-y-2">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">
              <th className="px-4 py-3">Film Details</th>
              <th className="px-4 py-3">Content Type</th>
              <th className="px-4 py-3 text-center">Release</th>
              <th className="px-4 py-3">Genres</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {loading && (
              <tr className="bg-card/60">
                <td className="px-4 py-6" colSpan={6}>
                  <div className="animate-pulse h-4 w-1/3 bg-border rounded mb-3" />
                  <div className="animate-pulse h-3 w-2/3 bg-border rounded" />
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr className="bg-card/60">
                <td className="px-4 py-6" colSpan={6}>
                  <span className="text-red-400 text-sm">{error}</span>
                </td>
              </tr>
            )}
            {!loading && !error && list.length === 0 && (
              <tr className="bg-card/60">
                <td className="px-4 py-6" colSpan={6}>
                  <span className="text-muted-foreground text-sm">
                    No enquiries yet.
                  </span>
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              list.map((item) => {
                const release = item.releaseDate
                  ? formatDate(item.releaseDate)
                  : "—";
                const submitted = item.createdAt
                  ? formatDate(item.createdAt)
                  : "—";
                return (
                  <tr key={item._id} className="bg-card/60">
                    <td className="px-4 py-6 border-l-2 border-primary">
                      <h3 className="font-serif text-primary font-bold text-lg mb-1">
                        {item.title}
                      </h3>
                      <p className="text-muted-foreground text-xs mb-0.5">
                        {item.name} ·{" "}
                        <a
                          href={`mailto:${item.email}`}
                          className="text-primary hover:underline"
                        >
                          {item.email}
                        </a>
                      </p>
                      {item.synopsis ? (
                        <p className="text-muted-foreground text-xs line-clamp-1 max-w-md">
                          {item.synopsis}
                        </p>
                      ) : (
                        <p className="text-muted-foreground text-xs line-clamp-1 max-w-md">
                          —
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-6">
                      <span className="text-foreground/80 font-medium">
                        {item.contentType?.name ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-6 text-center">
                      <span className="text-muted-foreground">{release}</span>
                    </td>
                    <td className="px-4 py-6 min-w-[120px]">
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          const raw = item.genreIds;
                          const genres = Array.isArray(raw) ? raw : [];
                          if (!genres.length) return <span className="text-muted-foreground">—</span>;
                          return genres.map((g, i) => (
                            <span
                              key={typeof g === "object" && g && "_id" in g ? (g as any)._id : i}
                              className="px-2 py-0.5 border border-border rounded-full text-[10px] text-primary uppercase font-semibold"
                            >
                              {typeof g === "object" && g && "name" in g ? (g as any).name : "—"}
                            </span>
                          ));
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-6">
                      <span className="text-muted-foreground text-xs">
                        {submitted}
                      </span>
                    </td>
                    <td className="px-4 py-6 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() =>
                            router.push(`/admin/film-enquiry/${item._id}`)
                          }
                          className="text-primary hover:text-foreground transition-colors text-[10px] font-bold tracking-widest"
                        >
                          DETAIL
                        </button>
                        <button
                          onClick={() => handleDelete(item._id, item.title)}
                          className="text-red-500 hover:text-red-400 transition-colors text-[10px] font-bold tracking-widest"
                        >
                          DELETE
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {!loading && !error && list.length > 0 && (
        <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
          <span className="text-xs text-muted-foreground tracking-wider">
            {`SHOWING ${list.length} ENQUIRY${list.length === 1 ? "" : "IES"}`}
          </span>
        </div>
      )}
    </main>
  );
}
