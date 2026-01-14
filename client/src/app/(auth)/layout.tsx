"use client";
import { useAuth } from "@/providers/auth-context";
import { redirect } from "next/navigation";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return <div>Loading...</div>;
  }
  if (isAuthenticated) {
    return redirect("/dashboard");
  }
  return <>{children}</>;
}
