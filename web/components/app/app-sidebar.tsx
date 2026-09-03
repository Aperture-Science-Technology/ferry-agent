"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Library,
  Tablet,
  Radio,
  Database,
  Send,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const NAV = [
  { href: "/app/bibliotheque", label: "Bibliothèque", icon: Library },
  { href: "/app/appareils", label: "Appareils", icon: Tablet },
  { href: "/app/gateways", label: "Gateways", icon: Radio },
  { href: "/app/sources", label: "Sources", icon: Database },
  { href: "/app/livraisons", label: "Livraisons", icon: Send },
  { href: "/app/reglages", label: "Réglages", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-2 px-2 py-1.5">
          <span className="font-heading text-lg font-semibold tracking-tight">
            Ferry Agent
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const active = pathname?.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      render={
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
