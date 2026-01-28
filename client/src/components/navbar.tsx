"use client";

import Link from "next/link";
import { useAuth } from "@/providers/auth-context";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  console.log("user in nav bar", user);
  // Base links for all authenticated users
  const commonLinks: { href: string; label: string }[] = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/profile", label: "Profile" },
  ];
  // Admins can also see site-wide submissions list
  if (user?.role === "admin") {
    commonLinks.splice(1, 0, { href: "/submissions", label: "Submissions" });
  }
  // Staff and Admin can access nominations index
  if (user?.role === "admin" || user?.role === "staff") {
    commonLinks.splice(2, 0, { href: "/nomination", label: "Nominations" });
  }
  // Admins can manage crew
  if (user?.role === "admin") {
    commonLinks.splice(3, 0, { href: "/admin/crew", label: "Crew" });
    // Admins can manage metadata
    const insertAfterCrew = 4;
    commonLinks.splice(insertAfterCrew, 0, { href: "/admin/metadata", label: "Metadata" });
  }
  // Staff and Admin can access the review queue
  if (user?.role === "admin" || user?.role === "staff") {
    const profileIndex = commonLinks.findIndex((l) => l.href === "/profile");
    const insertIndex = profileIndex >= 0 ? profileIndex : commonLinks.length;
    commonLinks.splice(insertIndex, 0, { href: "/review-queue", label: "Review Queue" });
  }

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const roleLinks: { href: string; label: string }[] = [];
  if (user?.role === "creator") {
    roleLinks.push({ href: "/creator-dashboard", label: "Creator Dashboard" });
  }
  if (user?.role === "staff") {
    roleLinks.push({ href: "/review-queue", label: "Review Queue" });
  }
  if (user?.role === "admin") {
    roleLinks.push({ href: "/admin-dashboard", label: "Admin Dashboard" });
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          <Link
            href="/dashboard"
            className="text-lg md:text-xl font-serif font-semibold tracking-wider"
          >
            {/* International Arab Film Festival of Australia */}
            <Image
              src={"/assets/IFFA_logo.png"}
              alt="IAFFA Logo"
              width={300}
              height={100}
              className="h-14 w-auto"
              priority
            />
          </Link>
          {/* Desktop Navigation (only on very wide screens to avoid wrapping) */}
          <div className="hidden xl:flex items-center gap-6">
            {commonLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap uppercase tracking-wider hover:text-primary transition-colors transition-transform duration-200 ease-out text-base hover:scale-105"
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="whitespace-nowrap uppercase tracking-wider hover:text-primary transition-colors transition-transform duration-200 ease-out text-base hover:scale-105"
            >
              Logout
            </button>
          </div>
          {/* Mobile/Tablet Menu Button */}
          <button
            className="xl:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {/* Mobile Menu Navigation */}
          {mobileMenuOpen && (
            <div className="xl:hidden absolute top-20 left-0 right-0 bg-background/95 backdrop-blur-sm border-b border-border">
              <div className="container mx-auto px-4 py-4">
                <div className="flex flex-col items-center gap-4">
                  {commonLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-sm uppercase my-2 tracking-wider hover:text-primary transition-colors transition-transform duration-200 ease-out hover:scale-105"
                    >
                      {item.label}
                    </Link>
                  ))}
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="text-sm uppercase my-2 tracking-wider hover:text-primary transition-colors transition-transform duration-200 ease-out hover:scale-105"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
