"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Receipt,
  Users,
  ShoppingCart,
  LogOut,
  Settings,
  ClipboardList,
  Menu,
  X,
} from "lucide-react";
import { signOut } from "@/app/auth-actions";
import type { Profile } from "@/types/database";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/layout/logo";

interface SidebarProps {
  profile: Profile;
}

const STORAGE_KEY = "HALIYA POS-sidebar-open";

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isOwner = profile.role === "owner";
  const previousPathname = useRef(pathname);

  useEffect(() => {
    setMounted(true);
    if (localStorage.getItem(STORAGE_KEY) === "true") {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    setOpen(false);
    localStorage.setItem(STORAGE_KEY, "false");
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function setSidebarOpen(next: boolean) {
    setOpen(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }

  function toggleOpen() {
    setSidebarOpen(!open);
  }

  function closeSidebar() {
    setSidebarOpen(false);
  }

  const ownerLinks = [
    { href: "/owner/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/owner/products", label: "Products", icon: Package },
    { href: "/owner/orders", label: "Orders", icon: ClipboardList },
    { href: "/owner/sales", label: "Sales", icon: Receipt },
    { href: "/owner/users", label: "Users", icon: Users },
    { href: "/pos", label: "POS", icon: ShoppingCart },
    { href: "/owner/settings", label: "Settings", icon: Settings },
  ];

  const cashierLinks = [
    { href: "/owner/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/owner/products", label: "Products", icon: Package },
    { href: "/owner/orders", label: "Orders", icon: ClipboardList },
    { href: "/owner/sales", label: "Sales", icon: Receipt },
    { href: "/pos", label: "POS", icon: ShoppingCart },
    { href: "/owner/settings", label: "Settings", icon: Settings },
  ];

  const links = isOwner ? ownerLinks : cashierLinks;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={toggleOpen}
          aria-label="Open menu"
          aria-expanded={false}
          className="fixed left-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
        </button>
      )}

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="animate-fade-in fixed inset-0 z-30 bg-black/40"
            onClick={closeSidebar}
          />

          <aside className="animate-slide-left-in fixed inset-y-0 left-0 z-40 flex w-64 transform-gpu flex-col border-r border-border bg-card shadow-xl will-change-transform">
            <div className="relative border-b border-border px-5 pb-5 pt-5">
              <button
                type="button"
                onClick={closeSidebar}
                aria-label="Close menu"
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>

              <div className="flex flex-col items-center">
                <Logo size="md" />
                {mounted && (
                  <p className="mt-2 text-xs capitalize text-muted-foreground">
                    {profile.role}
                  </p>
                )}
              </div>
            </div>

            <nav className="flex-1 space-y-0.5 overflow-auto p-2">
              {links.map(({ href, label, icon: Icon }) => {
                const active =
                  pathname === href || pathname.startsWith(href + "/");

                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={closeSidebar}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                    <span className="truncate">{label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-border p-2">
              <div className="mb-2 px-3 py-2">
                <p className="truncate text-sm font-medium text-foreground">
                  {profile.full_name || profile.email}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {profile.email}
                </p>
              </div>
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  Sign Out
                </button>
              </form>
              <p className="mt-3 px-3 pb-1 text-center text-[10px] text-muted-foreground">
                Developed by{" "}
                <span className="font-medium text-foreground/70">
                  GeoDevelopment
                </span>
              </p>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
