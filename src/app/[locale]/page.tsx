'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useScanStore } from '@/store/use-scan-store';
import { parseNmapXml } from '@/lib/nmap-parser';
import UploadZone from '@/components/upload-zone';
import SummaryCards from '@/components/dashboard/summary-cards';
import HostsTable from '@/components/dashboard/hosts-table';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import HostDetailDrawer from '@/components/dashboard/host-detail-drawer';
import { cn } from '@/lib/utils';

export default function Home() {
  const { scanResult, setScanResult, clearScanResult, riskWeights } = useScanStore();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const t = useTranslations('Loader');

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      setIsLoading(true);
      const file = acceptedFiles[0];
      const reader = new FileReader();

      reader.onabort = () => {
        setIsLoading(false);
        toast({
          variant: 'destructive',
          title: 'File reading aborted',
        });
      };
      reader.onerror = () => {
        setIsLoading(false);
        toast({
          variant: 'destructive',
          title: 'File reading failed',
        });
      };
      reader.onload = async () => {
        try {
          const xmlData = reader.result as string;
          let hosts = await parseNmapXml(xmlData);
          setScanResult(file.name, hosts, riskWeights, true);
        } catch (error) {
          console.error('Parsing error:', error);
          toast({
            variant: 'destructive',
            title: 'Failed to parse XML',
            description: error instanceof Error ? error.message : 'An unknown error occurred.',
          });
          clearScanResult();
        } finally {
          setIsLoading(false);
        }
      };

      reader.readAsText(file);
    },
    [setScanResult, clearScanResult, toast, riskWeights]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/xml': ['.xml'] },
    maxFiles: 1,
  });

  return (
    <div className='flex-grow flex flex-col'>
      {isLoading ? (
        <div className="flex-grow flex flex-col items-center justify-center gap-4">
          <Loader2 className={cn('w-16 h-16 animate-spin text-primary')} />
          <p className="text-lg text-muted-foreground">{t('analyzing')}</p>
        </div>
      ) : !scanResult ? (
        <div className="flex-grow flex flex-col items-center justify-center py-8 md:py-20">
          <UploadZone
            getRootProps={getRootProps}
            getInputProps={getInputProps}
            isDragActive={isDragActive}
          />
        </div>
      ) : (
        <div className="space-y-4 md:space-y-8 py-4 md:py-8">
          <SummaryCards />
          <HostsTable />
        </div>
      )}
      <HostDetailDrawer />
    </div>
  );
}
