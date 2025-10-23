'use client';

import React from 'react';
import UploadZone from '@/components/upload-zone';
import { useScanStore } from '@/store/use-scan-store';
import SummaryCards from '@/components/dashboard/summary-cards';
import HostsTable from '@/components/dashboard/hosts-table';
import HostDetailDrawer from '@/components/dashboard/host-detail-drawer';

export default function Home() {
  const { scanResult } = useScanStore();

  if (!scanResult) {
    return (
      <div className="flex-grow flex items-center justify-center">
        <UploadZone />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8">
        <SummaryCards />
        <HostsTable />
      </div>
      <HostDetailDrawer />
    </>
  );
}
