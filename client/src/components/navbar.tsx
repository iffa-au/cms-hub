"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronDown, Menu, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-context";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string };
type NavGroup = { label: string; children: NavLink[] };
type NavItem = NavLink | NavGroup;

const isGroup = (item: NavItem): item is NavGroup => "children" in item;

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  const role = user?.role;
  const isStaff = role === "admin" || role === "staff";
  const isAdmin = role === "admin";

  /**
   * Ten top-level links meant the bar only fitted above `xl`, so every laptop
   * at 1024px got the hamburger. Folding them into four labelled groups gets
   * the real navigation back on screen at `lg`, and leaves room to add more
   * tools without widening the bar again.
   */
  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [{ href: "/dashboard", label: "Dashboard" }];

    if (isStaff) {
      const films: NavLink[] = [];
      if (isAdmin) films.push({ href: "/submissions", label: "All submissions" });
      films.push({ href: "/review-queue", label: "Review queue" });
      // Winners sits immediately beside Nominations.
      films.push({ href: "/nomination", label: "Nominations" });
      films.push({ href: "/winners", label: "Winners" });
      items.push({ label: "Films", children: films });

      items.push({
        label: "Site content",
        children: [
          { href: "/carousel", label: "Submissions carousel" },
          { href: "/featured-films", label: "Featured films" },
          { href: "/partners", label: "Partners" },
          { href: "/festivals", label: "Festivals" },
          { href: "/festivals/settings", label: "Festivals page" },
          { href: "/podcasts", label: "Podcasts" },
        ],
      });
    }

    // Crew is deliberately absent. /admin/crew manages the normalised
    // CrewMember/CrewAssignment directory, which only covers 2022-2025 films and
    // is unrelated to the crew a submission actually carries — opening it against
    // a recent film shows an empty page. Crew is now edited per-submission, from
    // the edit screen and the review queue. The route still works if linked
    // directly, because ~29 older films depend on that data.
    if (isAdmin) {
      items.push({
        label: "Manage",
        children: [
          { href: "/admin/metadata", label: "Metadata" },
          { href: "/admin/film-enquiry", label: "Film enquiries" },
        ],
      });
    }

    return items;
  }, [isAdmin, isStaff]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const groupIsActive = (group: NavGroup) =>
    group.children.some((c) => isActive(c.href));

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

  // Route changes should never leave a menu hanging open behind the new page.
  // Adjusted during render rather than in an effect, so the new page never
  // paints for a frame with the old menu still over it.
  const [menuRoute, setMenuRoute] = useState(pathname);
  if (pathname !== menuRoute) {
    setMenuRoute(pathname);
    setMobileMenuOpen(false);
    setOpenGroup(null);
  }

  // The open mobile menu scrolls itself; letting the page scroll behind it is
  // what makes a drawer feel broken on a phone.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileMenuOpen]);

  // The page offset reads --header-h rather than a hardcoded padding, so the
  // two can't drift. The open mobile menu is absolutely positioned and so is
  // deliberately not measured — the page shouldn't lurch down when it opens.
  // On the auth pages this nav renders null, so the offset collapses to 0.
  useEffect(() => {
    const root = document.documentElement;
    if (!isAuthenticated) {
      root.style.setProperty("--header-h", "0px");
      return;
    }
    const el = navRef.current;
    if (!el) return;
    const publish = () =>
      root.style.setProperty("--header-h", `${el.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isAuthenticated]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  if (!isAuthenticated) return null;

  const topLevel =
    "rounded px-2 py-1.5 text-sm transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

  return (
    <nav
      ref={navRef}
      className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:h-20 lg:px-8">
        <Link href="/dashboard" aria-label="CMS Hub home" className="shrink-0">
          <Image
            src="/assets/IFFA_logo.png"
            alt="IFFA Awards"
            width={300}
            height={100}
            className="h-9 w-auto lg:h-12"
            priority
          />
        </Link>

        {/* Desktop navigation */}
        <div className="hidden items-center gap-1 lg:flex" ref={groupRef}>
          {navItems.map((item) =>
            isGroup(item) ? (
              <div key={item.label} className="relative">
                <button
                  onClick={() =>
                    setOpenGroup((current) =>
                      current === item.label ? null : item.label,
                    )
                  }
                  aria-haspopup="true"
                  aria-expanded={openGroup === item.label}
                  className={cn(
                    topLevel,
                    "flex items-center gap-1",
                    groupIsActive(item) ? "text-primary" : "text-foreground",
                  )}
                >
                  {item.label}
                  <ChevronDown
                    size={14}
                    className={cn(
                      "transition-transform duration-200",
                      openGroup === item.label && "rotate-180",
                    )}
                  />
                </button>

                {openGroup === item.label && (
                  <div className="absolute right-0 top-full mt-2 min-w-56 overflow-hidden rounded-lg border border-border bg-surface-overlay shadow-xl">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "block px-4 py-2.5 text-sm transition-colors hover:bg-primary/10 hover:text-primary",
                          isActive(child.href)
                            ? "text-primary"
                            : "text-foreground",
                        )}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  topLevel,
                  isActive(item.href) ? "text-primary" : "text-foreground",
                )}
              >
                {item.label}
              </Link>
            ),
          )}

          <span className="mx-2 h-5 w-px bg-border" aria-hidden />

          <Link
            href="/profile"
            className={cn(
              topLevel,
              isActive("/profile") ? "text-primary" : "text-foreground",
            )}
          >
            {user?.name?.split(" ")[0] || "Profile"}
          </Link>
          <button onClick={handleLogout} className={cn(topLevel, "text-muted-foreground")}>
            Log out
          </button>
        </div>

        {/* Mobile trigger */}
        <button
          className="rounded p-2 lg:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu. Left-aligned and scrollable — the old centred column
          couldn't be scanned and ran off the bottom of a short screen. */}
      {mobileMenuOpen && (
        <div className="absolute inset-x-0 top-full max-h-[calc(100svh-var(--header-h))] overflow-y-auto border-b border-border bg-background/98 backdrop-blur-sm lg:hidden">
          <div className="space-y-6 px-4 py-5 sm:px-6">
            {navItems.map((item) =>
              isGroup(item) ? (
                <section key={item.label}>
                  <h2 className="mb-2 text-xs font-semibold text-muted-foreground">
                    {item.label}
                  </h2>
                  <ul className="space-y-1">
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          className={cn(
                            "block rounded px-2 py-2 text-sm",
                            isActive(child.href)
                              ? "bg-primary/10 text-primary"
                              : "text-foreground hover:bg-surface-dark",
                          )}
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block rounded px-2 py-2 text-sm",
                    isActive(item.href)
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-surface-dark",
                  )}
                >
                  {item.label}
                </Link>
              ),
            )}

            <div className="space-y-1 border-t border-border pt-4">
              <Link
                href="/profile"
                className={cn(
                  "block rounded px-2 py-2 text-sm",
                  isActive("/profile")
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-surface-dark",
                )}
              >
                Profile
              </Link>
              <button
                onClick={handleLogout}
                className="block w-full rounded px-2 py-2 text-left text-sm text-muted-foreground hover:bg-surface-dark"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
