

'use client';

import { SidebarHeader, SidebarContent, SidebarGroup, SidebarSeparator, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '../ui/button';
import { Download, Loader2, Home, AlertTriangle, Shield, Server, DoorOpen, Network, Skull, SlidersHorizontal, ChevronDown, KeyRound, HeartPulse } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useScanStore, type RiskWeights } from '@/store/use-scan-store';
import { useState, useCallback, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import type { Host } from '@/types/nmap';
import { Slider } from '../ui/slider';
import { Link, usePathname } from '@/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { useSidebar } from '@/components/ui/sidebar';
import { useTheme } from 'next-themes';
import { getHostname, getOsName } from '@/lib/nmap-parser';
import { useToast } from '@/hooks/use-toast';
import { VmLogo } from '../icons';


// Extend jsPDF with autoTable
interface jsPDFWithAutoTable extends jsPDF {
  lastAutoTable: { finalY: number };
}

const getOpenPortsCount = (host: Host) => {
  if (!host.ports || !host.ports.port) return 0;
  const ports = Array.isArray(host.ports.port) ? host.ports.port : [host.ports.port];
  return ports.filter(p => p.state.state === 'open').length;
};

const ipToNumber = (ip: string) => {
    return ip.split('.').reduce((acc, octet, index) => acc + parseInt(octet) * Math.pow(256, 3 - index), 0);
};

const getFormattedTimestamp = () => {
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${YYYY}-${MM}-${DD}_${HH}-${mm}-${ss}`;
};

// Helper to process arrays in batches
const processInBatches = async <T, U>(items: T[], batchSize: number, processItem: (item: T) => Promise<U>): Promise<U[]> => {
    const results: U[] = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(processItem));
        results.push(...batchResults);
        // Add a small delay to prevent the browser from freezing
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    return results;
};

const formatRemediationForHtml = (text: string): string => {
    if (!text) return '';

    const lines = text.split('\n');
    let html = '';
    let olOpen = false;
    let ulOpen = false;
    let codeBlockOpen = false;
    let codeLang = '';
    
    let olCounter = 1;

    const closeLists = () => {
        if (olOpen) { html += '</ol>'; olOpen = false; }
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
                html += `<div class="code-block-container"><span class="code-lang">${codeLang}</span><pre><code>`;
                codeBlockOpen = true;
            }
            return;
        }

        if (codeBlockOpen) {
            html += line.replace(/</g, "&lt;").replace(/>/g, "&gt;") + '\n';
            return;
        }
        
        const trimmedLine = line.trim();
        const isNumericListItem = trimmedLine.match(/^\d+\.\s/);
        
        if (isNumericListItem) {
            if (!olOpen) { closeLists(); html += '<ol>'; olOpen = true; olCounter = 1; }
            html += `<li>${trimmedLine.substring(trimmedLine.indexOf('.') + 1).trim().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</li>`;
        } else if (trimmedLine.match(/^[-*]\s/)) {
             if (olOpen) {
                html = html.slice(0, -5); // Remove closing </li>
                html += `<ul><li>${trimmedLine.substring(trimmedLine.indexOf(' ') + 1).trim().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</li></ul></li>`;
            } else {
                if (!ulOpen) { closeLists(); html += '<ul>'; ulOpen = true; }
                html += `<li>${trimmedLine.substring(trimmedLine.indexOf(' ') + 1).trim().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</li>`;
            }
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


const formatRemediationForPdf = (doc: jsPDF, text: string, startY: number, pageHeight: number, margin: number, pageWidth: number): number => {
    let yPos = startY;

    if (!text) return yPos;

    const lines = text.replace(/\r\n/g, '\n').split('\n');

    const checkPageBreak = (neededHeight: number) => {
        if (yPos + neededHeight > pageHeight - margin) {
            doc.addPage();
            yPos = margin;
        }
    };

    let inCodeBlock = false;
    let codeBlockContent = '';
    let codeBlockLang = '';

    const renderCodeBlock = () => {
        if (codeBlockContent) {
            const codeLines = doc.splitTextToSize(codeBlockContent.trim(), pageWidth - (margin * 2) - 10);
            const langHeight = codeBlockLang ? 5 : 0;
            const blockHeight = (codeLines.length * 4.5) + 10 + langHeight + 5; // Added 5 for top padding

            checkPageBreak(blockHeight + 15);

            doc.setFillColor(230, 230, 230);
            doc.roundedRect(margin, yPos, pageWidth - (margin * 2), blockHeight, 3, 3, 'F');

            let textY = yPos + 7;
            if (codeBlockLang) {
                doc.setFontSize(8);
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(100, 100, 100);
                doc.text(codeBlockLang, margin + 5, textY);
                textY += 5;
            }
            
            doc.setFont('courier', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(0, 0, 0);
            doc.text(codeLines, margin + 5, textY + 5); // Added 5 for top padding
            
            yPos += blockHeight + 10;
            codeBlockContent = '';
            codeBlockLang = '';
        }
    };

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        if (line.trim().startsWith('```')) {
            if (inCodeBlock) {
                renderCodeBlock();
            } else {
                codeBlockLang = line.trim().substring(3);
            }
            inCodeBlock = !inCodeBlock;
            continue;
        }

        if (inCodeBlock) {
            codeBlockContent += line + '\n';
            continue;
        }

        if (line.trim() === '') {
            checkPageBreak(3);
            yPos += 3;
            continue;
        }

        let fontSize = 10;
        let fontStyle = 'normal';
        const indentMatch = line.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[0].length * 2 : 0;
        let currentX = margin + indent;
        let lineHeight = fontSize * 1.2;

        let processedLine = line.trim();
        
        const isBulletedListItem = processedLine.startsWith('- ') || processedLine.startsWith('* ');

        if (isBulletedListItem) {
            processedLine = `• ${processedLine.substring(2)}`;
            currentX += 5;
        } else if (processedLine.startsWith('# ')) { 
            fontSize = 16; fontStyle = 'bold'; processedLine = processedLine.substring(2); 
        } else if (processedLine.startsWith('## ')) { 
            fontSize = 14; fontStyle = 'bold'; processedLine = processedLine.substring(3); 
        } else if (processedLine.startsWith('### ')) { 
            fontSize = 12; fontStyle = 'bold'; processedLine = processedLine.substring(4); 
        }
        
        const parts = processedLine.split(/(\*\*.*?\*\*|`[^`]+`)/g).filter(part => part);
        const splitText = doc.setFontSize(fontSize).splitTextToSize(parts.join(''), pageWidth - currentX - margin);

        checkPageBreak(splitText.length * lineHeight);
        
        splitText.forEach((lineChunk: string, index: number) => {
            let chunkX = currentX;
            if (index > 0 && isBulletedListItem) { // Indent wrapped lines of list items
                chunkX += 10;
            }
            const chunkParts = lineChunk.split(/(\*\*.*?\*\*|`[^`]+`)/g).filter(part => part);
            chunkParts.forEach(part => {
                const isBold = part.startsWith('**') && part.endsWith('**');
                const isCode = part.startsWith('`') && part.endsWith('`');
                const cleanPart = part.replace(/\*\*|`/g, '');
                 
                if (isBold) {
                    doc.setFont('helvetica', 'bold');
                } else if (isCode) {
                    doc.setFont('courier', 'normal');
                } else {
                    doc.setFont('helvetica', fontStyle);
                }
                
                doc.text(cleanPart, chunkX, yPos);
                chunkX += doc.getStringUnitWidth(cleanPart) * fontSize / doc.internal.scaleFactor;
            });
            yPos += lineHeight;
        });
        
        yPos += isBulletedListItem ? 1 : 2;
    }

    renderCodeBlock();
    yPos += 25; // Increased space after code block
    return yPos;
};



export default function AppSidebar() {
  const tHeader = useTranslations('Header');
  const tSidebar = useTranslations('Sidebar');
  const tDetails = useTranslations('DetailsPage');
  const tSummary = useTranslations('SummaryCards');
  const tHostsTable = useTranslations('HostsTable');
  const tRiskRanking = useTranslations('RiskRanking');
  const tApi = useTranslations('ApiPage');
  
  const { scanResult, riskWeights, setRiskWeights, setScanResult, cveCache, remediationCache } = useScanStore();
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingHtml, setIsExportingHtml] = useState(false);
  const [localWeights, setLocalWeights] = useState<RiskWeights>(riskWeights);
  const { state, setOpen } = useSidebar();
  const [openAccordion, setOpenAccordion] = useState('');
  const locale = useLocale();
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const { toast } = useToast();

  useEffect(() => {
    setLocalWeights(riskWeights);
  }, [riskWeights]);

  useEffect(() => {
    if (state === 'collapsed') {
      setOpenAccordion('');
    }
  }, [state]);
  
  const handleWeightChange = (factor: keyof typeof riskWeights, value: number[]) => {
    setLocalWeights(prev => ({ ...prev, [factor]: value[0] }));
  };

  const commitWeightChange = (factor: keyof typeof riskWeights, value: number[]) => {
    const currentScanResult = useScanStore.getState().scanResult;
    if (!currentScanResult) return;
    const newWeights = { ...riskWeights, [factor]: value[0] };
    setRiskWeights(newWeights);
    // Trigger recalculation
    setScanResult(currentScanResult.fileName, currentScanResult.originalHosts, newWeights, false);
  };

  const handleExportJson = useCallback(() => {
    const currentScanResult = useScanStore.getState().scanResult;
    if (!currentScanResult) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(currentScanResult, null, 2)
    )}`;
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = `visual-map-report-${getFormattedTimestamp()}.json`;
    link.click();
  }, []);

  const captureChartAsBase64 = async (elementId: string, options?: { backgroundColor?: string | null }) => {
    const element = document.getElementById(elementId) as HTMLElement;
    if (!element) {
        console.warn(`Chart element with id '${elementId}' not found on the page.`);
        return null;
    }
    try {
      const canvas = await html2canvas(element, { 
          scale: 2, 
          useCORS: true,
          logging: false,
          backgroundColor: options?.backgroundColor,
        });
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error(`Error capturing chart '${elementId}':`, error);
      return null;
    }
  };

  const handleExportHtml = useCallback(async () => {
    const { scanResult: currentScanResult, cveCache: currentCveCache, remediationCache: currentRemediationCache } = useScanStore.getState();
    if (!currentScanResult) return;
    
    if (currentScanResult.hosts.length > 50) {
        toast({
            title: locale === 'es' ? 'Generando Informe HTML' : 'Generating HTML Report',
            description: locale === 'es' ? 'Esto puede tardar un momento para escaneos grandes...' : 'This may take a moment for large scans...',
        });
    }
    setIsExportingHtml(true);

    try {
        const { fileName, hosts, summary } = currentScanResult;
        
        const reportBgColor = resolvedTheme === 'dark' ? '#09090b' : '#ffffff';
        const riskChart = await captureChartAsBase64('risk-distribution-chart', { backgroundColor: reportBgColor });
        const portsChart = await captureChartAsBase64('top-ports-chart', { backgroundColor: reportBgColor });
        const servicesChart = await captureChartAsBase64('service-distribution-chart', { backgroundColor: reportBgColor });
        
        const allCves = Array.from(currentCveCache.entries())
            .filter(([, entry]) => entry.status === 'loaded' && entry.data)
            .flatMap(([hostIp, entry]) => 
                entry.data!.map(cveData => ({...cveData, hostIp}))
            );

        const threatsChart = allCves.length > 0 
            ? await captureChartAsBase64('pdf-threat-service-dist-chart', { backgroundColor: reportBgColor })
            : null;

        const topVulnerableHosts = [...hosts]
            .filter(h => (h.riskScore ?? 0) >= 70)
            .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));
        
        const allHostsSorted = [...hosts].sort((a,b) => ipToNumber(a.address[0].addr) - ipToNumber(b.address[0].addr));
        const allHostsData = allHostsSorted.map(h => ({...h, hostname: getHostname(h), osName: getOsName(h)}));
        const topVulnerableHostsData = topVulnerableHosts.map(h => ({...h, hostname: getHostname(h), osName: getOsName(h)}));

        const getRiskClass = (score: number) => {
            if (score >= 75) return 'badge-red';
            if (score >= 40) return 'badge-orange';
            if (score > 0) return 'badge-yellow';
            return 'badge-gray';
        };

        const getCveRiskClass = (score: number | null) => {
            if (score === null || isNaN(score)) return 'badge-gray';
            if (score >= 9.0) return 'badge-red';
            if (score >= 7.0) return 'badge-orange';
            if (score >= 4.0) return 'badge-yellow';
            return 'badge-green';
        }

        const visualizationsTitle = locale === 'es' ? 'Visualizaciones' : 'Visualizations';
        const osTitle = tDetails('os');
        const summaryTitle = tSummary('totalHosts').includes('Total') ? 'Summary' : 'Resumen';
        const cvesTitle = locale === 'es' ? 'CVEs Descubiertos' : 'Discovered CVEs';
        const cvssTitle = locale === 'es' ? 'Puntaje CVSS' : 'CVSS Score';
        const remediationsTitle = locale === 'es' ? 'Remediaciones' : 'Remediations';

        const chartNotAvailableText = locale === 'es' ? 'Gráfico no disponible. Navegue a la página correspondiente para incluirlo en el informe.' : 'Chart not available. Navigate to the corresponding page to include it in the report.';
        
        const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
        const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
        const faviconDataUri = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#906BE1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" fill="#906BE1" /></svg>');

        const generateHostDetailsHtml = async (hostsToProcess: typeof allHostsData) => {
            const hostChunks = await processInBatches(hostsToProcess, 50, async (host) => {
                const openPorts = (Array.isArray(host.ports.port) ? host.ports.port : (host.ports.port ? [host.ports.port] : []))
                    .filter(p => p?.state.state === 'open');
                
                return `
                    <div id="host-${host.address[0].addr.replace(/\./g, '-')}" class="card" style="margin-top: 30px;">
                      <div style="position: absolute; top: 20px; right: 20px;">
                          <span class="badge ${getRiskClass(host.riskScore ?? 0)}">${tHostsTable('riskScore')}: ${host.riskScore?.toFixed(0) ?? '0'}</span>
                      </div>
                      <h3>Host: ${host.address[0].addr} (${host.hostname})</h3>
                      ${openPorts.length > 0 ? `
                        <div class="table-responsive">
                            <table>
                            <thead><tr><th>${tDetails('port')}</th><th>${tDetails('protocol')}</th><th>${tDetails('service')}</th><th>${tDetails('product')}</th><th>${tDetails('version')}</th></tr></thead>
                            <tbody>
                                ${openPorts.map(p => `
                                <tr>
                                    <td>${p.portid}</td>
                                    <td>${p.protocol}</td>
                                    <td>${p.service?.name || ''}</td>
                                    <td>${p.service?.product || ''}</td>
                                    <td>${p.service?.version || ''}</td>
                                </tr>
                                `).join('')}
                            </tbody>
                            </table>
                        </div>
                      ` : `<p style="color: var(--muted-foreground);">${tDetails('openPorts')}: 0</p>`}
                    </div>
                `;
            });
            return hostChunks.join('');
        };
        
        const hostDetailsHtml = await generateHostDetailsHtml(allHostsData);

        const allRemediations = Array.from(currentRemediationCache.entries())
            .filter(([, entry]) => entry.status === 'loaded' && entry.data)
            .map(([cveId, entry]) => ({ cveId: cveId.replace(/-\w{2}$/, ''), remediation: entry.data!.remediation }));

        const remediationsHtml = allRemediations.length > 0 ? `
            <section id="remediations">
                <h2>${remediationsTitle}</h2>
                ${allRemediations.map(rem => `
                    <div class="card" style="margin-top: 20px;">
                        <h3>${rem.cveId}</h3>
                        <div class="prose">${formatRemediationForHtml(rem.remediation)}</div>
                    </div>
                `).join('')}
            </section>
        ` : '';

        const uniqueCveIds = new Set(allCves.map(cveItem => cveItem.cve.cveId));
        const totalCvesCount = uniqueCveIds.size;


        const htmlContent = `
            <!DOCTYPE html>
            <html lang="${locale}" class="${resolvedTheme === 'dark' ? 'dark' : ''}">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Visual Map Report</title>
                <link rel="icon" href="${faviconDataUri}" type="image/svg+xml">
                <style>
                    :root {
                        --background-light: #ffffff; --foreground-light: #020817; --border-light: #e4e4e7;
                        --card-light: #ffffff; --muted-light: #f4f4f5; --link-light: #906BE1; --muted-foreground-light: #64748b;
                        --primary-light: #906BE1; --primary-light-hover: #a17ff3; --primary-light-bg: rgba(144, 107, 225, 0.1);
                        --danger-light: #EF4444; --danger-light-hover: #F87171; --danger-light-bg: rgba(239, 68, 68, 0.1);
                        
                        --background-dark: #09090b; --foreground-dark: #f8fafc; --border-dark: #27272a;
                        --card-dark: #09090b; --muted-dark: #18181b; --link-dark: #906BE1; --muted-foreground-dark: #a1a1aa;
                        --primary-dark: #906BE1; --primary-dark-hover: #a17ff3; --primary-dark-bg: rgba(144, 107, 225, 0.1);
                        --danger-dark: #F87171; --danger-dark-hover: #FFAFAF; --danger-dark-bg: rgba(248, 113, 113, 0.1);
                    }
                    html { 
                        --background: var(--background-light); --foreground: var(--foreground-light); 
                        --border: var(--border-light); --card-bg: var(--card-light); --muted-bg: var(--muted-light);
                        --link-color: var(--link-light); --muted-foreground: var(--muted-foreground-light);
                        --primary: var(--primary-light); --primary-hover: var(--primary-light-hover); --primary-bg: var(--primary-light-bg);
                        --danger: var(--danger-light); --danger-hover: var(--danger-light-hover); --danger-bg: var(--danger-light-bg);
                    }
                    html.dark { 
                        --background: var(--background-dark); --foreground: var(--foreground-dark); 
                        --border: var(--border-dark); --card-bg: var(--card-dark); --muted-bg: var(--muted-dark);
                        --link-color: var(--link-dark); --muted-foreground: var(--muted-foreground-dark);
                        --primary: var(--primary-dark); --primary-hover: var(--primary-dark-hover); --primary-bg: var(--primary-dark-bg);
                        --danger: var(--danger-dark); --danger-hover: var(--danger-dark-hover); --danger-bg: var(--danger-dark-bg);
                    }
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; color: var(--foreground); background-color: var(--background); margin: 0; padding-top: 80px; transition: color 0.2s, background-color 0.2s; }
                    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
                    header { position: fixed; top: 0; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; padding: 10px 20px; background-color: color-mix(in srgb, var(--background) 80%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--border); z-index: 1000; }
                    nav { display: flex; align-items: center; gap: 20px; }
                    nav ul { list-style: none; padding: 0; margin: 0; display: flex; gap: 20px; }
                    nav a { text-decoration: none; color: var(--muted-foreground); font-weight: 500; font-size: 14px; transition: color 0.2s; }
                    nav a:hover { color: var(--foreground); }
                    #theme-toggle { background: none; border: none; cursor: pointer; color: var(--muted-foreground); padding: 5px; }
                    #theme-toggle:hover { color: var(--foreground); }
                    #theme-toggle svg { width: 20px; height: 20px; }
                    .sun-icon { display: none; } .moon-icon { display: block; }
                    html.dark .sun-icon { display: block; } html.dark .moon-icon { display: none; }
                    h1, h2, h3, h4, h5 { color: var(--foreground); font-weight: 600; }
                    h1 { font-size: 2em; text-align: left; } h2 { font-size: 1.5em; border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-top: 40px; } h3 { font-size: 1.2em; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { padding: 12px 15px; border: 1px solid var(--border); text-align: left; font-size: 14px; }
                    th { background-color: var(--muted-bg); font-weight: 600; }
                    tr { background-color: var(--card-bg); }
                    tr:hover { background-color: var(--muted-bg); }
                    td a { color: var(--link-color); text-decoration: none; } td a:hover { text-decoration: underline; }
                    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; color: white; }
                    .badge-red { background-color: #EF4444; } .badge-orange { background-color: #F97316; } .badge-yellow { background-color: #FBBF24; color: #000; } .badge-gray { background-color: #6B7280; } .badge-green { background-color: #22C55E; }
                    .grid-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-top: 20px; }
                    .card { position: relative; padding: 20px; border: 1px solid var(--border); border-radius: 8px; background-color: var(--card-bg); text-decoration: none; color: inherit; display: block; }
                    .card-link { transition: border-color 0.2s, background-color 0.2s; }
                    .card-link:hover { border-color: var(--primary); background-color: var(--primary-bg); }
                    .card-link:hover .card-title { color: var(--primary); }
                    .card-danger:hover { border-color: var(--danger); background-color: var(--danger-bg); }
                    .card-danger:hover .card-title { color: var(--danger); }
                    .card-title { font-weight: 500; margin-bottom: 10px; color: var(--muted-foreground); transition: color 0.2s; }
                    .card-value { font-size: 2.5em; font-weight: bold; }
                    .card-value-danger { color: var(--danger); }
                    .chart-container { margin-top: 20px; padding: 20px; border: 1px solid var(--border); border-radius: 8px; text-align: center; background-color: var(--background); }
                    .chart-container img { max-width: 100%; height: auto; }
                    .chart-container .unavailable { color: var(--muted-foreground); }
                    .table-responsive { overflow-x: auto; }
                    .logo { display: flex; align-items: center; gap: 10px; }
                    .logo svg { width: 24px; height: 24px; }
                    .logo-text { font-size: 1.2em; font-weight: bold; }
                    .prose { line-height: 1.7; }
                    .prose p { margin-top: 1em; margin-bottom: 1em; }
                    .prose h3, .prose h4, .prose h5 { margin-top: 1.5em; margin-bottom: 0.5em; }
                    .prose ul, .prose ol { padding-left: 20px; margin-top: 1em; margin-bottom: 1em; }
                    .prose li { margin-bottom: 0.5em; }
                    .prose strong { font-weight: 600; color: var(--foreground); }
                    .prose .code-block-container { margin: 1em 0; position: relative; }
                    .prose pre { white-space: pre-wrap; word-wrap: break-word; background-color: var(--muted-bg); padding: 1em; padding-top: 2.5em; border-radius: 0.5rem; }
                    .prose .code-lang { font-size: 0.8em; color: var(--muted-foreground); position: absolute; top: 10px; left: 10px; }
                    .prose code { font-family: monospace; }
                    .prose .inline-code { background-color: var(--muted-bg); padding: 0.2em 0.4em; border-radius: 0.3rem; }
                    @media (max-width: 768px) { body { padding-top: 60px; } header { padding: 10px; } nav ul { display: none; } .container { padding: 10px; } h1 { font-size: 1.5em; } h2 { font-size: 1.2em; } }
                </style>
            </head>
            <body>
                <header>
                    <div class="logo">
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#906BE1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" fill="#906BE1" /></svg>
                       <span class="logo-text">Visual Map</span>
                    </div>
                    <nav>
                        <ul>
                            <li><a href="#summary">${summaryTitle}</a></li>
                            ${topVulnerableHosts.length > 0 ? `<li><a href="#vulnerable-hosts">${tRiskRanking('title')}</a></li>` : ''}
                            <li><a href="#all-hosts">${tHostsTable('title')}</a></li>
                            <li><a href="#visualizations">${visualizationsTitle}</a></li>
                            ${allCves.length > 0 ? `<li><a href="#cves">${cvesTitle}</a></li>` : ''}
                            ${allRemediations.length > 0 ? `<li><a href="#remediations">${remediationsTitle}</a></li>` : ''}
                        </ul>
                        <button id="theme-toggle" title="Toggle theme">
                            <span class="moon-icon">${moonIcon}</span>
                            <span class="sun-icon">${sunIcon}</span>
                        </button>
                    </nav>
                </header>

                <div class="container">
                    <h1>Visual Map Report</h1>
                    <p style="color: var(--muted-foreground);"><strong>File:</strong> ${fileName} | <strong>Date:</strong> ${new Date().toLocaleString(locale)}</p>

                    <section id="summary">
                        <h2>${summaryTitle}</h2>
                        <div class="grid-summary">
                            <a href="#all-hosts" class="card card-link"><div class="card-title">${tSummary('totalHosts')}</div><div class="card-value">${summary.hostCount}</div></a>
                            <a href="#visualizations" class="card card-link"><div class="card-title">${tSummary('openPorts')}</div><div class="card-value">${summary.openPorts}</div></a>
                            <a href="#visualizations" class="card card-link"><div class="card-title">${tSummary('uniqueServices')}</div><div class="card-value">${summary.uniqueServices}</div></a>
                            <a href="#vulnerable-hosts" class="card card-link card-danger">
                                <div class="card-title">${tSummary('highRiskHosts')}</div>
                                <div class="card-value card-value-danger">${hosts.filter(h => (h.riskScore ?? 0) >= 75).length}</div>
                            </a>
                            ${totalCvesCount > 0 ? `
                                <a href="#cves" class="card card-link card-danger">
                                    <div class="card-title">${cvesTitle}</div>
                                    <div class="card-value card-value-danger">${totalCvesCount}</div>
                                </a>
                            ` : ''}
                        </div>
                    </section>
                    
                    ${topVulnerableHostsData.length > 0 ? `
                    <section id="vulnerable-hosts">
                        <h2>${tRiskRanking('title')}</h2>
                        <div class="table-responsive">
                            <table>
                                <thead><tr><th>${tHostsTable('ipAddress')}</th><th>${tHostsTable('hostname')}</th><th>${osTitle}</th><th>${tHostsTable('riskScore')}</th></tr></thead>
                                <tbody>
                                    ${topVulnerableHostsData.map(h => `
                                        <tr>
                                            <td><a href="#host-${h.address[0].addr.replace(/\./g, '-')}">${h.address[0].addr}</a></td>
                                            <td>${h.hostname}</td>
                                            <td>${h.osName}</td>
                                            <td><span class="badge ${getRiskClass(h.riskScore ?? 0)}">${h.riskScore?.toFixed(0) ?? '0'}</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </section>
                    ` : ''}

                    <section id="all-hosts">
                        <h2>${tHostsTable('title')} (${hosts.length})</h2>
                        <div class="table-responsive">
                            <table>
                            <thead><tr><th>${tHostsTable('ipAddress')}</th><th>${tHostsTable('hostname')}</th><th>${osTitle}</th><th>${tHostsTable('openPorts')}</th><th>${tHostsTable('riskScore')}</th></tr></thead>
                            <tbody>
                                ${allHostsData.map(h => `
                                    <tr>
                                        <td><a href="#host-${h.address[0].addr.replace(/\./g, '-')}">${h.address[0].addr}</a></td>
                                        <td>${h.hostname}</td>
                                        <td>${h.osName}</td>
                                        <td>${getOpenPortsCount(h)}</td>
                                        <td><span class="badge ${getRiskClass(h.riskScore ?? 0)}">${h.riskScore?.toFixed(0) ?? '0'}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            </table>
                        </div>
                    </section>

                    <section id="visualizations">
                        <h2>${visualizationsTitle}</h2>
                        <div class="chart-container"><h3>${tDetails('hostRiskDistributionTitle')}</h3>${riskChart ? `<img src="${riskChart}">` : `<p class="unavailable">${chartNotAvailableText}</p>`}</div>
                        <div class="chart-container"><h3>${tDetails('topPortsTitle')}</h3>${portsChart ? `<img src="${portsChart}">` : `<p class="unavailable">${chartNotAvailableText}</p>`}</div>
                        <div class="chart-container"><h3>${tDetails('serviceDistributionTitle')}</h3>${servicesChart ? `<img src="${servicesChart}">` : `<p class="unavailable">${chartNotAvailableText}</p>`}</div>
                        ${allCves.length > 0 && threatsChart ? `<div class="chart-container"><h3>${tDetails('vulnerabilities')}</h3><img src="${threatsChart}"></div>` : ''}
                    </section>
                    
                    ${allCves.length > 0 ? `
                    <section id="cves">
                        <h2>${cvesTitle}</h2>
                        <div class="table-responsive">
                            <table>
                                <thead><tr><th>CVE ID</th><th>${cvssTitle}</th><th>${tDetails('service')}</th><th>${tHostsTable('ipAddress')}</th></tr></thead>
                                <tbody>
                                    ${allCves.sort((a,b) => (b.cve.cvssScore ?? -1) - (a.cve.cvssScore ?? -1)).map(cve => `
                                        <tr>
                                            <td><a href="https://nvd.nist.gov/vuln/detail/${cve.cve.cveId}" target="_blank">${cve.cve.cveId}</a></td>
                                            <td><span class="badge ${getCveRiskClass(cve.cve.cvssScore)}">${cve.cve.cvssScore?.toFixed(1) ?? 'N/A'}</span></td>
                                            <td>${cve.service.product} ${cve.service.version || ''} (Port ${cve.portId})</td>
                                            <td><a href="#host-${cve.hostIp.replace(/\./g, '-')}">${cve.hostIp}</a></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </section>
                    ` : ''}

                    ${remediationsHtml}

                    <section id="host-details">
                      <h2>${tDetails('hosts')}</h2>
                      ${hostDetailsHtml}
                    </section>
                </div>
                <script>
                    const themeToggle = document.getElementById('theme-toggle');
                    const html = document.documentElement;
                    
                    const setHtmlClass = (isDark) => {
                        html.classList.toggle('dark', isDark);
                    };

                    // Set initial theme based on class
                    setHtmlClass(html.classList.contains('dark'));
                    
                    themeToggle.addEventListener('click', () => {
                        setHtmlClass(!html.classList.contains('dark'));
                    });
                </script>
            </body>
            </html>
        `;
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `visual-map-report-${getFormattedTimestamp()}.html`;
        link.click();
        URL.revokeObjectURL(link.href);

    } catch (error) {
      console.error("Error exporting HTML:", error);
    } finally {
      setIsExportingHtml(false);
    }
  }, [locale, tDetails, tSummary, tHostsTable, tRiskRanking, resolvedTheme, toast]);

  const handleExportPdf = useCallback(async () => {
    const { scanResult: currentScanResult, cveCache: currentCveCache, remediationCache: currentRemediationCache } = useScanStore.getState();
    if (!currentScanResult) return;
  
    if (currentScanResult.hosts.length > 50) {
      toast({
        title: locale === 'es' ? 'Generando Informe PDF' : 'Generating PDF Report',
        description: locale === 'es' ? 'Esto puede tardar un momento para escaneos grandes...' : 'This may take a moment for large scans...',
      });
    }
    setIsExportingPdf(true);
    
    try {
        const doc = new jsPDF({
            orientation: 'p',
            unit: 'px',
            format: 'a4',
        }) as jsPDFWithAutoTable;

        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 30;
        let yPos = margin;
    
        // --- Cover Page ---
        doc.setFillColor('#000000');
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
    
        yPos = pageHeight / 2 - 20; // Center vertically and move up
        doc.setFontSize(24);
        doc.setTextColor('#ffffff');
        doc.setFont('Helvetica', 'bold');
        doc.text("Visual Map Report", pageWidth / 2, yPos, { align: 'center' });
    
        yPos += 30;
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(12);
        const fileText = locale === 'es' ? 'Archivo' : 'File';
        const dateText = locale === 'es' ? 'Fecha' : 'Date';
        doc.text(`${fileText}: ${currentScanResult.fileName}`, pageWidth / 2, yPos, { align: 'center' });
    
        yPos += 20;
        doc.text(`${dateText}: ${new Date().toLocaleString(locale)}`, pageWidth / 2, yPos, { align: 'center' });
    
        doc.addPage();
        yPos = margin;
    
        const getRiskColor = (score: number): [number, number, number] => {
            if (score >= 90) return [239, 68, 68];
            if (score >= 75) return [249, 115, 22];
            if (score >= 40) return [251, 191, 36];
            if (score > 0) return [34, 197, 94];
            return [107, 114, 128];
        };
    
        const drawCell = (data: any, isCve = false) => {
            const scoreText = data.cell.text[0];
            if (scoreText) {
                const score = Number(scoreText);
                if (!isNaN(score)) {
                    let riskColor: [number, number, number];
                    if (isCve) {
                        if (score >= 9.0) riskColor = [239, 68, 68];
                        else if (score >= 7.0) riskColor = [249, 115, 22];
                        else if (score >= 4.0) riskColor = [251, 191, 36];
                        else riskColor = [34, 197, 94];
                    } else {
                        riskColor = getRiskColor(score);
                    }
        
                    doc.setFillColor(riskColor[0], riskColor[1], riskColor[2]);
                    const badgeWidth = isCve ? 30 : 25;
                    const badgeHeight = 12;
                    const cell = data.cell;
                    const x = cell.x + (cell.width - badgeWidth) / 2;
                    const y = cell.y + (cell.height - badgeHeight) / 2;
                    doc.roundedRect(x, y, badgeWidth, badgeHeight, 6, 6, 'F');
        
                    const textColor = (isCve && score < 4.0) || (!isCve && score < 40) ? '#000000' : '#ffffff';
                    doc.setTextColor(textColor);
        
                    doc.setFontSize(9);
                    doc.text(scoreText, cell.x + cell.width / 2, cell.y + cell.height / 2, {
                        align: 'center',
                        baseline: 'middle'
                    });
                }
            }
        };

        const allCves = Array.from(currentCveCache.entries())
            .filter(([, entry]) => entry.status === 'loaded' && entry.data)
            .flatMap(([hostIp, entry]) =>
                entry.data!.map(cveData => ({ ...cveData, hostIp }))
            );
        
        const uniqueCveIds = new Set(allCves.map(cveItem => cveItem.cve.cveId));
        const totalCvesCount = uniqueCveIds.size;
    
        // -- Summary --
        const primaryColor = '#906BE1';
        const summaryTitle = locale === 'es' ? 'Resumen' : 'Summary';
        const metricTitle = locale === 'es' ? 'Métrica' : 'Metric';
        const valueTitle = locale === 'es' ? 'Valor' : 'Value';
        const cvesTitle = locale === 'es' ? 'CVEs Descubiertos' : 'Discovered CVEs';
        doc.setFontSize(22);
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor('#000000');
        doc.text(summaryTitle, margin, yPos);
        yPos += 25;
        
        const summaryBody = [
            [tSummary('totalHosts'), currentScanResult.summary.hostCount],
            [tSummary('openPorts'), currentScanResult.summary.openPorts],
            [tSummary('uniqueServices'), currentScanResult.summary.uniqueServices],
            [tSummary('highRiskHosts'), currentScanResult.hosts.filter(h => (h.riskScore ?? 0) >= 75).length],
        ];

        if (totalCvesCount > 0) {
            summaryBody.push([cvesTitle, totalCvesCount]);
        }

        autoTable(doc, {
            startY: yPos,
            head: [[metricTitle, valueTitle]],
            body: summaryBody,
            theme: 'striped',
            headStyles: { fillColor: primaryColor, textColor: '#ffffff', font: 'Helvetica', fontStyle: 'bold' },
            styles: { font: 'Helvetica', cellPadding: 8 }
        });
        yPos = doc.lastAutoTable.finalY + 30;

        // -- Top Vulnerable Hosts --
        const topVulnerableHosts = [...currentScanResult.hosts]
            .filter(h => (h.riskScore ?? 0) >= 70)
            .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));
        
        const topVulnerableHostsData = topVulnerableHosts.map(h => ({ ...h, hostname: getHostname(h), osName: getOsName(h) }));

        if (topVulnerableHostsData.length > 0) {
            if (yPos > pageHeight - 120) { doc.addPage(); yPos = margin; }
            doc.setFontSize(22);
            doc.setFont('Helvetica', 'bold');
            doc.text(tRiskRanking('title'), margin, yPos);
            yPos += 25;
            autoTable(doc, {
                startY: yPos,
                head: [[tHostsTable('ipAddress'), tHostsTable('hostname'), tDetails('os'), tHostsTable('riskScore')]],
                body: topVulnerableHostsData.map(h => [
                    h.address[0].addr,
                    h.hostname,
                    h.osName,
                    h.riskScore?.toFixed(0) ?? '0'
                ]),
                theme: 'striped',
                headStyles: { fillColor: primaryColor, textColor: '#ffffff', font: 'Helvetica', fontStyle: 'bold' },
                styles: { font: 'Helvetica', cellPadding: 8, halign: 'center' },
                columnStyles: { 0: { halign: 'left' }, 1: { halign: 'left' }, 2: { halign: 'left' } },
                didDrawCell: (data) => {
                    if (data.column.index === 3 && data.section === 'body') {
                        drawCell(data);
                    }
                }
            });
            yPos = doc.lastAutoTable.finalY + 30;
        }

        // -- All Hosts Table --
        const allHostsSortedByIp = [...currentScanResult.hosts].sort((a, b) => ipToNumber(a.address[0].addr) - ipToNumber(b.address[0].addr));
        const allHostsData = allHostsSortedByIp.map(h => ({ ...h, hostname: getHostname(h), osName: getOsName(h) }));
    
        if (yPos > pageHeight - 120) { doc.addPage(); yPos = margin; }
        doc.setFontSize(22);
        doc.setFont('Helvetica', 'bold');
        doc.text(tHostsTable('title'), margin, yPos);
        yPos += 25;
        autoTable(doc, {
            startY: yPos,
            head: [[tHostsTable('ipAddress'), tHostsTable('hostname'), tDetails('os'), tHostsTable('openPorts'), tHostsTable('riskScore')]],
            body: allHostsData.map(h => [
                h.address[0].addr,
                h.hostname,
                h.osName,
                getOpenPortsCount(h),
                h.riskScore?.toFixed(0) ?? '0'
            ]),
            theme: 'striped',
            headStyles: { fillColor: primaryColor, textColor: '#ffffff', font: 'Helvetica', fontStyle: 'bold' },
            styles: { font: 'Helvetica', cellPadding: 8, halign: 'center' },
            columnStyles: { 0: { halign: 'left' }, 1: { halign: 'left' }, 2: { halign: 'left' } },
            didDrawCell: (data) => {
                if (data.column.index === 4 && data.section === 'body') {
                    drawCell(data);
                }
            },
            pageBreak: 'auto'
        });
        yPos = doc.lastAutoTable.finalY + 30;
    
        // -- Visualizations --
        const addChart = async (elementId: string, title: string) => {
            if (yPos > pageHeight - 150) { doc.addPage(); yPos = margin; }
            doc.setFontSize(18);
            doc.setFont('Helvetica', 'bold');
            doc.setTextColor('#000000');
            doc.text(title, margin, yPos);
            yPos += 15;
            try {
              const imgData = await captureChartAsBase64(elementId, { backgroundColor: '#ffffff' });
              if (imgData) {
                const imgProps = doc.getImageProperties(imgData);
                const imgWidth = pageWidth - (margin * 2);
                const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
                if (yPos + imgHeight > pageHeight - margin) { doc.addPage(); yPos = margin; doc.setFontSize(18); doc.setFont('Helvetica', 'bold'); doc.text(title, margin, yPos); yPos += 15; }
                doc.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
                yPos += imgHeight + 25;
              } else {
                doc.setFontSize(11);
                doc.setTextColor('#6b7280');
                doc.text('Chart not available. Navigate to the corresponding page to include it in the report.', margin, yPos);
                yPos += 20;
              }
            } catch (chartError) {
              console.error("Chart export error:", chartError);
              doc.setFontSize(11);
              doc.setTextColor('#6b7280');
              doc.text('Chart could not be generated.', margin, yPos);
              yPos += 20;
            }
        };
    
        if (yPos > pageHeight - 50) { doc.addPage(); yPos = margin; }
        doc.setFontSize(22);
        doc.setFont('Helvetica', 'bold');
        const visualizationsTitle = locale === 'es' ? 'Visualizaciones' : 'Visualizations';
        doc.text(visualizationsTitle, margin, yPos);
        yPos += 25;
    
        await addChart('risk-distribution-chart', tDetails('hostRiskDistributionTitle'));
        await addChart('top-ports-chart', tDetails('topPortsTitle'));
        await addChart('service-distribution-chart', tDetails('serviceDistributionTitle'));
    
        // -- Discovered CVEs --
        if (allCves.length > 0) {
            await addChart('pdf-threat-service-dist-chart', tDetails('vulnerabilities'));

            if (yPos > pageHeight - 120) { doc.addPage(); yPos = margin; }
            doc.setFontSize(22);
            doc.setFont('Helvetica', 'bold');
            const cvssScoreTitle = locale === 'es' ? 'Puntuación CVSS' : 'CVSS Score';
            doc.text(cvesTitle, margin, yPos);
            yPos += 25;
            autoTable(doc, {
                startY: yPos,
                head: [['CVE ID', cvssScoreTitle, tDetails('service'), tHostsTable('ipAddress')]],
                body: allCves.sort((a, b) => (b.cve.cvssScore ?? -1) - (a.cve.cvssScore ?? -1)).map(cve => [
                    cve.cve.cveId,
                    cve.cve.cvssScore?.toFixed(1) ?? 'N/A',
                    `${cve.service.product} ${cve.service.version || ''}`,
                    cve.hostIp
                ]),
                theme: 'striped',
                headStyles: { fillColor: primaryColor, textColor: '#ffffff', font: 'Helvetica', fontStyle: 'bold' },
                styles: { font: 'Helvetica', fontSize: 9, cellPadding: 8, halign: 'center' },
                columnStyles: { 0: { halign: 'left' }, 2: { halign: 'left' }, 3: { halign: 'left' } },
                didDrawCell: (data) => {
                    if (data.column.index === 1 && data.section === 'body') {
                        drawCell(data, true);
                    }
                }
            });
            yPos = doc.lastAutoTable.finalY + 30;
        }

        // -- Remediations --
        const allRemediations = Array.from(currentRemediationCache.entries())
            .filter(([, entry]) => entry.status === 'loaded' && entry.data)
            .map(([cveId, entry]) => ({ cveId: cveId.replace(/-\w{2}$/, ''), remediation: entry.data!.remediation }));

        if (allRemediations.length > 0) {
            if (yPos > pageHeight - 80) { doc.addPage(); yPos = margin; }
            doc.setFontSize(22);
            doc.setFont('Helvetica', 'bold');
            const remediationsTitle = locale === 'es' ? 'Remediaciones' : 'Remediations';
            doc.text(remediationsTitle, margin, yPos);
            yPos += 25;

            for (const rem of allRemediations) {
                if (yPos > pageHeight - 60) { doc.addPage(); yPos = margin; }
                
                doc.setFontSize(16);
                doc.setFont('Helvetica', 'bold');
                doc.text(rem.cveId, margin, yPos);
                yPos += 20;

                yPos = formatRemediationForPdf(doc, rem.remediation, yPos, pageHeight, margin, pageWidth);
                yPos += 15; // Space between remediations
            };
            yPos += 15;
        }
    
        // -- Detailed Host Info --
        const detailedHostInfoTitle = locale === 'es' ? 'Información Detallada de Hosts' : 'Detailed Host Information';
        if (yPos > pageHeight - 80) { doc.addPage(); yPos = margin; }
        doc.setFontSize(22);
        doc.setFont('Helvetica', 'bold');
        doc.text(detailedHostInfoTitle, margin, yPos);
        yPos += 15;
    
        const processHostDetails = async (hosts: typeof allHostsData) => {
             for (const host of hosts) {
                if (yPos > pageHeight - 100) { doc.addPage(); yPos = margin; }
                yPos += 20;
                doc.setFontSize(16);
                doc.setFont('Helvetica', 'bold');
                doc.text(`Host: ${host.address[0].addr} (${host.hostname})`, margin, yPos);
                yPos += 15;
    
                const openPorts = (Array.isArray(host.ports.port) ? host.ports.port : (host.ports.port ? [host.ports.port] : []))
                    .filter(p => p?.state.state === 'open');
    
                if (openPorts.length > 0) {
                    autoTable(doc, {
                        startY: yPos,
                        head: [[tDetails('port'), tDetails('protocol'), tDetails('service'), tDetails('product'), tDetails('version')]],
                        body: openPorts.map(p => [
                            p.portid,
                            p.protocol,
                            p.service?.name || '',
                            p.service?.product || '',
                            p.service?.version || ''
                        ]),
                        theme: 'grid',
                        headStyles: { fillColor: '#4a5568', textColor: '#ffffff' },
                        styles: { font: 'Helvetica', fontSize: 9, cellPadding: 6 },
                        pageBreak: 'auto'
                    });
                    yPos = doc.lastAutoTable.finalY;
                } else {
                    doc.setFontSize(11);
                    doc.setFont('Helvetica', 'normal');
                    doc.text('No open ports detected for this host.', margin, yPos);
                    yPos += 15;
                }
            };
        };
    
        await processHostDetails(allHostsData);
    
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(9);
            doc.setTextColor('#6b7280');
            doc.text(`${tHostsTable('page', { currentPage: i, totalPages: pageCount })}`, pageWidth / 2, pageHeight - 15, { align: 'center' });
        }
    
        doc.save(`visual-map-report-${getFormattedTimestamp()}.pdf`);
  
    } catch (error) {
        console.error("Error exporting PDF:", error);
        toast({
            variant: 'destructive',
            title: 'PDF Export Failed',
            description: locale === 'es' ? 'Ocurrió un error inesperado al generar el PDF.' : 'An unexpected error occurred while generating the PDF.',
        });
    } finally {
        setIsExportingPdf(false);
    }
  }, [locale, tDetails, tSummary, tHostsTable, tRiskRanking, toast]);


  const sidebarTooltip = (text: string) => {
    return state === 'collapsed' ? text : undefined;
  };
  
  const handleAccordionTriggerClick = () => {
    if (state === 'collapsed') {
      setOpen(true);
    }
  };

  const remediationsTitle = locale === 'es' ? 'Remediaciones' : 'Remediations';
  
  return (
    <TooltipProvider>
      <SidebarHeader className="flex h-14 pt-4 px-4">
        {scanResult && (
          <Link href="/" className="flex gap-2 group-data-[collapsible=icon]:justify-start items-center">
            <VmLogo className="h-6 w-6" />
            <h1 className="text-lg font-bold tracking-tight group-data-[collapsible=icon]:hidden font-headline">{tHeader('title')}</h1>
          </Link>
        )}
      </SidebarHeader>
      <SidebarContent>
        
            <SidebarGroup>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <Link href="/" className='w-full'>
                            <SidebarMenuButton isActive={pathname === '/'} tooltip={sidebarTooltip(locale === 'es' ? 'Dashboard' : 'Dashboard')}>
                                <Home />
                                <span className="group-data-[collapsible=icon]:hidden">{locale === 'es' ? 'Dashboard' : 'Dashboard'}</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <Link href="/details/hosts" className='w-full'>
                            <SidebarMenuButton isActive={pathname.startsWith('/details/hosts')} tooltip={sidebarTooltip(tDetails('hosts'))}>
                                <Server />
                                <span className="group-data-[collapsible=icon]:hidden">{tDetails('hosts')}</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <Link href="/details/ports" className='w-full'>
                            <SidebarMenuButton isActive={pathname.startsWith('/details/ports')} tooltip={sidebarTooltip(tDetails('openPorts'))}>
                                <DoorOpen />
                                <span className="group-data-[collapsible=icon]:hidden">{tDetails('openPorts')}</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <Link href="/details/services" className='w-full'>
                            <SidebarMenuButton isActive={pathname.startsWith('/details/services')} tooltip={sidebarTooltip(tDetails('services'))}>
                                <Shield />
                                <span className="group-data-[collapsible=icon]:hidden">{tDetails('services')}</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <Link href="/details/vulnerable-hosts" className='w-full'>
                            <SidebarMenuButton isActive={pathname.startsWith('/details/vulnerable-hosts')} tooltip={sidebarTooltip(locale === 'es' ? 'Hosts Vulnerables' : 'Vulnerable Hosts')}>
                                <AlertTriangle />
                                <span className="group-data-[collapsible=icon]:hidden">{locale === 'es' ? 'Hosts Vulnerables' : 'Vulnerable Hosts'}</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <Link href="/details/vulnerabilities" className='w-full'>
                            <SidebarMenuButton isActive={pathname.startsWith('/details/vulnerabilities')} tooltip={sidebarTooltip(tDetails('vulnerabilities'))}>
                                <Skull />
                                <span className="group-data-[collapsible=icon]:hidden flex-1 flex items-center justify-between">
                                    {tDetails('vulnerabilities')}
                                </span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <Link href="/details/remediations" className='w-full'>
                            <SidebarMenuButton isActive={pathname.startsWith('/details/remediations')} tooltip={sidebarTooltip(remediationsTitle)}>
                                <HeartPulse />
                                <span className="group-data-[collapsible=icon]:hidden">{remediationsTitle}</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <Link href="/details/network" className='w-full'>
                            <SidebarMenuButton isActive={pathname.startsWith('/details/network')} tooltip={sidebarTooltip(tDetails('networkGraph'))}>
                                <Network />
                                <span className="group-data-[collapsible=icon]:hidden">{tDetails('networkGraph')}</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarGroup>
            <SidebarSeparator className="my-4" />
            <SidebarGroup>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <Link href="/details/api" className='w-full'>
                            <SidebarMenuButton isActive={pathname.startsWith('/details/api')} tooltip={sidebarTooltip(tApi('title'))}>
                                <KeyRound />
                                <span className="group-data-[collapsible=icon]:hidden flex-1 flex items-center justify-between">
                                    {tApi('title')}
                                </span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarGroup>
            <SidebarSeparator className="my-4" />
            <Accordion type="single" collapsible className="w-full" value={openAccordion} onValueChange={setOpenAccordion}>
                <SidebarGroup>
                    <AccordionItem value="risk-weighting" className="border-none">
                       {state === 'collapsed' ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <AccordionTrigger onClick={handleAccordionTriggerClick} className="px-2 py-1.5 hover:no-underline hover:bg-primary/10 rounded-md group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center text-sm font-medium [&[data-state=open]>div>svg:last-child]:rotate-180">
                                        <SlidersHorizontal className="h-4 w-4" />
                                    </AccordionTrigger>
                                </TooltipTrigger>
                                <TooltipContent side="right" align="center">
                                    <p>{tSidebar('riskWeighting')}</p>
                                </TooltipContent>
                            </Tooltip>
                       ) : (
                          <AccordionTrigger 
                              onClick={handleAccordionTriggerClick}
                              className="px-2 py-1.5 hover:no-underline hover:bg-primary/10 rounded-md group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center text-sm font-medium [&[data-state=open]>div>svg:last-child]:rotate-180"
                          >
                            <div className='flex items-center justify-between w-full'>
                                <div className='flex items-center gap-2'>
                                    <SlidersHorizontal className="h-4 w-4" />
                                    <span className="group-data-[collapsible=icon]:hidden">{tSidebar('riskWeighting')}</span>
                                </div>
                                <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[collapsible=icon]:hidden" />
                            </div>
                          </AccordionTrigger>
                       )}

                        <AccordionContent>
                            <Card className="bg-background/50">
                                <CardContent className="p-4 space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <Label htmlFor="critical-ports-weight" className='text-xs'>
                                                {locale === 'es' ? 'Puertos Críticos' : 'Critical Ports'}
                                            </Label>
                                            <span className="text-xs text-muted-foreground">{localWeights.criticalPorts}/100</span>
                                        </div>
                                        <Slider value={[localWeights.criticalPorts]} max={100} step={1} onValueChange={(v) => handleWeightChange('criticalPorts', v)} onValueCommit={(v) => commitWeightChange('criticalPorts', v)} id="critical-ports-weight"/>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <Label htmlFor="cve-weight" className='text-xs'>{tDetails('vulnerabilities')}</Label>
                                            <span className="text-xs text-muted-foreground">{localWeights.cveScore}/100</span>
                                        </div>
                                        <Slider value={[localWeights.cveScore]} max={100} step={1} onValueChange={(v) => handleWeightChange('cveScore', v)} onValueCommit={(v) => commitWeightChange('cveScore', v)} id="cve-weight"/>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <Label htmlFor="vuln-scripts-weight" className='text-xs'>{tSidebar('nseScripts')}</Label>
                                            <span className="text-xs text-muted-foreground">{localWeights.vulnScripts}/100</span>
                                        </div>
                                        <Slider value={[localWeights.vulnScripts]} max={100} step={1} onValueChange={(v) => handleWeightChange('vulnScripts', v)} onValueCommit={(v) => commitWeightChange('vulnScripts', v)} id="vuln-scripts-weight"/>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <Label htmlFor="service-version-weight" className='text-xs'>{tSidebar('serviceVersions')}</Label>
                                            <span className="text-xs text-muted-foreground">{localWeights.serviceVersions}/100</span>
                                        </div>
                                        <Slider value={[localWeights.serviceVersions]} max={100} step={1} onValueChange={(v) => handleWeightChange('serviceVersions', v)} onValueCommit={(v) => commitWeightChange('serviceVersions', v)} id="service-version-weight" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <Label htmlFor="open-ports-weight" className='text-xs'>{tSidebar('openPorts')}</Label>
                                            <span className="text-xs text-muted-foreground">{localWeights.openPortsCount}/100</span>
                                        </div>
                                        <Slider value={[localWeights.openPortsCount]} max={100} step={1} onValueChange={(v) => handleWeightChange('openPortsCount', v)} onValueCommit={(v) => commitWeightChange('openPortsCount', v)} id="open-ports-weight"/>
                                    </div>
                                </CardContent>
                            </Card>
                        </AccordionContent>
                    </AccordionItem>
                </SidebarGroup>
                <SidebarGroup>
                    <AccordionItem value="export" className="border-none">
                         {state === 'collapsed' ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                  <AccordionTrigger 
                                      onClick={handleAccordionTriggerClick}
                                      className="px-2 py-1.5 hover:no-underline hover:bg-primary/10 rounded-md group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center text-sm font-medium [&[data-state=open]>div>svg:last-child]:rotate-180"
                                  >
                                    <Download className="h-4 w-4" />
                                  </AccordionTrigger>
                              </TooltipTrigger>
                              <TooltipContent side="right" align="center"><p>{tSidebar('export')}</p></TooltipContent>
                            </Tooltip>
                         ) : (
                            <AccordionTrigger 
                                onClick={handleAccordionTriggerClick}
                                className="px-2 py-1.5 hover:no-underline hover:bg-primary/10 rounded-md group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center text-sm font-medium [&[data-state=open]>div>svg:last-child]:rotate-180"
                            >
                                <div className='flex items-center justify-between w-full'>
                                    <div className='flex items-center gap-2'>
                                        <Download className="h-4 w-4" />
                                        <span className="group-data-[collapsible=icon]:hidden">{tSidebar('export')}</span>
                                    </div>
                                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[collapsible=icon]:hidden" />
                                </div>
                            </AccordionTrigger>
                         )}
                        <AccordionContent>
                            <div className="mt-4 flex flex-col items-center justify-center gap-2">
                                <Button variant="outline" size="sm" onClick={handleExportJson} className="w-full h-8 hover:bg-primary hover:text-primary-foreground text-xs" disabled={isExportingPdf || isExportingHtml}>
                                    <Download />
                                    {tSidebar('exportJson')}
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleExportHtml} disabled={isExportingPdf || isExportingHtml} className="w-full h-8 hover:bg-primary hover:text-primary-foreground text-xs">
                                    {isExportingHtml ? <Loader2 className="animate-spin" /> : <Download />}
                                    {tSidebar('exportHtml')}
                                </Button>

                                <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={isExportingPdf || isExportingHtml} className="w-full h-8 hover:bg-primary hover:text-primary-foreground text-xs">
                                    {isExportingPdf ? <Loader2 className="animate-spin" /> : <Download />}
                                    {tSidebar('exportPdf')}
                                </Button>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </SidebarGroup>
            </Accordion>
        
      </SidebarContent>
    </TooltipProvider>
  );
}
