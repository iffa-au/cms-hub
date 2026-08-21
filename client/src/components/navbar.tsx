"use client";

import Link from "next/link";
import { useAuth } from "@/providers/auth-context";
import Image from "next/image";
import { ChevronDown, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type NavLink = { href: string; label: string };
type NavGroup = { label: string; children: NavLink[] };
type NavItem = NavLink | NavGroup;

const isGroup = (item: NavItem): item is NavGroup => "children" in item;

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close an open dropdown when clicking anywhere outside the nav group.
  useEffect(() => {
    if (!openGroup) return;
    const handleClick = (e: MouseEvent) => {
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenGroup(null);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [openGroup]);

  // Base links for all authenticated users
  const commonLinks: NavItem[] = [
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
    commonLinks.splice(insertAfterCrew + 1, 0, { href: "/admin/film-enquiry", label: "Film Enquiry" });
  }
  // Staff and Admin: review queue, plus everything that controls what the
  // public website shows. Grouped under one dropdown so adding future
  // website-content tools doesn't keep widening the nav bar.
  if (user?.role === "admin" || user?.role === "staff") {
    const profileIndex = commonLinks.findIndex(
      (l) => !isGroup(l) && l.href === "/profile",
    );
    const insertIndex = profileIndex >= 0 ? profileIndex : commonLinks.length;
    commonLinks.splice(insertIndex, 0, { href: "/review-queue", label: "Review Queue" });
    commonLinks.splice(insertIndex + 1, 0, {
      label: "Site Content",
      children: [
        { href: "/carousel", label: "Submissions Carousel" },
        { href: "/partners", label: "Partners" },
      ],
    });
  }

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  if (!isAuthenticated) {
    return null;
  }

  const linkClass =
    "whitespace-nowrap uppercase tracking-wider hover:text-primary transition-colors transition-transform duration-200 ease-out text-base hover:scale-105";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          <Link
            href="/dashboard"
            className="text-lg md:text-xl font-serif font-semibold tracking-wider"
          >
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
          <div className="hidden xl:flex items-center gap-6" ref={groupRef}>
            {commonLinks.map((item) =>
              isGroup(item) ? (
                <div key={item.label} className="relative">
                  <button
                    onClick={() =>
                      setOpenGroup((current) => (current === item.label ? null : item.label))
                    }
                    aria-haspopup="true"
                    aria-expanded={openGroup === item.label}
                    className={`${linkClass} flex items-center gap-1.5`}
                  >
                    {item.label}
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-200 ${
                        openGroup === item.label ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {openGroup === item.label && (
                    <div className="absolute right-0 top-full mt-3 min-w-[15rem] overflow-hidden rounded-lg border border-border bg-background shadow-xl">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setOpenGroup(null)}
                          className="block px-4 py-3 text-sm uppercase tracking-wider text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link key={item.href} href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              ),
            )}
            <button onClick={handleLogout} className={linkClass}>
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
                  {commonLinks.map((item) =>
                    isGroup(item) ? (
                      // Rendered as a labelled section rather than a nested
                      // toggle — the menu is already a deliberate tap, so
                      // hiding these behind a second one just adds friction.
                      <div key={item.label} className="flex w-full flex-col items-center">
                        <span className="my-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                          {item.label}
                        </span>
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className="my-2 text-sm uppercase tracking-wider transition-colors transition-transform duration-200 ease-out hover:scale-105 hover:text-primary"
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-sm uppercase my-2 tracking-wider hover:text-primary transition-colors transition-transform duration-200 ease-out hover:scale-105"
                      >
                        {item.label}
                      </Link>
                    ),
                  )}
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
