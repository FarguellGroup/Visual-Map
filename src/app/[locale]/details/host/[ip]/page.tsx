
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from '@/navigation';
import { useParams } from 'next/navigation';
import { useScanStore } from '@/store/use-scan-store';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Server, ArrowUpDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Host, Port, Script } from '@/types/nmap';
import { VulnerabilityExplanation } from '@/components/dashboard/vulnerability-explanation';
import { PentestingNextSteps } from '@/components/details/pentesting-next-steps';
import { NseSummary } from '@/components/details/nse-summary';
import { cn } from '@/lib/utils';
import { CveDetails } from '@/components/details/cve-details';
import { getHostname, getOsName, getScripts } from '@/lib/nmap-parser';

const getPorts = (host: Host | null): Port[] => {
    if (!host || !host.ports || !host.ports.port) return [];
    const ports = Array.isArray(host.ports.port) ? host.ports.port : [host.ports.port];
    return ports.filter(p => p.state.state === 'open');
}

const getRiskColorClass = (score: number): string => {
    if (score >= 90) return 'bg-red-600 hover:bg-red-700 text-white';
    if (score >= 75) return 'bg-orange-500 hover:bg-orange-600 text-white';
    if (score >= 40) return 'bg-yellow-500 hover:bg-yellow-600 text-black';
    if (score > 0) return 'bg-green-500 hover:bg-green-600 text-white';
    return 'bg-gray-400 hover:bg-gray-500 text-white';
};

type SortableKeys = 'port' | 'service' | 'version';
type SortDirection = 'ascending' | 'descending';

export default function HostDetailPage() {
  const params = useParams();
  const ip = params.ip as string;
  const router = useRouter();
  const { 
    scanResult, 
    setSelectedHost,
  } = useScanStore();
  const t = useTranslations('HostDetail');
  const tDetails = useTranslations('DetailsPage');
  const locale = useLocale();
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: SortDirection } | null>(null);

  const host = useMemo(() => scanResult?.hosts.find(h => h.address[0].addr === ip), [scanResult, ip]);

  const hostData = useMemo(() => {
    if (!host) return null;
    return {
      ...host,
      hostname: getHostname(host),
      osName: getOsName(host),
      hostScripts: getScripts(host)
    };
  }, [host]);

  useEffect(() => {
    if (scanResult && !host) {
        // if scan is loaded but host not found
        // This can happen if the host list changes after a rescore
        // We don't push to `/` to avoid losing the scan context
    } else if (!scanResult) {
        router.push('/');
    }

    if (host) {
      // Trigger all AI generations for this host (except CVEs)
      const store = useScanStore.getState();
      store.fetchVulnerabilityExplanation(host, locale);
      store.fetchPentestingNextSteps(host, locale);
      store.fetchNseSummary(host, locale);
    }
    
    setSelectedHost(null);
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ip, scanResult, host, locale, router]);
  

  const openPorts = useMemo(() => getPorts(hostData), [hostData]);

  const sortedPorts = useMemo(() => {
    let sortableItems = [...openPorts];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue, bValue;

        switch (sortConfig.key) {
          case 'port':
            aValue = parseInt(a.portid, 10);
            bValue = parseInt(b.portid, 10);
            break;
          case 'service':
            aValue = a.service?.name || '';
            bValue = b.service?.name || '';
            break;
          case 'version':
            aValue = `${a.service?.product || ''} ${a.service?.version || ''}`.trim();
            bValue = `${b.service?.product || ''} ${b.service?.version || ''}`.trim();
            break;
          default:
            return 0;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [openPorts, sortConfig]);
  
  const requestSort = (key: SortableKeys) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: SortableKeys) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return <ArrowUpDown className="ml-2 h-4 w-4" />;
  };

  if (!hostData) {
    return (
        <div className="flex-grow flex items-center justify-center">
            <p className="text-center text-muted-foreground">{tDetails('pageNotFound')}</p>
        </div>
    );
  }

  const { riskScore, hostname, osName, hostScripts } = hostData;
  const hasHostname = hostname !== 'N/A';
  
  return (
    <>
      <div className="flex items-center gap-4 mb-8">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Go back</span>
        </Button>
        <div className='flex items-center gap-4'>
            <Server className="h-8 w-8" />
            <div>
                {hasHostname ? (
                    <h1 className="text-xl md:text-3xl font-bold flex items-baseline gap-2 font-headline">
                        {hostname} 
                        <span className="text-lg md:text-2xl text-muted-foreground font-mono">({hostData.address[0].addr})</span>
                    </h1>
                ) : (
                    <h1 className="text-xl md:text-3xl font-bold font-mono font-headline">{hostData.address[0].addr}</h1>
                )}
            </div>
        </div>
      </div>
      
      <div className="grid gap-8 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2 space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>{t('openPorts')} ({openPorts.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                <TableHead onClick={() => requestSort('port')} className="cursor-pointer">
                                <div className="flex items-center">{t('port')} {getSortIcon('port')}</div>
                                </TableHead>
                                <TableHead onClick={() => requestSort('service')} className="cursor-pointer">
                                <div className="flex items-center">{t('service')} {getSortIcon('service')}</div>
                                </TableHead>
                                <TableHead onClick={() => requestSort('version')} className="cursor-pointer">
                                <div className="flex items-center">{t('version')} {getSortIcon('version')}</div>
                                </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedPorts.map((port, index) => (
                                <TableRow key={`${port.portid}-${index}`}>
                                    <TableCell>
                                    <Badge variant="secondary">{port.portid}/{port.protocol}</Badge>
                                    </TableCell>
                                    <TableCell>{port.service?.name || 'unknown'}</TableCell>
                                    <TableCell className="truncate max-w-[150px] sm:max-w-[200px]">{port.service?.product}{port.service?.version ? ` (${port.service.version})` : ''}</TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>CVEs</CardTitle>
                    <CardDescription>
                        {locale === 'es' ? 'Vulnerabilidades y Exposiciones Comunes identificadas para este host.' : 'Common Vulnerabilities and Exposures identified for this host.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <CveDetails host={hostData} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                     <CardTitle>{locale === 'es' ? 'Scripts NSE' : 'NSE Scripts'} ({hostScripts.length})</CardTitle>
                </CardHeader>
                <CardContent>
                {hostScripts.length > 0 ? (
                    <div className="space-y-4">
                        {hostScripts.map((script: Script, index: number) => (
                            <div key={`${script.id}-${index}`}>
                                <h4 className="font-semibold">{script.id}</h4>
                                <pre className="mt-2 rounded-md bg-muted p-4 text-xs font-code overflow-x-auto">
                                    <code>{script.output.replace(/&#xa;/g, '\n')}</code>
                                </pre>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground text-center">{t('noNseScripts')}</p>
                )}
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>
                        {locale === 'es' 
                            ? 'Resumen de Scripts NSE' 
                            : 'AI-Powered NSE Script Summary'
                        }
                    </CardTitle>
                    <CardDescription>
                        {locale === 'es' 
                            ? 'Resumen con IA de la información recopilada' 
                            : 'AI summary of the collected information'
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <NseSummary host={hostData} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('nextStepsTitle')}</CardTitle>
                     <CardDescription>
                        {locale === 'es' 
                            ? "Sugerencias generadas por IA para pruebas de penetración."
                            : "AI-generated suggestions for penetration testing."
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <PentestingNextSteps host={hostData} />
                </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-1 h-full">
            <div className="lg:sticky lg:top-8 space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('riskAnalysisTitle')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-baseline">
                            <span className="text-sm text-muted-foreground">{t('riskScore')}</span>
                            <Badge variant="default" className={cn('border-transparent text-lg', getRiskColorClass(riskScore))}>
                                {(riskScore ?? 0).toFixed(0)} / 100
                            </Badge>
                        </div>
                        <VulnerabilityExplanation host={hostData} />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>{tDetails('os')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm">{osName}</p>
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
    </>
  );
}
