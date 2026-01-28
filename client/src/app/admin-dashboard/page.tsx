"use client";
import Link from "next/link";
import { useAuth } from "@/providers/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminDashboardPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && user?.role !== "admin") {
      router.replace("/");
    }
  }, [isAuthenticated, user, router]);

  if (!isAuthenticated) {
    return null;
  }
  if (isAuthenticated && user?.role !== "admin") {
    return null;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <p className="text-muted-foreground">Coming soon.</p>

      <Link
        href="/admin-dashboard/metadata"
        className="text-primary underline mt-4 inline-block"
      >
        Manage metadata
      </Link>
    </div>
  );
}
