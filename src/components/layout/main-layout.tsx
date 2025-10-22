'use client';

import React from 'react';
import { usePathname } from '@/navigation';
import { useScanStore } from '@/store/use-scan-store';
import { Sidebar, SidebarProvider } from '@/components/ui/sidebar';
import AppHeader from '@/components/layout/header';
import AppSidebar from '@/components/layout/sidebar';
import AppFooter from '@/components/layout/footer';
import VulnerabilitiesDetailView from '@/components/details/vulnerabilities-detail-view';
import PortsDetailView from '@/components/details/ports-detail-view';
import ServicesDetailView from '@/components/details/services-detail-view';
import ThreatsDetailView from '@/components/details/threats-detail-view';
import ApiErrorToast from '@/components/api-error-toast';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { scanResult, cveCache } = useScanStore();
  const showSidebar = scanResult || pathname.includes('/details');
  const hasCves = Array.from(cveCache.values()).some(e => e.status === 'loaded' && e.data && e.data.length > 0);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="relative flex min-h-screen w-full">
        {showSidebar && (
          <Sidebar side="left" collapsible="icon">
            <AppSidebar />
          </Sidebar>
        )}
        <div className="flex flex-1 flex-col">
          <AppHeader />
          <main className="flex flex-col flex-grow w-full">
            <div className="container mx-auto flex-grow flex flex-col px-6 py-16">
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
              <ThreatsDetailView hosts={scanResult.hosts} />
              {/* Explicitly render for PDF with a specific ID */}
              {hasCves && <ThreatsDetailView hosts={scanResult.hosts} pdfMode={true} forceId="pdf-threat-service-dist-chart" />}
            </>
          )}
        </div>
      </div>
    </SidebarProvider>
  );
}
