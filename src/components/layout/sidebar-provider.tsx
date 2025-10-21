'use client';

import { SidebarProvider } from '@/components/ui/sidebar';
import { usePathname } from '@/navigation';
import { useScanStore } from '@/store/use-scan-store';

export function ClientSidebarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { scanResult } = useScanStore();
  const showSidebar = scanResult || pathname.includes('/details');
  const defaultOpen = !!showSidebar;
  
  return <SidebarProvider key={String(defaultOpen)} defaultOpen={defaultOpen}>{children}</SidebarProvider>;
}
