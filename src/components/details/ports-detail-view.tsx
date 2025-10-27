
'use client';

import React, { useState, useMemo } from 'react';
import type { Host, Port } from '@/types/nmap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTranslations } from 'next-intl';
import { ArrowUpDown } from 'lucide-react';
import { calculatePortRiskScore } from '@/lib/risk-scorer';
import { useScanStore } from '@/store/use-scan-store';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { useRouter } from '@/navigation';

interface ServiceData {
    name: string;
    product: string;
    version: string;
    hostAddress: string;
    port: Port;
}

type SortableKeys = 'hostIp' | 'port' | 'service' | 'product' | 'version' | 'riskScore';
type SortDirection = 'ascending' | 'descending';

const ipToNumber = (ip: string) => {
    return ip.split('.').reduce((acc, octet, index) => acc + parseInt(octet) * Math.pow(256, 3 - index), 0);
};

const getRiskColorClass = (score: number): string => {
    if (score >= 90) return 'bg-red-600 hover:bg-red-700 text-white';
    if (score >= 75) return 'bg-orange-500 hover:bg-orange-600 text-white';
    if (score >= 40) return 'bg-yellow-500 hover:bg-yellow-600 text-black';
    if (score > 0) return 'bg-green-500 hover:bg-green-600 text-white';
    return 'bg-gray-400 hover:bg-gray-500 text-white';
};

export default function ServicesDetailView({ hosts }: { hosts: Host[] }) {
  const t = useTranslations('DetailsPage');
  const { riskWeights, hostFilter } = useScanStore();
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: SortDirection } | null>({ key: 'riskScore', direction: 'descending' });
  const router = useRouter();
  
  const allServices = React.useMemo(() => {
    const services: ServiceData[] = [];
    hosts.forEach(host => {
      if (host.ports && host.ports.port) {
        const hostPorts = Array.isArray(host.ports.port) ? host.ports.port : [host.ports.port];
        hostPorts.filter(p => p.state.state === 'open' && p.service).forEach(p => {
          services.push({
            name: p.service!.name,
            product: p.service!.product || '',
            version: p.service!.version || '',
            hostAddress: host.address[0].addr,
            port: p
          });
        });
      }
    });
    return services;
  }, [hosts]);

  const filteredServices = useMemo(() => {
    if (!hostFilter) return allServices;
    return allServices.filter(s => s.hostAddress === hostFilter);
  }, [allServices, hostFilter]);

  const sortedServices = useMemo(() => {
    let sortableItems = [...filteredServices];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: string | number;
        let bValue: string | number;

        switch(sortConfig.key) {
          case 'hostIp':
            aValue = ipToNumber(a.hostAddress);
            bValue = ipToNumber(b.hostAddress);
            break;
          case 'port':
            aValue = parseInt(a.port.portid);
            bValue = parseInt(b.port.portid);
            break;
          case 'service':
            aValue = a.name;
            bValue = b.name;
            break;
          case 'product':
            aValue = a.product;
            bValue = b.product;
            break;
          case 'version':
            aValue = a.version;
            bValue = b.version;
            break;
          case 'riskScore':
            aValue = calculatePortRiskScore(a.port, riskWeights);
            bValue = calculatePortRiskScore(b.port, riskWeights);
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
  }, [filteredServices, sortConfig, riskWeights]);

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

  const serviceDistribution = React.useMemo(() => {
    const counts: { [key: string]: number } = {};
    filteredServices.forEach(s => {
        counts[s.name] = (counts[s.name] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 10).reverse();
  }, [filteredServices]);
  
  const riskScoreTitle = useTranslations('HostsTable')('riskScore');
  const numberOfHostsTitle = t('numberOfHosts');

  const handleRowClick = (hostIp: string) => {
    router.push(`/details/host/${hostIp}`);
  };
  
  const chartHeight = serviceDistribution.length * 40 + 60;

  return (
    <div className="space-y-8 w-full">
      <Card>
        <CardHeader>
          <CardTitle>{t('serviceDistributionTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div id="service-distribution-chart">
            <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart
                    data={serviceDistribution}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={80} interval={0} fontSize={12} />
                    <Tooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', borderRadius: 'var(--radius)', border: '1px solid hsl(var(--border))'}} />
                    <Bar dataKey="value" name={numberOfHostsTitle} fill="hsl(var(--primary))" barSize={20} />
                </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('allServicesTitle', {count: filteredServices.length})}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead onClick={() => requestSort('hostIp')} className="cursor-pointer">
                    <div className="flex items-center">{t('hostIp')} {getSortIcon('hostIp')}</div>
                  </TableHead>
                  <TableHead onClick={() => requestSort('port')} className="cursor-pointer hidden sm:table-cell">
                    <div className="flex items-center">{t('port')} {getSortIcon('port')}</div>
                  </TableHead>
                  <TableHead onClick={() => requestSort('service')} className="cursor-pointer">
                    <div className="flex items-center">{t('service')} {getSortIcon('service')}</div>
                  </TableHead>
                  <TableHead onClick={() => requestSort('product')} className="cursor-pointer hidden md:table-cell">
                    <div className="flex items-center">{t('product')} {getSortIcon('product')}</div>
                  </TableHead>
                  <TableHead onClick={() => requestSort('version')} className="cursor-pointer hidden lg:table-cell">
                    <div className="flex items-center">{t('version')} {getSortIcon('version')}</div>
                  </TableHead>
                  <TableHead onClick={() => requestSort('riskScore')} className="text-right cursor-pointer">
                    <div className="flex items-center justify-end">{riskScoreTitle} {getSortIcon('riskScore')}</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedServices.map((service, index) => {
                  const portRisk = calculatePortRiskScore(service.port, riskWeights);
                  return (
                    <TableRow key={`${service.hostAddress}-${service.port.portid}-${index}`} onClick={() => handleRowClick(service.hostAddress)} className="cursor-pointer">
                      <TableCell className="font-mono">{service.hostAddress}</TableCell>
                      <TableCell className="hidden sm:table-cell">{service.port.portid}</TableCell>
                      <TableCell>{service.name}</TableCell>
                      <TableCell className="hidden md:table-cell">{service.product}</TableCell>
                      <TableCell className="hidden lg:table-cell">{service.version}</TableCell>
                      <TableCell className="text-right">
                          <Badge variant="default" className={cn('border-transparent', getRiskColorClass(portRisk))}>
                              {portRisk.toFixed(0)}
                          </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
