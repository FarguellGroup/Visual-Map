
'use client';

import React, { useMemo, useState } from 'react';
import type { Host, Port, Service } from '@/types/nmap';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/navigation';
import { cn } from '@/lib/utils';
import { ArrowUpDown, ShieldX, Search } from 'lucide-react';
import { useScanStore } from '@/store/use-scan-store';
import { Progress } from '../ui/progress';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '../ui/button';

const getCveRiskColorClass = (score: number | string | null): string => {
    const numericScore = typeof score === 'string' ? parseFloat(score) : score;
    if (numericScore === null || isNaN(numericScore)) return 'bg-gray-400';
    if (numericScore >= 9.0) return 'bg-red-600 text-white';
    if (numericScore >= 7.0) return 'bg-orange-500 text-white';
    if (numericScore >= 4.0) return 'bg-yellow-500 text-black';
    return 'bg-green-500 text-white';
};

const COLORS = [
    'hsl(var(--chart-1))', '#82ca9d', '#ffc658', '#ff8042', 'hsl(var(--chart-2))'
];

type SortDirection = 'ascending' | 'descending';
type SortableKeys = 'service' | 'cveId' | 'cvssScore' | 'hostIp';

const ipToNumber = (ip: string) => {
    return ip.split('.').reduce((acc, octet, index) => acc + parseInt(octet) * Math.pow(256, 3 - index), 0);
};

export default function ThreatsDetailView({ hosts, pdfMode = false, forceId }: { hosts: Host[], pdfMode?: boolean, forceId?: string }) {
    const t = useTranslations('DetailsPage');
    const router = useRouter();
    const locale = useLocale();
    
    const { 
        cveCache, 
        fetchCvesForHost, 
        cveScanProgress,
        isCveScanRunning,
        scanResult,
        setScanResult,
        riskWeights,
    } = useScanStore();
    
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: SortDirection } | null>({ key: 'cvssScore', direction: 'descending' });

    const handleFetchAllCves = () => {
        fetchCvesForHost(hosts, locale);
    };

    const { allFoundCves, vulnerableServices, serviceDistribution, hasUnscannedHosts } = useMemo(() => {
        if (!cveCache) {
             return { allFoundCves: [], vulnerableServices: [], serviceDistribution: [], hasUnscannedHosts: true };
        }
        let allCves: { host: Host, service: Service, portId: string, cve: any }[] = [];
        let servicesWithCves = new Map<string, { service: Service, cves: any[], hostCount: number, hosts: Set<string> }>();
        let unscannedCount = 0;

        hosts.forEach(host => {
            const cveEntry = cveCache.get(host.address[0].addr);
            if (!cveEntry) {
                unscannedCount++;
            }
            if (cveEntry?.status === 'loaded' && cveEntry.data) {
                cveEntry.data.forEach(cveItem => {
                    allCves.push({ host, service: cveItem.service, portId: cveItem.portId, cve: cveItem.cve });
                    const serviceKey = `${cveItem.service.product}@${cveItem.service.version}`;
                    if (!servicesWithCves.has(serviceKey)) {
                        servicesWithCves.set(serviceKey, { service: cveItem.service, cves: [], hostCount: 0, hosts: new Set() });
                    }
                    const entry = servicesWithCves.get(serviceKey)!;
                    entry.cves.push(cveItem.cve);
                    entry.hosts.add(host.address[0].addr);
                    entry.hostCount = entry.hosts.size;
                });
            }
        });
        
        const vulnerableServices = Array.from(servicesWithCves.values()).sort((a, b) => b.cves.length - a.cves.length);
        
        const serviceCounts: { [key: string]: number } = {};
        vulnerableServices.forEach(item => {
            if (item.service.name) {
                serviceCounts[item.service.name] = (serviceCounts[item.service.name] || 0) + 1;
            }
        });
        const serviceDistribution = Object.entries(serviceCounts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5);
        
        const hasUnscanned = hosts.some(host => !cveCache.has(host.address[0].addr));

        return { 
            allFoundCves: allCves, 
            vulnerableServices, 
            serviceDistribution,
            hasUnscannedHosts: hasUnscanned
        };
    }, [hosts, cveCache]);
    
    React.useEffect(() => {
        if (cveScanProgress?.isComplete && scanResult) {
            setScanResult(scanResult.fileName, scanResult.originalHosts, riskWeights, false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cveScanProgress, scanResult, riskWeights]);


    const sortedCves = useMemo(() => {
        let sortableItems = [...allFoundCves];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let aValue: string | number;
                let bValue: string | number;

                switch (sortConfig.key) {
                    case 'service':
                        aValue = `${a.service.product} ${a.service.version}`.trim().toLowerCase();
                        bValue = `${b.service.product} ${b.service.version}`.trim().toLowerCase();
                        break;
                    case 'cveId':
                        aValue = a.cve.cveId.toLowerCase();
                        bValue = b.cve.cveId.toLowerCase();
                        break;
                    case 'cvssScore':
                        aValue = a.cve.cvssScore !== null ? parseFloat(a.cve.cvssScore) : -1;
                        bValue = b.cve.cvssScore !== null ? parseFloat(b.cve.cvssScore) : -1;
                        if (isNaN(aValue)) aValue = -1;
                        if (isNaN(bValue)) bValue = -1;
                        break;
                    case 'hostIp':
                        aValue = ipToNumber(a.host.address[0].addr);
                        bValue = ipToNumber(b.host.address[0].addr);
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
    }, [allFoundCves, sortConfig]);

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

    const handleRowClick = (hostIp: string) => {
        router.push(`/details/host/${hostIp}`);
    };

    const cvesTitle = locale === 'es' ? 'CVEs Descubiertos' : 'Discovered CVEs';
    const cvesDescription = locale === 'es' ? 'Busca vulnerabilidades y CVEs en los hosts descubiertos mediante IA.' : 'Search for vulnerabilities and CVEs on discovered hosts using AI.';
    const vulnerableServicesTitle = locale === 'es' ? 'Principales Servicios Vulnerables' : 'Top Vulnerable Services';
    const serviceTitle = t('service');
    const hostCountTitle = t('hostCount');
    const cveCountTitle = locale === 'es' ? 'CVEs' : 'CVEs';
    const cvssScoreTitle = locale === 'es' ? 'Puntaje CVSS' : 'CVSS Score';
    const noCvesFound = locale === 'es' ? 'No se encontraron CVEs para los servicios detectados en este escaneo.' : 'No CVEs found for the detected services in this scan.';
    const vulnerableServicesDistributionTitle = locale === 'es' ? 'Distribución de Servicios Vulnerables' : 'Vulnerable Services Distribution';
    const analyzingText = cveScanProgress?.total > 0 
        ? (locale === 'es' ? `Analizando servicios expuestos... ${cveScanProgress.processed} de ${cveScanProgress.total}` : `Analyzing exposed services... ${cveScanProgress.processed} of ${cveScanProgress.total}`)
        : (locale === 'es' ? 'Preparando análisis...' : 'Preparing analysis...');
    
    const showGlobalScanButton = hasUnscannedHosts && !isCveScanRunning;
    const chartId = forceId || (pdfMode ? 'pdf-threat-service-dist-chart' : 'threat-service-dist-chart');


  return (
    <div className="space-y-8">
        <Card>
            <CardHeader className="flex flex-row items-start justify-between">
                <div>
                    <CardTitle>{cvesTitle}</CardTitle>
                    <CardDescription>{cvesDescription}</CardDescription>
                </div>
                {showGlobalScanButton && (
                     <Button onClick={handleFetchAllCves} size="sm">
                       <Search className="mr-2 h-4 w-4" />
                       {locale === 'es' ? 'Buscar CVEs' : 'Search CVEs'}
                     </Button>
                )}
            </CardHeader>
             {(isCveScanRunning || (cveScanProgress && cveScanProgress.total > 0)) && !cveScanProgress?.isComplete && (
                    <CardContent className='pt-2 space-y-2'>
                        <Progress value={(cveScanProgress.processed / (cveScanProgress.total || 1)) * 100} className="w-full" />
                        <p className='text-sm text-muted-foreground text-center'>{analyzingText}</p>
                    </CardContent>
                )}
            
            <CardContent>
                {sortedCves.length > 0 ? (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead onClick={() => requestSort('service')} className="cursor-pointer">
                                        <div className="flex items-center">{serviceTitle} {getSortIcon('service')}</div>
                                    </TableHead>
                                    <TableHead onClick={() => requestSort('cveId')} className="cursor-pointer">
                                        <div className="flex items-center">CVE ID {getSortIcon('cveId')}</div>
                                    </TableHead>
                                    <TableHead onClick={() => requestSort('cvssScore')} className="cursor-pointer">
                                        <div className="flex items-center">{cvssScoreTitle} {getSortIcon('cvssScore')}</div>
                                    </TableHead>
                                    <TableHead onClick={() => requestSort('hostIp')} className="cursor-pointer">
                                        <div className="flex items-center">{t('hostIp')} {getSortIcon('hostIp')}</div>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedCves.map((item, index) => {
                                    const score = item.cve.cvssScore !== null ? parseFloat(item.cve.cvssScore) : null;
                                    const displayScore = score !== null && !isNaN(score) ? score.toFixed(1) : 'N/A';
                                    return (
                                        <TableRow key={index} onClick={() => handleRowClick(item.host.address[0].addr)} className="cursor-pointer">
                                            <TableCell className="font-medium">{item.service.product} {item.service.version}</TableCell>
                                            <TableCell>
                                                <a href={`https://nvd.nist.gov/vuln/detail/${item.cve.cveId}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                                                    {item.cve.cveId}
                                                </a>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="default" className={cn("border-transparent", getCveRiskColorClass(score))}>
                                                    {displayScore}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono">{item.host.address[0].addr}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center space-y-3 p-4 text-center min-h-[150px]">
                        {isCveScanRunning ? null : cveScanProgress?.isComplete ? (
                           <>
                            <ShieldX className="h-8 w-8 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">{noCvesFound}</p>
                           </>
                        ) : (
                             <p className="text-sm text-muted-foreground">
                                {locale === 'es' ? 'Inicia un escaneo para detectar CVEs en todos los hosts.' : 'Start a scan to detect CVEs on all hosts.'}
                             </p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>

        {vulnerableServices.length > 0 && (
            <>
                <Card>
                    <CardHeader>
                    <CardTitle>{vulnerableServicesDistributionTitle}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div id={chartId} className={pdfMode ? 'w-[800px] h-[300px]' : ''}>
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie data={serviceDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
                                        {serviceDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>{vulnerableServicesTitle} ({vulnerableServices.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{serviceTitle}</TableHead>
                                        <TableHead>{hostCountTitle}</TableHead>
                                        <TableHead>{cveCountTitle}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {vulnerableServices.map((item, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="font-medium">{item.service.product} {item.service.version}</TableCell>
                                            <TableCell>{item.hostCount}</TableCell>
                                            <TableCell>{item.cves.length}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </>
        )}
    </div>
  );
}

    
