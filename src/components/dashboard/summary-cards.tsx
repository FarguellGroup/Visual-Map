
'use client';

import { useScanStore } from '@/store/use-scan-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Server, ShieldCheck, DoorOpen, AlertTriangle } from 'lucide-react';
import React from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';

export default function SummaryCards() {
  const { scanResult } = useScanStore();
  const t = useTranslations('SummaryCards');

  const summary = React.useMemo(() => {
    if (!scanResult) return { hostCount: 0, totalOpenPorts: 0, uniqueServices: 0, topVulnerableCount: 0 };
    
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

    return {
      hostCount,
      totalOpenPorts,
      uniqueServices: services.size,
      topVulnerableCount
    };
  }, [scanResult]);

  if (!scanResult) return null;

  const cardClassName = "transition-all duration-200 hover:bg-muted/50 hover:shadow-md border";

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
      <Link href="/details/vulnerable-hosts" className="block group/danger">
       <Card className={`${cardClassName} hover:border-destructive`}>
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
