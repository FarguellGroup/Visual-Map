'use client';

import { SidebarProvider } from '@/components/ui/sidebar';

export function ClientSidebarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SidebarProvider defaultOpen={true}>{children}</SidebarProvider>;
}
