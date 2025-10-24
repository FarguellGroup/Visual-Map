
'use client';

import { useScanStore } from '@/store/use-scan-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Server, ShieldCheck, DoorOpen, AlertTriangle, Skull } from 'lucide-react';
import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/navigation';

export default function SummaryCards() {
  const { scanResult, cveCache } = useScanStore();
  const t = useTranslations('SummaryCards');
  const locale = useLocale();

  const summary = React.useMemo(() => {
    if (!scanResult) return { hostCount: 0, totalOpenPorts: 0, uniqueServices: 0, topVulnerableCount: 0, totalCves: 0 };
    
    const hosts = scanResult.hosts;
    const hostCount = hosts.length;
    
    let totalOpenPorts = 0;
    const services = new Set<string>();
    
    hosts.forEach(host => {
      if (host.ports && host.ports.port) {
        const ports = Array.isArray(host.ports.port) ? host.ports.port : [host.ports.port];
        ports.forEach(port => {
          if (port.state.state === 'open') {
            totalOpenPorts++;
            if (port.service?.name) {
              services.add(port.service.name);
            }
          }
        });
      }
    });

    const topVulnerableCount = hosts.filter(h => (h.riskScore ?? 0) >= 75).length;
    
    const allCves = Array.from(cveCache.values())
      .filter(entry => entry.status === 'loaded' && entry.data)
      .flatMap(entry => entry.data!);
    
    const uniqueCveIds = new Set(allCves.map(cveItem => cveItem.cve.cveId));

    return {
      hostCount,
      totalOpenPorts,
      uniqueServices: services.size,
      topVulnerableCount,
      totalCves: uniqueCveIds.size,
    };
  }, [scanResult, cveCache]);

  if (!scanResult) return null;

  const cardClassName = "transition-all duration-200 hover:bg-muted/50 hover:shadow-md border";
  const gridColsClass = "lg:grid-cols-5";

  const discoveredCvesTitle = locale === 'es' ? 'CVEs Descubiertos' : 'Discovered CVEs';
  const discoveredCvesDescription = locale === 'es' ? 'vulnerabilidades encontradas' : 'vulnerabilities found';

  return (
    <div className={`grid gap-4 md:grid-cols-2 ${gridColsClass}`}>
      <Link href="/details/hosts" className="block group">
        <Card className={`${cardClassName} hover:border-primary`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium transition-colors group-hover:text-primary">{t('totalHosts')}</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.hostCount}</div>
            <p className="text-xs text-muted-foreground">{t('totalHostsDescription')}</p>
          </CardContent>
        </Card>
      </Link>
      <Link href="/details/ports" className="block group">
        <Card className={`${cardClassName} hover:border-primary`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium transition-colors group-hover:text-primary">{t('openPorts')}</CardTitle>
            <DoorOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalOpenPorts}</div>
            <p className="text-xs text-muted-foreground">{t('openPortsDescription')}</p>
          </CardContent>
        </Card>
      </Link>
      <Link href="/details/services" className="block group">
        <Card className={`${cardClassName} hover:border-primary`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium transition-colors group-hover:text-primary">{t('uniqueServices')}</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.uniqueServices}</div>
            <p className="text-xs text-muted-foreground">{t('uniqueServicesDescription')}</p>
          </CardContent>
        </Card>
      </Link>
       <Link href="/details/vulnerabilities" className="block group">
          <Card className={`${cardClassName} hover:border-destructive hover:bg-destructive/10`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium transition-colors group-hover:text-destructive">{discoveredCvesTitle}</CardTitle>
              <Skull className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{summary.totalCves}</div>
              <p className="text-xs text-muted-foreground">{discoveredCvesDescription}</p>
            </CardContent>
          </Card>
       </Link>
      <Link href="/details/vulnerable-hosts" className="block group/danger">
       <Card className={`${cardClassName} hover:border-destructive hover:bg-destructive/10`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium transition-colors group-hover/danger:text-destructive">{t('highRiskHosts')}</CardTitle>
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">{summary.topVulnerableCount}</div>
          <p className="text-xs text-muted-foreground">{t('highRiskHostsDescription')}</p>
        </CardContent>
      </Card>
      </Link>
    </div>
  );
}
