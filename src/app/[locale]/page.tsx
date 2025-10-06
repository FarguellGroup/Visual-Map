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
import PortsDetailView from '@/components/details/ports-detail-view';
import ServicesDetailView from '@/components/details/services-detail-view';
import VulnerabilitiesDetailView from '@/components/details/vulnerabilities-detail-view';
import ThreatsDetailView from '@/components/details/threats-detail-view';
import NetworkGraphView from '@/components/details/network-graph-view';
import { useTheme } from 'next-themes';

export default function Home() {
  const { scanResult, setScanResult, clearScanResult, riskWeights } = useScanStore();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const t = useTranslations('Loader');
  const { theme } = useTheme();

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
    <div className='flex-grow flex flex-col h-full'>
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <Loader2 className="w-16 h-16 animate-spin text-primary" />
          <p className="text-lg text-muted-foreground">{t('analyzing')}</p>
        </div>
      ) : !scanResult ? (
        <div className="flex-grow flex items-stretch h-full">
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
          {/* Pre-render elements for PDF/HTML export */}
          <div className="absolute -left-[9999px] top-[-9999px] opacity-0" aria-hidden="true">
              {scanResult && (
                <>
                <div className={'light'}>
                  <div className="p-4 bg-background w-[800px]">
                    <PortsDetailView hosts={scanResult.hosts} pdfMode={true}/>
                  </div>
                    <div className="p-4 bg-background w-[800px]">
                    <ServicesDetailView hosts={scanResult.hosts} pdfMode={true}/>
                  </div>
                    <div className="p-4 bg-background w-[800px]">
                      <VulnerabilitiesDetailView hosts={scanResult.hosts} pdfMode={true}/>
                  </div>
                    <div className="p-4 bg-background w-[800px]">
                    <ThreatsDetailView hosts={scanResult.hosts} pdfMode={true}/>
                  </div>
                  <div className="p-4 bg-background w-[800px]">
                    <NetworkGraphView hosts={scanResult.hosts} pdfMode={true}/>
                  </div>
                </div>
                <div className={theme}>
                  <div id="html-export-content" className="p-4 bg-background w-[800px]">
                     <PortsDetailView hosts={scanResult.hosts} pdfMode={true} forceId="html-top-ports-chart"/>
                     <ServicesDetailView hosts={scanResult.hosts} pdfMode={true} forceId="html-service-distribution-chart"/>
                     <VulnerabilitiesDetailView hosts={scanResult.hosts} pdfMode={true} forceId="html-risk-distribution-chart"/>
                  </div>
                </div>
                </>
              )}
          </div>
        </div>
      )}
      <HostDetailDrawer />
    </div>
  );
}
