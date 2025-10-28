
'use client';

import React from 'react';
import { usePathname } from '@/navigation';
import { useScanStore } from '@/store/use-scan-store';
import { Sidebar, SidebarProvider } from '@/components/ui/sidebar';
import AppHeader from '@/components/layout/header';
import AppSidebar from '@/components/layout/sidebar';
import AppFooter from '@/components/layout/footer';
import ApiErrorToast from '@/components/api-error-toast';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';

const VulnerabilitiesDetailView = dynamic(() => import('@/components/details/vulnerabilities-detail-view'));
const PortsDetailView = dynamic(() => import('@/components/details/ports-detail-view'));
const ServicesDetailView = dynamic(() => import('@/components/details/services-detail-view'));
const ThreatsDetailView = dynamic(() => import('@/components/details/threats-detail-view'));
const RemediationsView = dynamic(() => import('@/components/details/remediations-view'));
const NetworkGraphView = dynamic(() => import('@/components/details/network-graph-view'), { ssr: false });


export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { scanResult, cveCache } = useScanStore();
  const showSidebar = scanResult || pathname.includes('/details');
  const isHomePageWithoutScan = pathname === '/' && !scanResult;
  
  // When rehydrating from localStorage, cveCache is an array of entries, not a Map.
  // We need to handle both cases.
  const hasCves = cveCache instanceof Map
    ? Array.from(cveCache.values()).some(e => e.status === 'loaded' && e.data && e.data.length > 0)
    : Array.isArray(cveCache) && (cveCache as [string, any][]).some(([, e]) => e.status === 'loaded' && e.data && e.data.length > 0);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex w-full h-screen bg-background text-foreground">
        {showSidebar && (
          <Sidebar side="left" collapsible="icon">
            <AppSidebar />
          </Sidebar>
        )}
        <div className="flex-1 flex flex-col h-screen">
          <AppHeader />
          <main className="flex-1 flex flex-col overflow-y-auto">
            <div className={cn("flex-grow flex flex-col", !isHomePageWithoutScan && "px-6 py-8")}>
              {children}
            </div>
          </main>
          <AppFooter />
        </div>
        <ApiErrorToast />
        {/* Container for off-screen rendering for exports */}
        <div id="export-container" className="bg-background" style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '800px', padding: '1rem' }}>
          {scanResult && (
            <>
              <VulnerabilitiesDetailView hosts={scanResult.hosts} />
              <PortsDetailView hosts={scanResult.hosts} />
              <ServicesDetailView hosts={scanResult.hosts} />
              <NetworkGraphView hosts={scanResult.hosts} pdfMode={true} />
              <ThreatsDetailView hosts={scanResult.hosts} pdfMode={true} />
              <RemediationsView hosts={scanResult.hosts} />
              {/* Explicitly render for PDF with a specific ID */}
              {hasCves && <ThreatsDetailView hosts={scanResult.hosts} pdfMode={true} forceId="pdf-threat-service-dist-chart" />}
            </>
          )}
        </div>
      </div>
    </SidebarProvider>
  );
}
