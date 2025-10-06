
'use client';

import React from 'react';
import AppFooter from '@/components/layout/footer';
import AppHeader from '@/components/layout/header';
import AppSidebar from '@/components/layout/sidebar';
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { useScanStore } from '@/store/use-scan-store';
import { usePathname } from '@/navigation';

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: {locale: string};
}) {
  const { scanResult, clearScanResult } = useScanStore();
  const pathname = usePathname();
  
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
    </SidebarProvider>
  );
}
