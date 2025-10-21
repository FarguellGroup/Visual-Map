

'use client';

import { SidebarContent, SidebarGroup, SidebarSeparator, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '../ui/button';
import { Download, Loader2, Home, Users, Shield, Server, DoorOpen, Network, Skull, SlidersHorizontal, ChevronDown, KeyRound } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useScanStore, type RiskWeights } from '@/store/use-scan-store';
import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import type { Host, Script, CveData } from '@/types/nmap';
import { Slider } from '../ui/slider';
import { Link, usePathname } from '@/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { useSidebar } from '@/components/ui/sidebar';
import { useTheme } from 'next-themes';
import { VmLogo } from '../icons';


// Extend jsPDF with autoTable
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
  lastAutoTable: { finalY: number };
}

const getScripts = (item: Host): Script[] => {
    const scriptsSource = item.hostscript;
    if (!scriptsSource) return [];

    const scripts: Script[] = [];
    
    const potentialScripts = Array.isArray(scriptsSource) ? scriptsSource : [scriptsSource];

    potentialScripts.forEach(potential => {
        if (potential) {
            if ('script' in potential) { 
                const nested = (potential as any).script;
                if (Array.isArray(nested)) {
                    scripts.push(...nested);
                } else if (nested) {
                    scripts.push(nested);
                }
            } else if ('id' in potential) { 
                scripts.push(potential as Script);
            }
        }
    });

    return scripts;
};

const getHostname = (host: Host | null): string => {
  if (!host) {
    return 'N/A';
  }

  // 1. Try to get from hostnames array
  if (host.hostnames && Array.isArray(host.hostnames)) {
    for (const hostnamesEntry of host.hostnames) {
      if (hostnamesEntry && hostnamesEntry.hostname) {
        const hostnameArray = Array.isArray(hostnamesEntry.hostname) ? hostnamesEntry.hostname : [hostnamesEntry.hostname];
        const primaryHostname = hostnameArray.find(h => h.type === 'user' || h.type === 'PTR');
        if (primaryHostname) {
          return primaryHostname.name;
        }
      }
    }
  } else if (host.hostnames && !Array.isArray(host.hostnames) && host.hostnames.hostname) {
      const hostnameArray = Array.isArray(host.hostnames.hostname) ? host.hostnames.hostname : [host.hostnames.hostname];
      const primaryHostname = hostnameArray.find(h => h.type === 'user' || h.type === 'PTR');
      if (primaryHostname) {
        return primaryHostname.name;
      }
  }


  // 2. If not found, try to get from smb-os-discovery script
  const hostScripts = getScripts(host);
  const smbScript = hostScripts.find(s => s.id === 'smb-os-discovery');
  if (smbScript) {
    const output = smbScript.output;
    const computerNameMatch = output.match(/Computer name: ([\w-]+)/);
    if (computerNameMatch && computerNameMatch[1]) {
      return computerNameMatch[1];
    }
  }

  return 'N/A';
};

const getOsName = (host: Host | null): string => {
    if (!host || !host.os || !host.os.osmatch) {
        return 'N/A';
    }
    const osMatches = Array.isArray(host.os.osmatch) ? host.os.osmatch : [host.os.osmatch];
    if (osMatches.length > 0) {
        const bestMatch = osMatches.reduce((prev, current) => (parseInt(prev.accuracy) > parseInt(current.accuracy)) ? prev : current);
        return bestMatch.name;
    }
    return 'N/A';
};


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

export default function AppSidebar() {
  const tHeader = useTranslations('Header');
  const tSidebar = useTranslations('Sidebar');
  const tDetails = useTranslations('DetailsPage');
  const tSummary = useTranslations('SummaryCards');
  const tHostsTable = useTranslations('HostsTable');
  const tRiskRanking = useTranslations('RiskRanking');
  const tApi = useTranslations('ApiPage');
  
  const { scanResult, riskWeights, setRiskWeights, setScanResult, cveCache } = useScanStore();
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingHtml, setIsExportingHtml] = useState(false);
  const [accordionValue, setAccordionValue] = useState<string>('');
  const [localWeights, setLocalWeights] = useState<RiskWeights>(riskWeights);
  const { state, setOpen } = useSidebar();
  const locale = useLocale();
  const pathname = usePathname();
  const { theme } = useTheme();

  useEffect(() => {
    setLocalWeights(riskWeights);
  }, [riskWeights]);

  useEffect(() => {
    if (state === 'collapsed' && accordionValue) {
      setAccordionValue('');
    }
  }, [state, accordionValue, setAccordionValue]);

  const handleWeightChange = (factor: keyof typeof riskWeights, value: number[]) => {
    setLocalWeights(prev => ({ ...prev, [factor]: value[0] }));
  };

  const commitWeightChange = (factor: keyof typeof riskWeights, value: number[]) => {
    if (!scanResult) return;
    const newWeights = { ...riskWeights, [factor]: value[0] };
    setRiskWeights(newWeights);
    // Trigger recalculation
    setScanResult(scanResult.fileName, scanResult.originalHosts, newWeights, false);
  };

  const handleExportJson = () => {
    if (!scanResult) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(scanResult, null, 2)
    )}`;
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = `visual-map-report-${getFormattedTimestamp()}.json`;
    link.click();
  };

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

  const handleExportHtml = async () => {
    if (!scanResult) return;
    setIsExportingHtml(true);
    try {
        const { fileName, hosts, summary } = scanResult;
        
        const currentThemeBg = theme === 'dark' ? '#09090b' : '#ffffff';
        const riskChart = await captureChartAsBase64('risk-distribution-chart', { backgroundColor: currentThemeBg });
        const portsChart = await captureChartAsBase64('top-ports-chart', { backgroundColor: currentThemeBg });
        const servicesChart = await captureChartAsBase64('service-distribution-chart', { backgroundColor: currentThemeBg });
        
        const allCves = Array.from(cveCache.entries())
            .filter(([, entry]) => entry.status === 'loaded' && entry.data)
            .flatMap(([hostIp, entry]) => 
                entry.data!.map(cveData => ({...cveData, hostIp}))
            );

        const threatsChart = allCves.length > 0 
            ? await captureChartAsBase64('threat-service-dist-chart', { backgroundColor: currentThemeBg })
            : null;

        const topVulnerableHosts = [...hosts]
            .filter(h => (h.riskScore ?? 0) >= 60)
            .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));
        
        const allHostsSorted = [...hosts].sort((a,b) => ipToNumber(a.address[0].addr) - ipToNumber(b.address[0].addr));

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

        const chartNotAvailableText = locale === 'es' ? 'Gráfico no disponible. Navegue a la página correspondiente para incluirlo en el informe.' : 'Chart not available. Navigate to the corresponding page to include it in the report.';
        
        const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
        const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;


        const htmlContent = `
            <!DOCTYPE html>
            <html lang="${locale}" class="${theme === 'dark' ? 'dark' : ''}">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Visual Map Report</title>
                <style>
                    :root {
                        --background-light: #ffffff; --foreground-light: #020817; --border-light: #e4e4e7;
                        --card-light: #ffffff; --muted-light: #f4f4f5; --link-light: #906BE1;
                        --background-dark: #09090b; --foreground-dark: #f8fafc; --border-dark: #27272a;
                        --card-dark: #18181b; --muted-dark: #27272a; --link-dark: #906BE1;
                    }
                    .dark { 
                        --background: var(--background-dark); --foreground: var(--foreground-dark); 
                        --border: var(--border-dark); --card-bg: var(--card-dark); --muted-bg: var(--muted-dark);
                        --link-color: var(--link-dark);
                    }
                    html { 
                        --background: var(--background-light); --foreground: var(--foreground-light); 
                        --border: var(--border-light); --card-bg: var(--card-light); --muted-bg: var(--muted-light);
                        --link-color: var(--link-light);
                    }
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; color: var(--foreground); background-color: var(--background); margin: 0; padding-top: 80px; transition: color 0.2s, background-color 0.2s; }
                    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
                    header { position: fixed; top: 0; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; padding: 10px 20px; background-color: color-mix(in srgb, var(--background) 80%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--border); z-index: 1000; }
                    nav { display: flex; align-items: center; gap: 20px; }
                    nav ul { list-style: none; padding: 0; margin: 0; display: flex; gap: 20px; }
                    nav a { text-decoration: none; color: color-mix(in srgb, var(--foreground) 60%, transparent); font-weight: 500; font-size: 14px; transition: color 0.2s; }
                    nav a:hover { color: var(--foreground); }
                    #theme-toggle { background: none; border: none; cursor: pointer; color: color-mix(in srgb, var(--foreground) 60%, transparent); padding: 5px; }
                    #theme-toggle:hover { color: var(--foreground); }
                    #theme-toggle svg { width: 20px; height: 20px; }
                    .sun-icon { display: none; }
                    .dark .sun-icon { display: block; }
                    .dark .moon-icon { display: none; }
                    h1, h2, h3 { color: var(--foreground); font-weight: 600; }
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
                    .card { position: relative; padding: 20px; border: 1px solid var(--border); border-radius: 8px; background-color: var(--card-bg); }
                    .card-title { font-weight: 500; margin-bottom: 10px; color: color-mix(in srgb, var(--foreground) 70%, transparent); } .card-value { font-size: 2.5em; font-weight: bold; }
                    .chart-container { margin-top: 20px; padding: 20px; border: 1px solid var(--border); border-radius: 8px; text-align: center; background-color: var(--background); }
                    .chart-container img { max-width: 100%; height: auto; }
                    .chart-container .unavailable { color: color-mix(in srgb, var(--foreground) 70%, transparent); }
                    .table-responsive { overflow-x: auto; }
                    .logo { display: flex; align-items: center; gap: 10px; }
                    .logo svg { width: 24px; height: 24px; }
                    .logo-text { font-size: 1.2em; font-weight: bold; }
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
                            ${allCves.length > 0 ? `<li><a href="#cves">${cvesTitle}</a></li>` : ''}
                            <li><a href="#visualizations">${visualizationsTitle}</a></li>
                            <li><a href="#all-hosts">${tHostsTable('title')}</a></li>
                        </ul>
                        <button id="theme-toggle" title="Toggle theme">
                            <span class="moon-icon">${moonIcon}</span>
                            <span class="sun-icon">${sunIcon}</span>
                        </button>
                    </nav>
                </header>

                <div class="container">
                    <h1>Visual Map Report</h1>
                    <p style="color: color-mix(in srgb, var(--foreground) 70%, transparent);"><strong>File:</strong> ${fileName} | <strong>Date:</strong> ${new Date().toLocaleString(locale)}</p>

                    <section id="summary">
                        <h2>${summaryTitle}</h2>
                        <div class="grid-summary">
                            <div class="card"><div class="card-title">${tSummary('totalHosts')}</div><div class="card-value">${summary.hostCount}</div></div>
                            <div class="card"><div class="card-title">${tSummary('openPorts')}</div><div class="card-value">${summary.openPorts}</div></div>
                            <div class="card"><div class="card-title">${tSummary('uniqueServices')}</div><div class="card-value">${summary.uniqueServices}</div></div>
                            <div class="card"><div class="card-title">${tSummary('highRiskHosts')}</div><div class="card-value">${hosts.filter(h => (h.riskScore ?? 0) >= 75).length}</div></div>
                        </div>
                    </section>

                    ${topVulnerableHosts.length > 0 ? `
                    <section id="vulnerable-hosts">
                        <h2>${tRiskRanking('title')}</h2>
                        <div class="table-responsive">
                            <table>
                                <thead><tr><th>${tHostsTable('ipAddress')}</th><th>${tHostsTable('hostname')}</th><th>${osTitle}</th><th>${tHostsTable('riskScore')}</th></tr></thead>
                                <tbody>
                                    ${topVulnerableHosts.map(h => `
                                        <tr>
                                            <td><a href="#host-${h.address[0].addr.replace(/\./g, '-')}">${h.address[0].addr}</a></td>
                                            <td>${getHostname(h)}</td>
                                            <td>${getOsName(h)}</td>
                                            <td><span class="badge ${getRiskClass(h.riskScore ?? 0)}">${h.riskScore?.toFixed(0) ?? '0'}</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </section>
                    ` : ''}
                    
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
                    
                    <section id="visualizations">
                        <h2>${visualizationsTitle}</h2>
                        <div class="chart-container"><h3>${tDetails('hostRiskDistributionTitle')}</h3>${riskChart ? `<img src="${riskChart}">` : `<p class="unavailable">${chartNotAvailableText}</p>`}</div>
                        <div class="chart-container"><h3>${tDetails('topPortsTitle')}</h3>${portsChart ? `<img src="${portsChart}">` : `<p class="unavailable">${chartNotAvailableText}</p>`}</div>
                        <div class="chart-container"><h3>${tDetails('serviceDistributionTitle')}</h3>${servicesChart ? `<img src="${servicesChart}">` : `<p class="unavailable">${chartNotAvailableText}</p>`}</div>
                        ${allCves.length > 0 && threatsChart ? `<div class="chart-container"><h3>${locale === 'es' ? 'Distribución de Servicios Vulnerables' : 'Vulnerable Services Distribution'}</h3><img src="${threatsChart}"></div>` : ''}
                    </section>

                    <section id="all-hosts">
                        <h2>${tHostsTable('title')} (${hosts.length})</h2>
                        <div class="table-responsive">
                            <table>
                            <thead><tr><th>${tHostsTable('ipAddress')}</th><th>${tHostsTable('hostname')}</th><th>${osTitle}</th><th>${tHostsTable('openPorts')}</th><th>${tHostsTable('riskScore')}</th></tr></thead>
                            <tbody>
                                ${allHostsSorted.map(h => `
                                    <tr>
                                        <td><a href="#host-${h.address[0].addr.replace(/\./g, '-')}">${h.address[0].addr}</a></td>
                                        <td>${getHostname(h)}</td>
                                        <td>${getOsName(h)}</td>
                                        <td>${getOpenPortsCount(h)}</td>
                                        <td><span class="badge ${getRiskClass(h.riskScore ?? 0)}">${h.riskScore?.toFixed(0) ?? '0'}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            </table>
                        </div>
                    </section>

                    <section id="host-details">
                      <h2>${tDetails('hosts')}</h2>
                      ${allHostsSorted.map(host => `
                        <div id="host-${host.address[0].addr.replace(/\./g, '-')}" class="card" style="margin-top: 30px;">
                          <div style="position: absolute; top: 20px; right: 20px;">
                              <span class="badge ${getRiskClass(host.riskScore ?? 0)}">${tHostsTable('riskScore')}: ${host.riskScore?.toFixed(0) ?? '0'}</span>
                          </div>
                          <h3>Host: ${host.address[0].addr} (${getHostname(host)})</h3>
                          ${(Array.isArray(host.ports.port) ? host.ports.port : (host.ports.port ? [host.ports.port] : [])).filter(p => p?.state.state === 'open').length > 0 ? `
                            <div class="table-responsive">
                                <table>
                                <thead><tr><th>${tDetails('port')}</th><th>${tDetails('protocol')}</th><th>${tDetails('service')}</th><th>${tDetails('product')}</th><th>${tDetails('version')}</th></tr></thead>
                                <tbody>
                                    ${(Array.isArray(host.ports.port) ? host.ports.port : [host.ports.port]).filter(p => p?.state.state === 'open').map(p => `
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
                          ` : `<p style="color: color-mix(in srgb, var(--foreground) 70%, transparent);">${tDetails('openPorts')}: 0</p>`}
                        </div>
                      `).join('')}
                    </section>
                </div>
                <script>
                    const themeToggle = document.getElementById('theme-toggle');
                    const html = document.documentElement;
                    themeToggle.addEventListener('click', () => {
                        html.classList.toggle('dark');
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
  };

  const handleExportPdf = async () => {
    if (!scanResult) return;
    setIsExportingPdf(true);
  
    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: 'a4',
      }) as jsPDFWithAutoTable;
  
      const primaryColor = '#906BE1';
      const headingColor = '#111827';
      const mutedTextColor = '#6b7280';
      
      doc.setFont('Helvetica', 'normal');
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 30;
      let yPos = margin;

      const getRiskColor = (score: number): [number, number, number] => {
        if (score >= 90) return [239, 68, 68]; // Red
        if (score >= 75) return [249, 115, 22]; // Orange
        if (score >= 40) return [251, 191, 36]; // Yellow
        if (score > 0) return [34, 197, 94]; // Green
        return [107, 114, 128]; // Gray
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
  
      // --- Cover Page ---
      yPos = pageHeight / 3;
      doc.setFontSize(32);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(headingColor);
      doc.text("Visual Map Report", pageWidth / 2, yPos, { align: 'center' });
      yPos += 40;
      doc.setFontSize(14);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(mutedTextColor);
      doc.text(`File: ${scanResult.fileName}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 20;
      doc.text(`Date: ${new Date().toLocaleString(locale)}`, pageWidth / 2, yPos, { align: 'center' });
      
      doc.addPage();
      yPos = margin;
  
      // -- Summary --
      doc.setFontSize(22);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(headingColor);
      doc.text('Summary', margin, yPos);
      yPos += 25;
      doc.autoTable({
        startY: yPos,
        head: [['Metric', 'Value']],
        body: [
          [tSummary('totalHosts'), scanResult.summary.hostCount],
          [tSummary('openPorts'), scanResult.summary.openPorts],
          [tSummary('uniqueServices'), scanResult.summary.uniqueServices],
          [tSummary('highRiskHosts'), scanResult.hosts.filter(h => (h.riskScore ?? 0) >= 75).length],
        ],
        theme: 'striped',
        headStyles: { fillColor: primaryColor, textColor: '#ffffff' },
        styles: { font: 'Helvetica', cellPadding: 8 }
      });
      yPos = doc.lastAutoTable.finalY + 30;
  
      // -- Top Vulnerable Hosts --
      const topVulnerableHosts = [...scanResult.hosts]
        .filter(h => (h.riskScore ?? 0) > 0)
        .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))
        .slice(0, 10);
      
      if (topVulnerableHosts.length > 0) {
        if (yPos > pageHeight - 120) { doc.addPage(); yPos = margin; }
        doc.setFontSize(22);
        doc.setFont('Helvetica', 'bold');
        doc.text(tRiskRanking('title'), margin, yPos);
        yPos += 25;
        doc.autoTable({
            startY: yPos,
            head: [[tHostsTable('ipAddress'), tHostsTable('hostname'), tDetails('os'), tHostsTable('riskScore')]],
            body: topVulnerableHosts.map(h => [
                h.address[0].addr,
                getHostname(h),
                getOsName(h),
                h.riskScore?.toFixed(0) ?? '0'
            ]),
            theme: 'striped',
            headStyles: { fillColor: primaryColor, textColor: '#ffffff' },
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
      
      // -- Discovered CVEs --
      const allCves = Array.from(cveCache.entries())
        .filter(([, entry]) => entry.status === 'loaded' && entry.data)
        .flatMap(([hostIp, entry]) => 
            entry.data!.map(cveData => ({...cveData, hostIp}))
        );

      if (allCves.length > 0) {
        if (yPos > pageHeight - 120) { doc.addPage(); yPos = margin; }
        doc.setFontSize(22);
        doc.setFont('Helvetica', 'bold');
        doc.text(locale === 'es' ? 'CVEs Descubiertos' : 'Discovered CVEs', margin, yPos);
        yPos += 25;
        doc.autoTable({
            startY: yPos,
            head: [['CVE ID', 'CVSS', 'Service', 'Host IP']],
            body: allCves.sort((a,b) => (b.cve.cvssScore ?? -1) - (a.cve.cvssScore ?? -1)).map(cve => [
                cve.cve.cveId,
                cve.cve.cvssScore?.toFixed(1) ?? 'N/A',
                `${cve.service.product} ${cve.service.version || ''}`,
                cve.hostIp
            ]),
            theme: 'striped',
            headStyles: { fillColor: primaryColor, textColor: '#ffffff' },
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
  
      // -- Visualizations --
      const addChart = async (elementId: string, title: string) => {
          if (yPos > pageHeight - 150) { doc.addPage(); yPos = margin; }
          doc.setFontSize(18);
          doc.setFont('Helvetica', 'bold');
          doc.setTextColor(headingColor);
          doc.text(title, margin, yPos);
          yPos += 15;
          try {
              const imgData = await captureChartAsBase64(elementId, { backgroundColor: '#ffffff'});
              if (imgData) {
                  const imgProps = doc.getImageProperties(imgData);
                  const imgWidth = pageWidth - (margin * 2);
                  const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
                  if (yPos + imgHeight > pageHeight - margin) { doc.addPage(); yPos = margin; doc.setFontSize(18); doc.setFont('Helvetica', 'bold'); doc.text(title, margin, yPos); yPos += 15; }
                  doc.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
                  yPos += imgHeight + 25;
              } else {
                  doc.setFontSize(11);
                  doc.setTextColor(mutedTextColor);
                  doc.text('Chart not available. Navigate to the corresponding page to include it in the report.', margin, yPos);
                  yPos += 20;
              }
          } catch (chartError) { 
              console.error("Chart export error:", chartError); 
              doc.setFontSize(11);
              doc.setTextColor(mutedTextColor);
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
      
      if (allCves.length > 0) {
        await addChart('pdf-threat-service-dist-chart', locale === 'es' ? 'Distribución de Servicios Vulnerables' : 'Vulnerable Services Distribution');
      }


      // -- All Hosts Table --
      const allHostsSortedByIp = [...scanResult.hosts].sort((a, b) => ipToNumber(a.address[0].addr) - ipToNumber(b.address[0].addr));
      doc.addPage();
      yPos = margin;
      doc.setFontSize(22);
      doc.setFont('Helvetica', 'bold');
      doc.text(tHostsTable('title'), margin, yPos);
      yPos += 25;
      doc.autoTable({
        startY: yPos,
        head: [[tHostsTable('ipAddress'), tHostsTable('hostname'), tDetails('os'), tHostsTable('openPorts'), tHostsTable('riskScore')]],
        body: allHostsSortedByIp.map(h => [
          h.address[0].addr,
          getHostname(h),
          getOsName(h),
          getOpenPortsCount(h),
          h.riskScore?.toFixed(0) ?? '0'
        ]),
        theme: 'striped',
        headStyles: { fillColor: primaryColor, textColor: '#ffffff' },
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
  
      // -- Detailed Host Info --
      if(yPos > pageHeight - 80) { doc.addPage(); yPos = margin; }
      doc.setFontSize(22);
      doc.setFont('Helvetica', 'bold');
      doc.text('Detailed Host Information', margin, yPos);
      yPos += 15;

      for (const host of allHostsSortedByIp) {
        if (yPos > pageHeight - 100) { doc.addPage(); yPos = margin; }
        yPos += 20;
        doc.setFontSize(16);
        doc.setFont('Helvetica', 'bold');
        doc.text(`Host: ${host.address[0].addr} (${getHostname(host)})`, margin, yPos);
        yPos += 15;
  
        const openPorts = (Array.isArray(host.ports.port) ? host.ports.port : (host.ports.port ? [host.ports.port] : []))
          .filter(p => p?.state.state === 'open');
  
        if (openPorts.length > 0) {
          doc.autoTable({
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
            headStyles: { fillColor: '#4a5568', textColor: '#ffffff'},
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
      }
      
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(mutedTextColor);
        doc.text(`${tHostsTable('page', { currentPage: i, totalPages: pageCount })}`, pageWidth / 2, pageHeight - 15, { align: 'center' });
      }
  
      doc.save(`visual-map-report-${getFormattedTimestamp()}.pdf`);
    } catch (error) {
      console.error("Error exporting PDF:", error);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const dashboardTitle = locale === 'es' ? 'Dashboard' : 'Dashboard';
  const hostsTitle = tDetails('hosts');
  const openPortsTitle = tDetails('openPorts');
  const servicesTitle = tDetails('services');
  const vulnerableHostsTitle = locale === 'es' ? 'Hosts Vulnerables' : 'Vulnerable Hosts';
  const threatsTitle = locale === 'es' ? 'CVEs y Vulnerabilidades' : 'CVEs & Vulnerabilities';
  const networkTitle = tDetails('networkGraph');
  const apiTitle = tApi('title');

  const handleAccordionTriggerClick = (value: string) => {
    if (state === 'collapsed') {
      setOpen(true);
    }
    setAccordionValue(value === accordionValue ? '' : value);
  }
  
  return (
    <>
      <SidebarContent className='pt-0'>
         <SidebarGroup>
            <Link href="/" className="flex items-center gap-2 p-2">
                <VmLogo className="h-6 w-6" />
                <h1 className="text-lg md:text-xl font-bold tracking-tight group-data-[collapsible=icon]:hidden">{tHeader('title')}</h1>
            </Link>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
            <SidebarMenu>
                <SidebarMenuItem>
                     <Link href="/" className='w-full'>
                        <SidebarMenuButton isActive={pathname === '/'} tooltip={dashboardTitle}>
                            <Home />
                            <span className="group-data-[collapsible=icon]:hidden">{dashboardTitle}</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
                 <SidebarMenuItem>
                <Link href="/details/hosts" className='w-full'>
                    <SidebarMenuButton isActive={pathname.startsWith('/details/hosts')} tooltip={hostsTitle}>
                        <Server />
                        <span className="group-data-[collapsible=icon]:hidden">{hostsTitle}</span>
                    </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
                 <Link href="/details/ports" className='w-full'>
                    <SidebarMenuButton isActive={pathname.startsWith('/details/ports')} tooltip={openPortsTitle}>
                        <DoorOpen />
                        <span className="group-data-[collapsible=icon]:hidden">{openPortsTitle}</span>
                    </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
             <SidebarMenuItem>
                 <Link href="/details/services" className='w-full'>
                    <SidebarMenuButton isActive={pathname.startsWith('/details/services')} tooltip={servicesTitle}>
                        <Shield />
                        <span className="group-data-[collapsible=icon]:hidden">{servicesTitle}</span>
                    </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
                 <Link href="/details/vulnerable-hosts" className='w-full'>
                    <SidebarMenuButton isActive={pathname.startsWith('/details/vulnerable-hosts')} tooltip={vulnerableHostsTitle}>
                        <Users />
                        <span className="group-data-[collapsible=icon]:hidden">{vulnerableHostsTitle}</span>
                    </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
             <SidebarMenuItem>
                 <Link href="/details/vulnerabilities" className='w-full'>
                    <SidebarMenuButton isActive={pathname.startsWith('/details/vulnerabilities')} tooltip={threatsTitle}>
                        <Skull />
                         <span className="group-data-[collapsible=icon]:hidden flex-1 flex items-center justify-between">
                            {threatsTitle}
                        </span>
                    </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
             <SidebarMenuItem>
                 <Link href="/details/network" className='w-full'>
                    <SidebarMenuButton isActive={pathname.startsWith('/details/network')} tooltip={networkTitle}>
                        <Network />
                        <span className="group-data-[collapsible=icon]:hidden">{networkTitle}</span>
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
                        <SidebarMenuButton isActive={pathname.startsWith('/details/api')} tooltip={apiTitle}>
                            <KeyRound />
                            <span className="group-data-[collapsible=icon]:hidden flex-1 flex items-center justify-between">
                                {apiTitle}
                            </span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarGroup>
        <SidebarSeparator className="my-4" />
        <SidebarGroup>
            <Accordion type="single" collapsible value={accordionValue} onValueChange={setAccordionValue}>
                <AccordionItem value="risk-weighting" className="border-none">
                     <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <AccordionTrigger 
                                    className="px-2 py-1.5 hover:no-underline hover:bg-primary/10 rounded-md group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center text-sm font-medium [&[data-state=open]>div>svg:last-child]:rotate-180"
                                    onClick={() => handleAccordionTriggerClick('risk-weighting')}
                                >
                                     <div className='flex items-center justify-between w-full'>
                                        <div className='flex items-center gap-2'>
                                            <SlidersHorizontal className="h-4 w-4" />
                                            <span className="group-data-[collapsible=icon]:hidden">{tSidebar('riskWeighting')}</span>
                                        </div>
                                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[collapsible=icon]:hidden" />
                                    </div>
                                </AccordionTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="right" align="center" className="group-data-[collapsible=icon]:block hidden">
                                <p>{tSidebar('riskWeighting')}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
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
                                <Label htmlFor="cve-weight" className='text-xs'>{locale === 'es' ? 'CVEs y Vulnerabilidades' : 'CVEs & Vulnerabilities'}</Label>
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
            </Accordion>
        </SidebarGroup>
         <SidebarGroup>
            <Accordion type="single" collapsible value={accordionValue} onValueChange={setAccordionValue}>
                <AccordionItem value="export" className="border-none">
                     <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                 <AccordionTrigger 
                                    className="px-2 py-1.5 hover:no-underline hover:bg-primary/10 rounded-md group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center text-sm font-medium [&[data-state=open]>div>svg:last-child]:rotate-180"
                                    onClick={() => handleAccordionTriggerClick('export')}
                                >
                                     <div className='flex items-center justify-between w-full'>
                                        <div className='flex items-center gap-2'>
                                            <Download className="h-4 w-4" />
                                            <span className="group-data-[collapsible=icon]:hidden">{tSidebar('export')}</span>
                                        </div>
                                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[collapsible=icon]:hidden" />
                                    </div>
                                </AccordionTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="right" align="center" className="group-data-[collapsible=icon]:block hidden">
                                <p>{tSidebar('export')}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
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
            </Accordion>
        </SidebarGroup>
      </SidebarContent>
    </>
  );
}
