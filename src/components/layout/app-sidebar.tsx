"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bell, Flag, Handshake, LayoutDashboard, ListChecks, MapPin, PlusCircle, ScrollText, ShieldCheck, Truck, UserCog, Users, type LucideIcon } from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { SignOutButton } from "./sign-out-button";
import { Badge } from "@/components/ui/badge";

export type { NavItem };

const ICONS: Record<NavItem["icon"], LucideIcon> = {
  Bell, BarChart3, Flag, Handshake, LayoutDashboard, ListChecks, MapPin, ScrollText, ShieldCheck, Truck, UserCog, Users, PlusCircle,
};

export function AppSidebar({ items, userName, roleLabel, unread }: { items: NavItem[]; userName: string; roleLabel: string; unread: number }) {
  const pathname = usePathname();
  const isActive = (item: NavItem) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));

  const nav = (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {items.map((item) => {
        const active = isActive(item);
        const Icon = ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-forest text-white shadow-sm" : "text-ink/80 hover:bg-sage/60 hover:text-deep",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="whitespace-nowrap">{item.label}</span>
            {item.href === "/notifications" && unread > 0 ? (
              <span className={cn("ml-auto rounded-full px-2 text-xs font-bold", active ? "bg-white text-forest" : "bg-coral text-deep")} aria-label={`${unread} unread`}>
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-line bg-white/80 p-5 md:flex">
        <Logo />
        <div className="rounded-2xl bg-sage-light p-3.5">
          <p className="truncate text-sm font-semibold text-deep">{userName}</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone="sage">{roleLabel}</Badge>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto pr-1">{nav}</div>
        <div className="border-t border-line pt-3">
          <SignOutButton className="w-full justify-start" />
        </div>
      </aside>
      <div className="sticky top-0 z-30 border-b border-line bg-cream/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3">
          <Logo compact />
          <div className="flex items-center gap-2">
            <Link href="/notifications" className="relative flex size-10 items-center justify-center rounded-full border border-line bg-white text-deep" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
              <Bell className="size-4" aria-hidden />
              {unread > 0 ? <span className="absolute -right-1 -top-1 rounded-full bg-coral px-1.5 text-[10px] font-bold text-deep">{unread > 9 ? "9+" : unread}</span> : null}
            </Link>
            <SignOutButton className="px-2" />
          </div>
        </div>
        <div className="mt-3">{nav}</div>
      </div>
    </>
  );
}
