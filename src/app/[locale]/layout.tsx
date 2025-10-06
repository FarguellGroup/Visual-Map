
'use client';

import React, { useState, useEffect } from 'react';
import AppFooter from '@/components/layout/footer';
import AppHeader from '@/components/layout/header';
import AppSidebar from '@/components/layout/sidebar';
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { useScanStore } from '@/store/use-scan-store';
import { usePathname } from '@/navigation';
import { useTheme } from 'next-themes';
import VulnerabilitiesDetailView from '@/components/details/vulnerabilities-detail-view';
import PortsDetailView from '@/components/details/ports-detail-view';
import ServicesDetailView from '@/components/details/services-detail-view';
import ThreatsDetailView from '@/components/details/threats-detail-view';

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: {locale: string};
}) {
  const { scanResult, clearScanResult } = useScanStore();
  const pathname = usePathname();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const handleUploadNew = () => {
    clearScanResult();
  };

  const showSidebar = scanResult || pathname.includes('/details');

  return (
    <SidebarProvider>
      {showSidebar && (
        <Sidebar side="left" collapsible="icon">
         <AppSidebar />
        </Sidebar>
      )}
      <SidebarInset>
        <div className="flex flex-col min-h-screen">
          <AppHeader onUploadNew={handleUploadNew} showUploadNew={!!scanResult}>
              {showSidebar && <SidebarTrigger />}
          </AppHeader>
          <main className="flex flex-col flex-grow w-full">
            <div className='container mx-auto flex-grow flex flex-col p-4 md:p-8'>
                {children}
            </div>
          </main>
          <AppFooter />
        </div>
      </SidebarInset>
       {/* Container for off-screen rendering for exports */}
      {mounted && scanResult && (
        <div id="export-container" className={`${theme} bg-background`} style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '800px', padding: '1rem' }}>
            <VulnerabilitiesDetailView hosts={scanResult.hosts} />
            <PortsDetailView hosts={scanResult.hosts} />
            <ServicesDetailView hosts={scanResult.hosts} />
            <ThreatsDetailView hosts={scanResult.hosts} />
        </div>
      )}
    </SidebarProvider>
  );
}

