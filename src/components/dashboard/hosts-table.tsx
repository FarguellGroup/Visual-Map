'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useScanStore } from '@/store/use-scan-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Host } from '@/types/nmap';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/navigation';
import { cn } from '@/lib/utils';
import { getHostname, getOsName } from '@/lib/nmap-parser';

const getOpenPortsCount = (host: Host) => {
  if (!host.ports || !host.ports.port) return 0;
  const ports = Array.isArray(host.ports.port) ? host.ports.port : [host.ports.port];
  return ports.filter(p => p.state.state === 'open').length;
};

const getRiskColorClass = (score: number): string => {
    if (score >= 90) return 'bg-red-600 hover:bg-red-700 text-white';
    if (score >= 75) return 'bg-orange-500 hover:bg-orange-600 text-white';
    if (score >= 40) return 'bg-yellow-500 hover:bg-yellow-600 text-black';
    if (score > 0) return 'bg-green-500 hover:bg-green-600 text-white';
    return 'bg-gray-400 hover:bg-gray-500 text-white';
};

type SortableKeys = 'ipAddress' | 'hostname' | 'os' | 'openPorts' | 'riskScore';
type SortDirection = 'ascending' | 'descending';

const ROWS_PER_PAGE = 10;

const ipToNumber = (ip: string) => {
    return ip.split('.').reduce((acc, octet, index) => acc + parseInt(octet) * Math.pow(256, 3 - index), 0);
};

export default function HostsTable() {
  const { scanResult } = useScanStore();
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: SortDirection } | null>({key: 'riskScore', direction: 'descending'});
  const t = useTranslations('HostsTable');
  const tPagination = useTranslations('Pagination');
  const tDetails = useTranslations('DetailsPage');
  const router = useRouter();

  const hostData = useMemo(() => {
    if (!scanResult?.hosts) {
      return [];
    }
    return scanResult.hosts.map(host => ({
      ...host,
      hostname: getHostname(host),
      osName: getOsName(host),
    }));
  }, [scanResult?.hosts]);

  const sortedHosts = useMemo(() => {
    if (!hostData) return [];
    let sortableItems = [...hostData];
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
  }, [hostData, sortConfig]);

  if (!scanResult) return null;

  const hosts = sortedHosts;
  const totalPages = Math.ceil(hosts.length / ROWS_PER_PAGE);
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const endIndex = startIndex + ROWS_PER_PAGE;
  const currentHosts = hosts.slice(startIndex, endIndex);

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
    if (sortConfig.direction === 'ascending') {
      return <ArrowUpDown className="ml-2 h-4 w-4" />; // Could be ArrowUp
    }
    return <ArrowUpDown className="ml-2 h-4 w-4" />; // Could be ArrowDown
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleRowClick = (host: Host) => {
    router.push(`/details/host/${host.address[0].addr}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-primary">{t('title')} ({hosts.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
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
              {currentHosts.map((host: any, index: number) => (
                <TableRow
                  key={`${host.address[0].addr}-${index}`}
                  onClick={() => handleRowClick(host)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-mono font-medium">{host.address[0].addr}</TableCell>
                  <TableCell className="truncate max-w-[200px] hidden md:table-cell">{host.hostname}</TableCell>
                  <TableCell className="truncate max-w-[200px] hidden lg:table-cell">{host.osName}</TableCell>
                  <TableCell className="text-center">{getOpenPortsCount(host)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="default" className={cn('border-transparent', getRiskColorClass(host.riskScore ?? 0))}>
                        {host.riskScore?.toFixed(0) ?? 'N/A'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-end space-x-2 py-4">
          <span className="text-sm text-muted-foreground">
            {t('page', { currentPage, totalPages })}
          </span>
          <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}>
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">{tPagination('previous')}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>
            <span className="sr-only">{tPagination('next')}</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
