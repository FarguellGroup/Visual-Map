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
import NetworkGraphView from '../details/network-graph-view';

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
      <div className="flex w-full h-screen bg-background text-foreground">
        {showSidebar && (
          <Sidebar side="left" collapsible="icon">
            <AppSidebar />
          </Sidebar>
        )}
        <div className="flex-1 flex flex-col overflow-hidden">
          <AppHeader />
          <main className="flex-1 flex flex-col overflow-y-auto">
            <div className="flex-1 px-6 py-8">
              {children}
            </div>
            <AppFooter />
          </main>
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
              {/* Explicitly render for PDF with a specific ID */}
              {hasCves && <ThreatsDetailView hosts={scanResult.hosts} pdfMode={true} forceId="pdf-threat-service-dist-chart" />}
            </>
          )}
        </div>
      </div>
    </SidebarProvider>
  );
}
