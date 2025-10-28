
'use client';

import { useParams } from 'next/navigation';
import { useRouter } from '@/navigation';
import { useScanStore } from '@/store/use-scan-store';
import { useEffect, useState, useMemo } from 'react';
import HostsDetailView from '@/components/details/hosts-detail-view';
import PortsDetailView from '@/components/details/ports-detail-view';
import ServicesDetailView from '@/components/details/services-detail-view';
import VulnerabilitiesDetailView from '@/components/details/vulnerabilities-detail-view';
import { useLocale, useTranslations } from 'next-intl';
import HostDetailDrawer from '@/components/dashboard/host-detail-drawer';
import ThreatsDetailView from '@/components/details/threats-detail-view';
import RemediationsView from '@/components/details/remediations-view';
import ApiPage from '../api/page';
import dynamic from 'next/dynamic';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { getHostname } from '@/lib/nmap-parser';
import { cn } from '@/lib/utils';
import ExecutiveSummaryView from '@/components/details/executive-summary-view';
import AttackPathsView from '@/components/details/attack-paths-view';

const NetworkGraphView = dynamic(() => import('@/components/details/network-graph-view'), { ssr: false });

export default function DetailsPage() {
  const params = useParams();
  const slug = (params.slug || []) as string[];
  const page = slug[0] || 'hosts';
  const { scanResult, setSelectedHost, hostFilter, setHostFilter, cveCache, attackPathsCache } = useScanStore();
  const router = useRouter();
  const t = useTranslations('DetailsPage');
  const locale = useLocale();
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    // Do not redirect if we are on the API page.
    if (!scanResult && page !== 'api') {
      router.push('/');
    }
  }, [scanResult, router, page]);
  
  useEffect(() => {
    // Close the host detail drawer when navigating between detail pages
    setSelectedHost(null);
  }, [page, setSelectedHost]);

  const attackPathsEntry = useMemo(() => attackPathsCache.get(`attack-path-${locale}`), [attackPathsCache, locale]);
  const hasAttackPaths = useMemo(() => attackPathsEntry?.status === 'loaded' && attackPathsEntry.data?.paths && attackPathsEntry.data.paths.length > 0, [attackPathsEntry]);


  const hostOptions = useMemo(() => {
    if (!scanResult) return [];
  
    let hostsToShow = scanResult.hosts;
    let affectedHostIps = new Set<string>();

    if (page === 'vulnerabilities' || page === 'remediations') {
      hostsToShow.forEach(host => {
        const entry = cveCache.get(host.address[0].addr);
        if (entry?.status === 'loaded' && entry.data && entry.data.length > 0) {
          affectedHostIps.add(host.address[0].addr);
        }
      });
    } else if (page === 'attack-paths' && hasAttackPaths) {
      attackPathsEntry!.data!.paths.forEach(path => {
          affectedHostIps.add(path.source);
          affectedHostIps.add(path.target);
      });
    }
    
    if (affectedHostIps.size > 0) {
       hostsToShow = scanResult.hosts.filter(h => affectedHostIps.has(h.address[0].addr));
    }
    
    const options = hostsToShow.map(h => {
      const hostname = getHostname(h);
      const label = hostname !== 'N/A'
        ? `${hostname} (${h.address[0].addr})`
        : h.address[0].addr;
      return { value: h.address[0].addr, label };
    }).sort((a, b) => a.label.localeCompare(b.label));
    
    if (options.length > 0) {
      options.unshift({ value: 'all', label: locale === 'es' ? 'Todos los hosts' : 'All hosts' });
    }
    return options;
  }, [scanResult, cveCache, page, locale, hasAttackPaths, attackPathsEntry]);

  const showFilter = (['hosts', 'ports', 'services', 'vulnerabilities', 'remediations'].includes(page) || (page === 'attack-paths' && hasAttackPaths)) && hostOptions.length > 1;

  const getPageTitle = () => {
    // Hardcoding titles as requested to fix translation key issue.
    if (page === 'vulnerable-hosts') {
        return locale === 'es' ? 'Hosts Vulnerables' : 'Vulnerable Hosts';
    }
    if (page === 'vulnerabilities') {
        return locale === 'es' ? 'CVEs y Vulnerabilidades' : 'CVEs & Vulnerabilities';
    }
    if (page === 'remediations') {
        return locale === 'es' ? 'Remediaciones' : 'Remediations';
    }
    if (page === 'executive-summary') {
        return locale === 'es' ? 'Resumen Ejecutivo' : 'Executive Summary';
    }
    if (page === 'attack-paths') {
        return locale === 'es' ? 'Rutas de Ataque' : 'Attack Paths';
    }

    const pageTitles: { [key: string]: string } = {
        hosts: t('hosts'),
        ports: t('openPorts'),
        services: t('services'),
        network: t('networkGraph'),
        api: t('api'),
    };
    return pageTitles[page] || t('pageNotFound');
  }

  const renderContent = () => {
    if (!scanResult && page !== 'api') {
        return null;
    }
    switch(page) {
        case 'hosts':
            return <HostsDetailView hosts={scanResult!.hosts} />;
        case 'ports':
            return <PortsDetailView hosts={scanResult!.hosts} />;
        case 'services':
            return <ServicesDetailView hosts={scanResult!.hosts} />;
        case 'vulnerable-hosts':
            return <VulnerabilitiesDetailView hosts={scanResult!.hosts} />;
        case 'vulnerabilities':
            return <ThreatsDetailView hosts={scanResult!.hosts} />;
        case 'remediations':
            return <RemediationsView hosts={scanResult!.hosts} />;
        case 'network':
            // The graph needs a container with a defined height to render.
            return <div className="h-full"><NetworkGraphView hosts={scanResult!.hosts} /></div>;
        case 'api':
            return <ApiPage />;
        case 'executive-summary':
            return <ExecutiveSummaryView />;
        case 'attack-paths':
            return <AttackPathsView />;
        default:
            return <p>{t('pageNotFound')}</p>;
    }
  };
  
  const customFilter = (value: string, search: string) => {
    // The `value` is the `label` from `CommandItem` which is "hostname (ip)"
    // `search` is the user's input.
    // We check if the search term is in the label.
    return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
  };

  return (
    <>
      <div className="p-0 flex flex-col h-full w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <h1 className="text-2xl md:text-3xl font-bold capitalize font-headline text-primary">{getPageTitle()}</h1>
          {showFilter && (
            <div className="w-full sm:w-auto sm:min-w-[250px]">
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={popoverOpen}
                      className="w-full justify-between"
                    >
                      {hostFilter
                        ? hostOptions.find((h) => h.value === hostFilter)?.label
                        : (locale === 'es' ? 'Filtrar por host...' : 'Filter by host...')}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command filter={customFilter}>
                      <CommandInput placeholder={locale === 'es' ? 'Buscar host o IP...' : 'Search host or IP...'} />
                      <CommandList>
                        <CommandEmpty>{locale === 'es' ? 'No se encontró ningún host.' : 'No host found.'}</CommandEmpty>
                        <CommandGroup>
                          {hostOptions.map((h) => (
                            <CommandItem
                              key={h.value}
                              value={h.label}
                              onSelect={(currentValue) => {
                                const selectedOption = hostOptions.find(opt => opt.label.toLowerCase() === currentValue);
                                const newValue = selectedOption ? selectedOption.value : null;
                                setHostFilter(newValue === 'all' ? null : newValue);
                                setPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  (hostFilter === h.value || (!hostFilter && h.value === 'all')) ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {h.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
            </div>
          )}
        </div>
        <div className="flex-grow w-full">
          {renderContent()}
        </div>
      </div>
      <HostDetailDrawer />
    </>
  );
}
