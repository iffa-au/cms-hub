"use client";

import { useAuth } from "@/providers/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminSubmissionsPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && user?.role !== "admin") {
      router.replace("/");
    }
  }, [isAuthenticated, user, router]);

  if (!isAuthenticated) return null;
  if (isAuthenticated && user?.role !== "admin") return null;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">All Submissions (Admin)</h1>
      <p className="text-muted-foreground">
        Admin can view and edit submissions here (placeholder).
      </p>
    </div>
  );
}

