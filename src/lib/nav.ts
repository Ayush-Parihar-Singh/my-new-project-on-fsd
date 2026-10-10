import type { Role } from "@/generated/prisma/enums";

/**
 * Icons are referenced by name, not by component. Server components pass this data to the
 * client sidebar, and function values cannot cross that boundary. The sidebar maps names to icons.
 */
export type NavIconName = "Bell" | "BarChart3" | "Flag" | "Handshake" | "LayoutDashboard" | "ListChecks" | "MapPin" | "ScrollText" | "ShieldCheck" | "Truck" | "UserCog" | "Users" | "PlusCircle";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
  /** Match only the exact path (used for the dashboard root). */
  exact?: boolean;
}

export function navFor(role: Role): NavItem[] {
  const common: NavItem[] = [{ href: "/notifications", label: "Notifications", icon: "Bell" }];
  switch (role) {
    case "DONOR":
      return [
        { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", exact: true },
        { href: "/donations/new", label: "Post a donation", icon: "PlusCircle" },
        { href: "/donations", label: "My donations", icon: "ListChecks" },
        ...common,
        { href: "/profile", label: "Organization profile", icon: "UserCog" },
      ];
    case "NGO":
      return [
        { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", exact: true },
        { href: "/discover", label: "Find food", icon: "MapPin" },
        { href: "/claims", label: "My requests", icon: "Handshake" },
        ...common,
        { href: "/profile", label: "Organization profile", icon: "UserCog" },
      ];
    case "VOLUNTEER":
      return [
        { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", exact: true },
        { href: "/deliveries", label: "Delivery board", icon: "Truck" },
        ...common,
        { href: "/profile", label: "Volunteer profile", icon: "UserCog" },
      ];
    case "ADMIN":
      return [
        { href: "/dashboard", label: "Overview", icon: "LayoutDashboard", exact: true },
        { href: "/admin/verifications", label: "Verifications", icon: "ShieldCheck" },
        { href: "/admin/users", label: "Users", icon: "Users" },
        { href: "/admin/moderation", label: "Moderation", icon: "Flag" },
        { href: "/admin/analytics", label: "Analytics", icon: "BarChart3" },
        { href: "/admin/audit", label: "Audit log", icon: "ScrollText" },
        ...common,
      ];
  }
}

export const ROLE_HOME_LABEL: Record<Role, string> = {
  DONOR: "Food donor",
  NGO: "Recipient",
  VOLUNTEER: "Volunteer",
  ADMIN: "Administrator",
};

