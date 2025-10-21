'use client';

import React, { useMemo, useState } from 'react';
import type { Host } from '@/types/nmap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/navigation';
import { cn } from '@/lib/utils';
import { ArrowUpDown } from 'lucide-react';
import { getHostname, getOsName } from '@/lib/nmap-parser';

const getRiskColorClass = (score: number): string => {
    if (score >= 75) return 'bg-red-600 hover:bg-red-700 text-white';
    if (score >= 40) return 'bg-yellow-500 hover:bg-yellow-600 text-black';
    if (score > 0) return 'bg-green-500 hover:bg-green-600 text-white';
    return 'bg-gray-400 hover:bg-gray-500 text-white';
};

const getOpenPortsCount = (host: Host) => {
    if (!host.ports || !host.ports.port) return 0;
    const ports = Array.isArray(host.ports.port) ? host.ports.port : [host.ports.port];
    return ports.filter(p => p.state.state === 'open').length;
};

type SortableKeys = 'ipAddress' | 'hostname' | 'os' | 'openPorts' | 'riskScore';
type SortDirection = 'ascending' | 'descending';

const ipToNumber = (ip: string) => {
    return ip.split('.').reduce((acc, octet, index) => acc + parseInt(octet) * Math.pow(256, 3 - index), 0);
};

export default function VulnerabilitiesDetailView({ hosts }: { hosts: Host[] }) {
    const t = useTranslations('DetailsPage');
    const tHostsTable = useTranslations('HostsTable');
    const router = useRouter();
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: SortDirection }>({ key: 'riskScore', direction: 'descending' });
    const locale = useLocale();

    const hostData = useMemo(() => {
      if (!hosts) {
        return [];
      }
      return hosts.map(host => ({
        ...host,
        hostname: getHostname(host),
        osName: getOsName(host),
      }));
    }, [hosts]);


    const vulnerableHosts = useMemo(() => 
        hostData.filter(h => (h.riskScore ?? 0) >= 70)
    , [hostData]);

    const sortedVulnerableHosts = useMemo(() => {
        let sortableItems = [...vulnerableHosts];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let aValue: string | number;
                let bValue: string | number;

                switch (sortConfig.key) {
                    case 'ipAddress':
                        aValue = ipToNumber(a.address[0].addr);
                        bValue = ipToNumber(b.address[0].addr);
                        break;
                    case 'hostname':
                        aValue = a.hostname;
                        bValue = b.hostname;
                        break;
                    case 'os':
                        aValue = a.osName;
                        bValue = b.osName;
                        break;
                    case 'openPorts':
                        aValue = getOpenPortsCount(a);
                        bValue = getOpenPortsCount(b);
                        break;
                    case 'riskScore':
                        aValue = a.riskScore ?? 0;
                        bValue = b.riskScore ?? 0;
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
    }, [vulnerableHosts, sortConfig]);

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

    const riskDistribution = useMemo(() => {
        const highRisk = hosts.filter(h => (h.riskScore ?? 0) >= 75).length;
        const mediumRisk = hosts.filter(h => (h.riskScore ?? 0) >= 40 && (h.riskScore ?? 0) < 75).length;
        const lowRisk = hosts.filter(h => (h.riskScore ?? 0) > 0 && (h.riskScore ?? 0) < 40).length;
        const veryLowRisk = hosts.filter(h => (h.riskScore ?? 0) === 0).length;
        
        return [
            { name: locale === 'es' ? 'Riesgo Muy Bajo' : 'Very Low Risk', count: veryLowRisk, fill: '#6B7280' },
            { name: locale === 'es' ? 'Riesgo Bajo' : 'Low Risk', count: lowRisk, fill: '#FBBF24' },
            { name: locale === 'es' ? 'Riesgo Medio' : 'Medium Risk', count: mediumRisk, fill: '#F97316' },
            { name: locale === 'es' ? 'Riesgo Alto' : 'High Risk', count: highRisk, fill: '#EF4444' },
        ].filter(item => item.count > 0);
    }, [hosts, locale]);

    const handleRowClick = (host: Host) => {
      router.push(`/details/host/${host.address[0].addr}`);
    };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>{t('hostRiskDistributionTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div id="risk-distribution-chart">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart layout="vertical" data={riskDistribution} margin={{left: 20}}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={80} fontSize={12} />
                <Tooltip cursor={{fill: 'hsl(var(--muted))'}} />
                <Bar dataKey="count" name={t('numberOfHosts')} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('vulnerableHostsTitle', {count: vulnerableHosts.length})}</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="overflow-x-auto">
             <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead onClick={() => requestSort('ipAddress')} className="cursor-pointer">
                            <div className="flex items-center">{tHostsTable('ipAddress')} {getSortIcon('ipAddress')}</div>
                        </TableHead>
                        <TableHead onClick={() => requestSort('hostname')} className="cursor-pointer hidden md:table-cell">
                            <div className="flex items-center">{tHostsTable('hostname')} {getSortIcon('hostname')}</div>
                        </TableHead>
                        <TableHead onClick={() => requestSort('os')} className="cursor-pointer hidden lg:table-cell">
                            <div className="flex items-center">{t('os')} {getSortIcon('os')}</div>
                        </TableHead>
                        <TableHead onClick={() => requestSort('openPorts')} className="text-center cursor-pointer">
                            <div className="flex items-center justify-center">{tHostsTable('openPorts')} {getSortIcon('openPorts')}</div>
                        </TableHead>
                        <TableHead onClick={() => requestSort('riskScore')} className="text-right cursor-pointer">
                            <div className="flex items-center justify-end">{tHostsTable('riskScore')} {getSortIcon('riskScore')}</div>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedVulnerableHosts.map((host, index) => (
                         <TableRow key={`${host.address[0].addr}-${index}`} onClick={() => handleRowClick(host)} className="cursor-pointer">
                            <TableCell className="font-mono">{host.address[0].addr}</TableCell>
                            <TableCell className="hidden md:table-cell">{host.hostname}</TableCell>
                            <TableCell className="hidden lg:table-cell">{host.osName}</TableCell>
                            <TableCell className="text-center">{getOpenPortsCount(host)}</TableCell>
                            <TableCell className="text-right">
                                <Badge variant="default" className={cn('border-transparent', getRiskColorClass(host.riskScore ?? 0))}>
                                    {host.riskScore?.toFixed(0)}
                                </Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
