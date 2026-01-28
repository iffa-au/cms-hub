"use client";

import Link from "next/link";
import { useAuth } from "@/providers/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function CreatorDashboardPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && user?.role !== "creator") {
      router.replace("/");
    }
  }, [isAuthenticated, user, router]);

  if (!isAuthenticated) return null;
  if (isAuthenticated && user?.role !== "creator") return null;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Creator Dashboard</h1>
        <Button asChild>
          <Link href="/submissions/new">New Submission</Link>
        </Button>
      </div>
      <p className="text-muted-foreground">
        Your submissions will appear here (placeholder).
      </p>
      {/* Later: list of creator's submissions */}
    </div>
  );
}

