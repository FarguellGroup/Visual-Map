'use client';

import React, { useMemo, useState } from 'react';
import type { Host } from '@/types/nmap';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/navigation';
import { useScanStore } from '@/store/use-scan-store';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';
import { Search, Loader2, AlertTriangle, ShieldCheck, Sparkles, CheckCircle2, XCircle, Group } from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { getHostname } from '@/lib/nmap-parser';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from '@/navigation';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';


interface RemediationProps {
  remediationText: string;
}

const formatRemediation = (text: string): string => {
    if (!text) return '';

    const lines = text.split('\n');
    let html = '';
    let ulOpen = false;
    let codeBlockOpen = false;
    let codeLang = '';
    
    const closeLists = () => {
        if (ulOpen) { html += '</ul>'; ulOpen = false; }
    };

    lines.forEach(line => {
        if (line.trim().startsWith('```')) {
            if (codeBlockOpen) {
                html += '</code></pre></div>';
                codeBlockOpen = false;
            } else {
                closeLists();
                codeLang = line.trim().substring(3);
                html += `<div class="code-block-container relative"><span class="absolute top-2 right-3 text-xs text-muted-foreground">${codeLang}</span><pre><code class="language-${codeLang}">`;
                codeBlockOpen = true;
            }
            return;
        }

        if (codeBlockOpen) {
            html += line.replace(/</g, "&lt;").replace(/>/g, "&gt;") + '\n';
            return;
        }
        
        const trimmedLine = line.trim();
        const isBulletedListItem = trimmedLine.match(/^[-*]\s/);
        const isNumericLooking = /^\d+\.\s/.test(trimmedLine);
        
        if (isBulletedListItem) {
            if (!ulOpen) { closeLists(); html += '<ul class="list-disc pl-5">'; ulOpen = true; }
            html += `<li>${trimmedLine.substring(trimmedLine.indexOf(' ') + 1).trim().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</li>`;
        } else if (trimmedLine.startsWith('# ')) {
            closeLists();
            html += `<h3>${trimmedLine.substring(2)}</h3>`;
        } else if (trimmedLine.startsWith('## ')) {
            closeLists();
            html += `<h4>${trimmedLine.substring(3)}</h4>`;
        } else if (trimmedLine.startsWith('### ')) {
            closeLists();
            html += `<h5>${trimmedLine.substring(4)}</h5>`;
        } else if (trimmedLine) {
            closeLists();
            html += `<p>${trimmedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')}</p>`;
        }
    });

    closeLists();
    return html;
};


const RemediationDisplay = ({ remediationText }: RemediationProps) => {
    return (
        <div 
          className="text-sm prose prose-sm dark:prose-invert max-w-full"
          dangerouslySetInnerHTML={{ __html: formatRemediation(remediationText) }} 
        />
    );
};

export default function RemediationsView({ hosts }: { hosts: Host[] }) {
    const t = useTranslations('DetailsPage');
    const router = useRouter();
    const locale = useLocale();
    
    const { 
        cveCache,
        cveScanProgress,
        isCveScanRunning,
        remediationCache,
        fetchRemediation,
        fetchAllRemediations,
    } = useScanStore();

    const [selectedHostIp, setSelectedHostIp] = useState<string>('all');
    const [openAccordionItem, setOpenAccordionItem] = useState<string | undefined>(undefined);
    
    const { allFoundCves, hasUnscannedHosts, affectedHostOptions } = useMemo(() => {
        let allCves: { host: Host, service: any, portId: string, cve: any }[] = [];
        const affectedHosts = new Map<string, {label: string, value: string}>();
        
        const hasUnscanned = hosts.some(host => {
            const entry = cveCache.get(host.address[0].addr);
            return !entry;
        });

        hosts.forEach(host => {
            const cveEntry = cveCache.get(host.address[0].addr);
            if (cveEntry?.status === 'loaded' && cveEntry.data) {
                cveEntry.data.forEach(cveItem => {
                    if (cveItem.cve && cveItem.cve.cveId) {
                        allCves.push({ host, service: cveItem.service, portId: cveItem.portId, cve: cveItem.cve });
                        if (!affectedHosts.has(host.address[0].addr)) {
                            affectedHosts.set(host.address[0].addr, {
                                value: host.address[0].addr,
                                label: `${getHostname(host)} (${host.address[0].addr})`
                            });
                        }
                    }
                });
            }
        });

        const sortedOptions = Array.from(affectedHosts.values()).sort((a, b) => a.label.localeCompare(b.label));

        return { allFoundCves: allCves, hasUnscannedHosts: hasUnscanned, affectedHostOptions: sortedOptions };
    }, [hosts, cveCache]);

    const handleAccordionChange = (value: string | undefined) => {
        setOpenAccordionItem(value);
        if (value) {
            const cveId = value.replace('cve-', '');
            const cveItem = allFoundCves.find(item => item.cve.cveId === cveId);
            if (cveItem && remediationCache) {
                const cacheKey = `${cveItem.cve.cveId}-${locale}`;
                const entry = remediationCache.get(cacheKey);
                if (!entry || entry.status === 'idle' || entry.status === 'error') {
                    const osName = getHostname(cveItem.host)
                    fetchRemediation({...cveItem, osName }, locale);
                }
            }
        }
    };

    const handleGenerateAll = () => {
        if (!remediationCache) return;
        const cveItemsToFetch = allFoundCves
            .map(item => ({...item, osName: getHostname(item.host)}))
            .filter(item => {
                const cacheKey = `${item.cve.cveId}-${locale}`;
                const entry = remediationCache.get(cacheKey);
                return !entry || entry.status === 'idle' || entry.status === 'error';
            });
        
        const uniqueCveItems = Array.from(new Map(cveItemsToFetch.map(item => [item.cve.cveId, item])).values());
        
        fetchAllRemediations(uniqueCveItems, locale);
    };

    const handleNavigateToCvePage = () => {
        router.push('/details/vulnerabilities');
    };

    const cveRemediations = useMemo(() => {
        const filteredByHost = selectedHostIp === 'all'
            ? allFoundCves
            : allFoundCves.filter(item => item.host.address[0].addr === selectedHostIp);
        
        const cveMap = new Map<string, { cve: any; hosts: Host[] }>();

        filteredByHost.forEach(item => {
            if (!cveMap.has(item.cve.cveId)) {
                cveMap.set(item.cve.cveId, { cve: item.cve, hosts: [] });
            }
            const cveEntry = cveMap.get(item.cve.cveId)!;
            if (!cveEntry.hosts.some(h => h.address[0].addr === item.host.address[0].addr)) {
                cveEntry.hosts.push(item.host);
            }
        });

        return Array.from(cveMap.values()).sort((a, b) => (b.cve.cvssScore ?? -1) - (a.cve.cvssScore ?? -1));
    }, [allFoundCves, selectedHostIp]);
    
    const remediationsTitle = locale === 'es' ? 'Remediaciones' : 'Remediations';
    const generateAllButtonText = locale === 'es' ? 'Generar Todas' : 'Generate All';
    const allHostsText = locale === 'es' ? 'Todos los Hosts' : 'All Hosts';
    const cardDescriptionText = locale === 'es' ? 'Para generar remediaciones, primero debes escanear todos los hosts.' : 'To generate remediations, you must first scan all hosts.';
    const cardTitleText = locale === 'es' ? 'Remediaciones' : 'Remediations';

    if (hasUnscannedHosts && allFoundCves.length === 0 && !isCveScanRunning) {
        return (
            <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                        <CardTitle>{cardTitleText}</CardTitle>
                        <CardDescription>
                            {cardDescriptionText}
                        </CardDescription>
                    </div>
                     <Button onClick={handleNavigateToCvePage} size="sm">
                        <Search className="mr-2 h-4 w-4" />
                        {locale === 'es' ? 'Escanear CVEs' : 'Scan for CVEs'}
                    </Button>
                </CardHeader>
                <CardContent>
                    <Alert variant="default" className="items-center border-orange-500/50 text-orange-700 dark:text-orange-300 [&>svg]:text-orange-600 dark:[&>svg]:text-orange-400 bg-orange-500/10">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>{locale === 'es' ? 'Análisis de CVEs Incompleto' : 'CVE Scan Incomplete'}</AlertTitle>
                        <AlertDescription>
                           {locale === 'es' ? 'Completa el escaneo de CVEs para generar las remediaciones correspondientes.' : 'Complete the CVE scan to generate the corresponding remediations.'}
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        )
    }
    
    if (isCveScanRunning) {
        return (
            <div className="flex flex-col items-center justify-center space-y-3 p-4 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                    {locale === 'es' ? 'Esperando a que finalice el escaneo de CVEs...' : 'Waiting for CVE scan to finish...'}
                </p>
            </div>
        );
    }

    if (allFoundCves.length === 0 && (cveScanProgress?.isComplete || !hasUnscannedHosts)) {
        return (
             <div className="flex flex-col items-center justify-center space-y-3 p-4 text-center">
                <ShieldCheck className="h-8 w-8 text-green-500" />
                <p className="text-sm text-muted-foreground">
                    {locale === 'es' ? '¡Buenas noticias! No se encontraron CVEs, por lo que no se necesitan remediaciones.' : 'Good news! No CVEs were found, so no remediations are needed.'}
                </p>
            </div>
        )
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <CardTitle>{remediationsTitle} ({cveRemediations.length})</CardTitle>
                        <CardDescription>
                            {locale === 'es' ? 'Soluciones generadas por IA para las vulnerabilidades descubiertas.' : 'AI-generated solutions for the discovered vulnerabilities.'}
                        </CardDescription>
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
                        <Button onClick={handleGenerateAll} variant="default">
                            <Sparkles className="mr-2 h-4 w-4" />
                            {generateAllButtonText}
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Accordion type="single" collapsible className="w-full" value={openAccordionItem} onValueChange={handleAccordionChange}>
                    {cveRemediations.map(({ cve, hosts: affectedHosts }, index) => {
                        const cacheKey = remediationCache ? `${cve.cveId}-${locale}` : null;
                        const remediationEntry = cacheKey ? remediationCache.get(cacheKey) : undefined;
                        const remediation = remediationEntry?.data;
                        const error = remediationEntry?.error;
                        const isLoading = remediationEntry?.status === 'loading';
                        const isLoaded = remediationEntry?.status === 'loaded';
                        const isError = remediationEntry?.status === 'error';

                        const getAffectedText = () => {
                            if (locale === 'es') {
                                return affectedHosts.length === 1 ? '1 host afectado' : `${affectedHosts.length} hosts afectados`;
                            }
                            return affectedHosts.length === 1 ? '1 affected host' : `${affectedHosts.length} affected hosts`;
                        }

                        return (
                        <AccordionItem value={`cve-${cve.cveId}`} key={`${cve.cveId}-${index}`}>
                            <AccordionTrigger className='hover:no-underline group rounded-lg px-4 hover:bg-muted/50'>
                                <div className='flex items-center justify-between w-full gap-4 text-left'>
                                    <div className="flex-1 flex items-center gap-x-4">
                                        <h4 className='font-semibold text-base flex-shrink-0 group-hover:text-primary transition-colors w-[150px] sm:w-[200px] text-left'>{cve.cveId}</h4>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="destructive" className="w-14 justify-center">{cve.cvssScore?.toFixed(1) || 'N/A'}</Badge>
                                            <Badge variant="outline" className="flex items-center gap-1.5">
                                                <Group className="h-3.5 w-3.5" />
                                                <span>{getAffectedText()}</span>
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="ml-4 flex-shrink-0">
                                        {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                                        {isLoaded && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                                        {isError && <XCircle className="h-5 w-5 text-destructive" />}
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4 px-4">
                                <div className='space-y-1'>
                                    <h5 className="font-semibold">{locale === 'es' ? 'Descripción' : 'Description'}</h5>
                                    <p className="text-sm text-muted-foreground mt-1">{cve.description}</p>
                                </div>
                                <div className="space-y-2">
                                    <h5 className="font-semibold">{locale === 'es' ? 'Hosts Afectados' : 'Affected Hosts'}</h5>
                                    <ul className="list-disc list-inside mt-1 space-y-1 text-sm text-muted-foreground">
                                        {affectedHosts.map(h => {
                                            const hostname = getHostname(h);
                                            return (
                                                <li key={h.address[0].addr}>
                                                    <Link href={`/details/host/${h.address[0].addr}`} className='text-primary hover:underline'>
                                                        {h.address[0].addr} {hostname !== 'N/A' && `(${hostname})`}
                                                    </Link>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                                
                                <div className="space-y-2">
                                    <h5 className="font-semibold">{locale === 'es' ? 'Remediación Sugerida' : 'Suggested Remediation'}</h5>
                                     {isLoading && (
                                         <div className="flex items-center justify-center space-x-2 pt-4">
                                            <Loader2 className="h-4 w-4 animate-spin"/>
                                            <span className='text-sm text-muted-foreground'>{locale === 'es' ? 'Generando...' : 'Generating...'}</span>
                                         </div>
                                     )}
                                     {remediation && <RemediationDisplay remediationText={remediation.remediation} />}
                                     {error && (
                                         <Alert variant="destructive" className="mt-2">
                                             <AlertTriangle className="h-4 w-4" />
                                             <AlertTitle>{locale === 'es' ? 'Error' : 'Error'}</AlertTitle>
                                             <AlertDescription>{locale === 'es' ? `No se pudo generar la remediación: ${error}`: `Could not generate remediation: ${error}`}</AlertDescription>
                                         </Alert>
                                     )}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    )})}
                </Accordion>
            </CardContent>
        </Card>
    )
}
