
'use client';

import React, { useState, useMemo } from 'react';
import type { Host } from '@/types/nmap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/navigation';
import { ArrowUpDown, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getHostname, getOsName } from '@/lib/nmap-parser';
import { useScanStore } from '@/store/use-scan-store';

const getRiskColorClass = (score: number): string => {
    if (score >= 90) return 'bg-red-600 hover:bg-red-700 text-white';
    if (score >= 75) return 'bg-orange-500 hover:bg-orange-600 text-white';
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

export default function HostsDetailView({ hosts }: { hosts: Host[] }) {
  const t = useTranslations('HostsTable');
  const tDetails = useTranslations('DetailsPage');
  const router = useRouter();
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: SortDirection } | null>(null);

  const { hostFilter } = useScanStore();

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

  const filteredHostData = useMemo(() => {
    if (!hostFilter) return hostData;
    return hostData.filter(h => h.address[0].addr === hostFilter);
  }, [hostData, hostFilter]);

  const sortedHosts = useMemo(() => {
    let sortableItems = [...filteredHostData];
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
  }, [filteredHostData, sortConfig]);

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

  const handleRowClick = (host: Host) => {
    router.push(`/details/host/${host.address[0].addr}`);
  };

  return (
    <div className="w-full">
        <Card>
            <CardHeader>
                <CardTitle>{tDetails('hostsDetected', {count: filteredHostData.length})}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead onClick={() => requestSort('ipAddress')} className="cursor-pointer">
                                    <div className="flex items-center">{t('ipAddress')} {getSortIcon('ipAddress')}</div>
                                </TableHead>
                                <TableHead onClick={() => requestSort('hostname')} className="cursor-pointer hidden md:table-cell">
                                    <div className="flex items-center">{t('hostname')} {getSortIcon('hostname')}</div>
                                </TableHead>
                                <TableHead onClick={() => requestSort('os')} className="cursor-pointer hidden lg:table-cell">
                                    <div className="flex items-center">{tDetails('os')} {getSortIcon('os')}</div>
                                </TableHead>
                                <TableHead onClick={() => requestSort('openPorts')} className="text-center cursor-pointer">
                                    <div className="flex items-center justify-center">{t('openPorts')} {getSortIcon('openPorts')}</div>
                                </TableHead>
                                <TableHead onClick={() => requestSort('riskScore')} className="text-right cursor-pointer">
                                    <div className="flex items-center justify-end">{t('riskScore')} {getSortIcon('riskScore')}</div>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedHosts.map((host) => (
                            <TableRow key={host.address[0].addr} onClick={() => handleRowClick(host)} className="cursor-pointer">
                                <TableCell className="font-mono">{host.address[0].addr}</TableCell>
                                <TableCell className='hidden md:table-cell'>{host.hostname}</TableCell>
                                <TableCell className='hidden lg:table-cell'>{host.osName}</TableCell>
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
