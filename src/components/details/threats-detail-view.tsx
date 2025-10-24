
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import type { Host, Port, Service } from '@/types/nmap';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, Link } from '@/navigation';
import { cn } from '@/lib/utils';
import { ArrowUpDown, ShieldX, Search, RotateCw, Settings, Pause, Play, AlertCircle, Info, Group } from 'lucide-react';
import { useScanStore } from '@/store/use-scan-store';
import { Progress } from '../ui/progress';
import { PieChart, Pie, Cell, Legend, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Button } from '../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { getHostname } from '@/lib/nmap-parser';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
type SortableKeys = 'cveId' | 'cvssScore' | 'affectedHost' | 'service';

const ipToNumber = (ip: string) => {
    return ip.split('.').reduce((acc, octet, index) => acc + parseInt(octet) * Math.pow(256, 3 - index), 0);
};

const ResumeScanButton = () => {
    const locale = useLocale();
    const { fetchCvesForHost, remainingHostsToScan } = useScanStore();
    const [countdown, setCountdown] = useState(60);

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const handleResume = () => {
        if (remainingHostsToScan.length > 0) {
            fetchCvesForHost(remainingHostsToScan, locale);
        }
    };
    
    const resumeButtonText = locale === 'es' ? 'Reanudar Escaneo' : 'Resume Scan';
    const waitingText = locale === 'es' ? `(Espere ${countdown}s)` : `(Wait ${countdown}s)`;

    return (
        <div className='flex items-center justify-center gap-4 my-4'>
            <Button onClick={handleResume} disabled={countdown > 0}>
                <RotateCw className="mr-2 h-4 w-4" />
                {resumeButtonText} {countdown > 0 && waitingText}
            </Button>
        </div>
    )
}

export default function ThreatsDetailView({ hosts, pdfMode = false, forceId }: { hosts: Host[], pdfMode?: boolean, forceId?: string }) {
    const t = useTranslations('DetailsPage');
    const router = useRouter();
    const locale = useLocale();
    
    const { 
        cveCache, 
        fetchCvesForHost, 
        pauseCveScan,
        cveScanProgress,
        isCveScanRunning,
        isCveScanPaused,
        scanResult,
        setScanResult,
        riskWeights,
        apiError,
    } = useScanStore();
    
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: SortDirection }>({ key: 'cvssScore', direction: 'descending' });
    const [selectedHostIp, setSelectedHostIp] = useState<string>('all');

    const handleFetchAllCves = () => {
        fetchCvesForHost(hosts, locale);
    };

    const handleConfigureApi = () => {
        router.push('/details/api');
    };

    const handleResumeScan = () => {
      fetchCvesForHost(hosts, locale);
    }

    const { allCves, serviceDistribution, hasUnscannedHosts, uniqueCveCount, affectedHostOptions } = useMemo(() => {
        if (!cveCache) {
             return { allCves: [], serviceDistribution: [], hasUnscannedHosts: true, uniqueCveCount: 0, affectedHostOptions: [] };
        }

        const cveList: { cveInfo: any; host: Host, service: Service; portId: string }[] = [];
        const uniqueCveIds = new Set<string>();
        const affectedHosts = new Map<string, { label: string, value: string }>();

        hosts.forEach(host => {
            const cveEntry = cveCache.get(host.address[0].addr);
            if (cveEntry?.status === 'loaded' && cveEntry.data) {
                if (cveEntry.data.length > 0 && !affectedHosts.has(host.address[0].addr)) {
                     affectedHosts.set(host.address[0].addr, {
                        value: host.address[0].addr,
                        label: `${getHostname(host)} (${host.address[0].addr})`
                    });
                }
                cveEntry.data.forEach(cveItem => {
                    if (cveItem.cve && cveItem.cve.cveId) {
                        uniqueCveIds.add(cveItem.cve.cveId);
                        cveList.push({ cveInfo: cveItem.cve, host, service: cveItem.service, portId: cveItem.portId });
                    }
                });
            }
        });
        
        const serviceCounts: { [key: string]: number } = {};
        cveList.forEach(item => {
            const serviceName = item.service.name;
            if (serviceName) {
                serviceCounts[serviceName] = (serviceCounts[serviceName] || 0) + 1;
            }
        });
        const serviceDistribution = Object.entries(serviceCounts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5);
        
        const hasUnscanned = hosts.some(host => {
            const entry = cveCache.get(host.address[0].addr);
            return !entry || entry.status === 'idle' || entry.status === 'error';
        });

        const sortedHostOptions = Array.from(affectedHosts.values()).sort((a,b) => a.label.localeCompare(b.label));

        return { 
            allCves: cveList,
            serviceDistribution,
            hasUnscannedHosts: hasUnscanned,
            uniqueCveCount: uniqueCveIds.size,
            affectedHostOptions: sortedHostOptions,
        };
    }, [hosts, cveCache]);
    
    React.useEffect(() => {
        if (cveScanProgress?.isComplete && scanResult) {
            setScanResult(scanResult.fileName, scanResult.originalHosts, riskWeights, false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cveScanProgress?.isComplete]);


    const sortedCves = useMemo(() => {
        let sortableItems = [...allCves];

        if (selectedHostIp !== 'all') {
            sortableItems = sortableItems.filter(item => item.host.address[0].addr === selectedHostIp);
        }

        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let aValue: string | number;
                let bValue: string | number;

                switch (sortConfig.key) {
                    case 'service':
                        aValue = `${a.service.product || a.service.name} ${a.service.version || ''}`.trim().toLowerCase();
                        bValue = `${b.service.product || b.service.name} ${b.service.version || ''}`.trim().toLowerCase();
                        break;
                    case 'cveId':
                        aValue = a.cveInfo.cveId.toLowerCase();
                        bValue = b.cveInfo.cveId.toLowerCase();
                        break;
                    case 'cvssScore':
                        aValue = a.cveInfo.cvssScore !== null ? parseFloat(a.cveInfo.cvssScore) : -1;
                        bValue = b.cveInfo.cvssScore !== null ? parseFloat(b.cveInfo.cvssScore) : -1;
                        if (isNaN(aValue)) aValue = -1;
                        if (isNaN(bValue)) bValue = -1;
                        break;
                    case 'affectedHost':
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
    }, [allCves, sortConfig, selectedHostIp]);

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

    const cvesTitleText = locale === 'es' ? 'CVEs Descubiertos' : 'Discovered CVEs';
    const cvesTitle = uniqueCveCount > 0 
        ? `${cvesTitleText} (${uniqueCveCount})` 
        : cvesTitleText;

    const cvesDescription = locale === 'es' ? 'Busca vulnerabilidades y CVEs en los hosts descubiertos mediante IA.' : 'Search for vulnerabilities and CVEs on discovered hosts using AI.';
    const vulnerableServicesTitle = locale === 'es' ? 'Principales Servicios Vulnerables' : 'Top Vulnerable Services';
    const serviceTitle = t('service');
    const affectedHostTitle = locale === 'es' ? 'Host Afectado' : 'Affected Host';
    const cvssScoreTitle = locale === 'es' ? 'Puntaje CVSS' : 'CVSS Score';
    const noCvesFound = locale === 'es' ? 'No se encontraron CVEs para los servicios detectados en este escaneo.' : 'No CVEs found for the detected services in this scan.';
    const vulnerableServicesDistributionTitle = locale === 'es' ? 'Distribución de Servicios Vulnerables' : 'Vulnerable Services Distribution';
    const analyzingText = cveScanProgress?.total > 0 
        ? (locale === 'es' ? `Analizando servicios expuestos... ${cveScanProgress.processed} de ${cveScanProgress.total}` : `Analyzing exposed services... ${cveScanProgress.processed} of ${cveScanProgress.total}`)
        : (locale === 'es' ? 'Preparando análisis...' : 'Preparing analysis...');
    
    const isRateLimitError = apiError?.toLowerCase().includes('rate limit') || false;
    const showConfigureApiButton = apiError && !isRateLimitError;
    const showResumeFromRateLimit = isCveScanPaused && isRateLimitError;

    const showGlobalScanButton = hasUnscannedHosts && !isCveScanRunning && !apiError && !isCveScanPaused;
    const showPauseButton = isCveScanRunning && !isCveScanPaused;
    const showResumeButton = isCveScanPaused && !isRateLimitError;

    const chartId = forceId || (pdfMode ? 'pdf-threat-service-dist-chart' : 'threat-service-dist-chart');
    const scanStoppedError = locale === 'es' ? 'El escaneo se detuvo debido a un error de la API (rate limit). Inténtalo de nuevo más tarde.' : 'Scan stopped due to API rate limit. Please try again later.';
    const configureApiButtonText = locale === 'es' ? 'Configurar API' : 'Configure API';
    const allHostsText = locale === 'es' ? 'Todos los Hosts' : 'All Hosts';


  return (
    <div className="space-y-8 w-full">
        <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <CardTitle>{cvesTitle}</CardTitle>
                    <CardDescription>{cvesDescription}</CardDescription>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {affectedHostOptions.length > 0 && (
                        <div className="w-full sm:w-auto sm:min-w-[200px]">
                            <Select value={selectedHostIp} onValueChange={setSelectedHostIp}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t('filterByHost')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{allHostsText}</SelectItem>
                                    {affectedHostOptions.map(option => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    {showGlobalScanButton && (
                        <Button onClick={handleFetchAllCves} size="sm">
                            <Search className="mr-2 h-4 w-4" />
                            {locale === 'es' ? 'Buscar CVEs' : 'Search CVEs'}
                        </Button>
                    )}
                     {showConfigureApiButton && (
                        <Button onClick={handleConfigureApi} size="sm" variant="outline">
                            <Settings className="mr-2 h-4 w-4" />
                            {configureApiButtonText}
                        </Button>
                    )}
                    {showPauseButton && (
                        <Button onClick={pauseCveScan} size="sm" variant="outline">
                            <Pause className="mr-2 h-4 w-4" />
                            {locale === 'es' ? 'Pausar' : 'Pause'}
                        </Button>
                    )}
                    {showResumeButton && (
                         <Button onClick={handleResumeScan} size="sm" variant="outline">
                            <Play className="mr-2 h-4 w-4" />
                            {locale === 'es' ? 'Reanudar' : 'Resume'}
                        </Button>
                    )}
                </div>
            </CardHeader>
             {isCveScanRunning && (
                <CardContent className='pt-2 space-y-2'>
                    <Progress value={(cveScanProgress.processed / (cveScanProgress.total || 1)) * 100} className="w-full" />
                    <p className='text-sm text-muted-foreground text-center'>{analyzingText}</p>
                </CardContent>
            )}

            {showGlobalScanButton && (
                <CardContent>
                    <Alert variant='default' className="items-center border-blue-500/50 text-blue-700 dark:text-blue-300 [&>svg]:text-blue-600 dark:[&>svg]:text-blue-400 bg-blue-500/10">
                         <Info className="h-4 w-4" />
                         <AlertDescription className='font-medium text-sm'>
                            {locale === 'es' ? 'Solo se analizarán los servicios que tengan una versión detectada.' : 'Only services with a detected version will be analyzed.'}
                        </AlertDescription>
                    </Alert>
                </CardContent>
            )}

            {showResumeFromRateLimit && (
                <CardContent>
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>{locale === 'es' ? 'Límite de API alcanzado' : 'API Rate Limit Reached'}</AlertTitle>
                        <AlertDescription>
                          {locale === 'es' ? 'El escaneo se ha pausado. Puedes reanudarlo en un minuto.' : 'The scan has been paused. You can resume it in one minute.'}
                        </AlertDescription>
                    </Alert>
                    <ResumeScanButton />
                </CardContent>
            )}
            
            {!isCveScanRunning && apiError && !showConfigureApiButton && !showResumeFromRateLimit && (
                 <CardContent>
                    <Alert variant="destructive">
                        <AlertTitle>{locale === 'es' ? 'Error en el Escaneo' : 'Scan Error'}</AlertTitle>
                        <AlertDescription>{scanStoppedError}</AlertDescription>
                    </Alert>
                </CardContent>
            )}

            <CardContent>
                {sortedCves.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead onClick={() => requestSort('cveId')} className="cursor-pointer">
                                      <div className="flex items-center">CVE ID {getSortIcon('cveId')}</div>
                                  </TableHead>
                                  <TableHead onClick={() => requestSort('cvssScore')} className="cursor-pointer">
                                      <div className="flex items-center">{cvssScoreTitle} {getSortIcon('cvssScore')}</div>
                                  </TableHead>
                                   <TableHead onClick={() => requestSort('service')} className="cursor-pointer">
                                      <div className="flex items-center">{serviceTitle} {getSortIcon('service')}</div>
                                  </TableHead>
                                  <TableHead onClick={() => requestSort('affectedHost')} className="cursor-pointer">
                                      <div className="flex items-center">{affectedHostTitle} {getSortIcon('affectedHost')}</div>
                                  </TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {sortedCves.map((item, index) => {
                                  const score = item.cveInfo.cvssScore !== null ? parseFloat(item.cveInfo.cvssScore) : null;
                                  const displayScore = score !== null && !isNaN(score) ? score.toFixed(1) : 'N/A';
                                  
                                  const hostname = getHostname(item.host);
                                  const serviceText = `${item.service.product || item.service.name} ${item.service.version || ''}`.trim();

                                  return (
                                    <TableRow key={`${item.cveInfo.cveId}-${item.host.address[0].addr}-${index}`} className="cursor-default">
                                        <TableCell>
                                            <a href={`https://nvd.nist.gov/vuln/detail/${item.cveInfo.cveId}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                                                {item.cveInfo.cveId}
                                            </a>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="default" className={cn("border-transparent", getCveRiskColorClass(score))}>
                                                {displayScore}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-medium">{serviceText}</TableCell>
                                        <TableCell>
                                            <Link href={`/details/host/${item.host.address[0].addr}`} className='text-primary hover:underline'>
                                                {item.host.address[0].addr}
                                                {hostname !== 'N/A' && <span className='text-muted-foreground'> ({hostname})</span>}
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                  );
                              })}
                          </TableBody>
                      </Table>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center space-y-3 p-4 text-center min-h-[150px]">
                        {!isCveScanRunning && !isCveScanPaused && !apiError && (
                            cveScanProgress?.isComplete ? (
                                <>
                                    <ShieldX className="h-8 w-8 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground">{noCvesFound}</p>
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    {locale === 'es' ? 'Inicia un escaneo para detectar CVEs en todos los hosts.' : 'Start a scan to detect CVEs on all hosts.'}
                                </p>
                            )
                        )}
                    </div>
                )}
            </CardContent>
        </Card>

        {allCves.length > 0 && (
            <Card>
                <CardHeader>
                <CardTitle>{vulnerableServicesDistributionTitle}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div id={chartId} className={pdfMode ? 'w-[800px] h-[300px]' : ''}>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie data={serviceDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                    {serviceDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', borderRadius: 'var(--radius)', border: '1px solid hsl(var(--border))'}} itemStyle={{ color: 'hsl(var(--primary))' }}/>
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        )}
    </div>
  );
}

