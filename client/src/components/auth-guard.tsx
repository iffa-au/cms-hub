"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type AuthGuardProps = {
  children: React.ReactNode;
};

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecked, setIsChecked] = useState(false);

  useEffect(() => {
    // Ensure this only runs on the client
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      const next = pathname || "/";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    setIsChecked(true);
  }, [pathname, router]);

  useEffect(() => {
    const onForceLogout = () => {
      const next = pathname || "/";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    };
    window.addEventListener("force-logout", onForceLogout);
    return () => window.removeEventListener("force-logout", onForceLogout);
  }, [pathname, router]);

  if (!isChecked) {
    return null;
  }

  return <>{children}</>;
}

