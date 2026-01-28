"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-context";
import AuthGuard from "./auth-guard";

type RouteGuardProps = {
  children: React.ReactNode;
};

const PUBLIC_PATHS = new Set<string>(["/login", "/signup"]);

function isAdminOnlyPath(pathname: string | null) {
  if (!pathname) return false;
  // Crew management for a submission: /submissions/:id/crew
  if (/^\/submissions\/[^/]+\/crew\/?$/.test(pathname)) return true;
  // Create crew profile: /crew/create
  if (pathname === "/crew/create") return true;
  // Admin submissions listing page
  if (pathname === "/submissions") return true;
  // Admin dashboard
  if (pathname === "/admin-dashboard") return true;
  // Add other admin-only sections here if needed (e.g., /admin-dashboard)
  return false;
}

export default function RouteGuard({ children }: RouteGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  // Allow public auth pages without requiring authentication
  if (pathname && PUBLIC_PATHS.has(pathname)) {
    return <>{children}</>;
  }

  // Admin-only routes: if not admin, redirect to dashboard
  useEffect(() => {
    if (isAdminOnlyPath(pathname) && user && user.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [pathname, router, user]);

  // Protect everything else (must be authenticated)
  return <AuthGuard>{children}</AuthGuard>;
}

