"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-context";

export default function NewsPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && user?.role !== "admin" && user?.role !== "staff") {
      router.replace("/");
    }
  }, [isAuthenticated, user, router]);

  if (!isAuthenticated) return null;
  if (isAuthenticated && user?.role !== "admin" && user?.role !== "staff") return null;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="rounded border border-border bg-card/60 p-8 shadow-sm">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">
          Site content
        </p>
        <h1 className="mb-3 font-serif text-3xl text-white md:text-4xl">News</h1>
        
      </div>
    </main>
  );
}
