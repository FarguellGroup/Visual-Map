
'use client';

import React, { useState, useEffect } from 'react';
import AppFooter from '@/components/layout/footer';
import AppHeader from '@/components/layout/header';
import AppSidebar from '@/components/layout/sidebar';
import { Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { usePathname } from '@/navigation';
import { useTheme } from 'next-themes';
import VulnerabilitiesDetailView from '@/components/details/vulnerabilities-detail-view';
import PortsDetailView from '@/components/details/ports-detail-view';
import ServicesDetailView from '@/components/details/services-detail-view';
import ThreatsDetailView from '@/components/details/threats-detail-view';
import { ClientSidebarProvider } from '@/components/layout/sidebar-provider';
import { useScanStore } from '@/store/use-scan-store';
import ApiErrorToast from '@/components/api-error-toast';

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: {locale: string};
}) {
  const pathname = usePathname();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  // We need to get the scanResult here to conditionally render the sidebar
  // but we pass the logic that uses the store down to the header.
  const { scanResult, cveCache } = useScanStore();
  const hasCves = Array.from(cveCache.values()).some(e => e.status === 'loaded' && e.data && e.data.length > 0);


  useEffect(() => {
    setMounted(true);
  }, []);

  const showSidebar = scanResult || pathname.includes('/details');

  return (
    <ClientSidebarProvider>
      {showSidebar && (
        <Sidebar side="left" collapsible="icon">
         <AppSidebar />
        </Sidebar>
      )}
      <SidebarInset>
        <div className="flex flex-col min-h-screen">
          <AppHeader />
          <main className="flex flex-col flex-grow w-full">
            <div className='container mx-auto flex-grow flex flex-col p-4 md:p-8'>
                {children}
            </div>
          </main>
          <AppFooter />
        </div>
      </SidebarInset>
      <ApiErrorToast />
       {/* Container for off-screen rendering for exports */}
      {mounted && scanResult && (
        <div id="export-container" className={`${theme} bg-background`} style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '800px', padding: '1rem' }}>
            <VulnerabilitiesDetailView hosts={scanResult.hosts} />
            <PortsDetailView hosts={scanResult.hosts} />
            <ServicesDetailView hosts={scanResult.hosts} />
            <ThreatsDetailView hosts={scanResult.hosts} />
            {/* Explicitly render for PDF with a specific ID */}
            {hasCves && <ThreatsDetailView hosts={scanResult.hosts} pdfMode={true} forceId="pdf-threat-service-dist-chart" />}
        </div>
      )}
    </ClientSidebarProvider>
  );
}
