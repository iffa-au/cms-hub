"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-context";
import AuthGuard from "./auth-guard";

type RouteGuardProps = {
  children: React.ReactNode;
};

// "/attend" is the public awards-night registration form: admins send its
// link to guests. It can only submit; the guest list stays admin-only.
const PUBLIC_PATHS = new Set<string>(["/login", "/signup", "/attend"]);

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

  // Admin-only routes: if not admin, redirect to dashboard. Called before the
  // early return below: hooks must run on every render, and returning first on
  // /login made React throw "Rendered fewer hooks than expected" whenever the
  // app redirected from a guarded page to /login.
  useEffect(() => {
    if (isAdminOnlyPath(pathname) && user && user.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [pathname, router, user]);

  // Allow public auth pages without requiring authentication
  if (pathname && PUBLIC_PATHS.has(pathname)) {
    return <>{children}</>;
  }


  // Protect everything else (must be authenticated)
  return <AuthGuard>{children}</AuthGuard>;
}

