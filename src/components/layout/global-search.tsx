
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useScanStore } from '@/store/use-scan-store';
import { useLocale } from 'next-intl';
import { useRouter } from '@/navigation';
import { Button } from '../ui/button';
import { Search, Server, Shield, Skull } from 'lucide-react';
import { getHostname } from '@/lib/nmap-parser';

type SearchResult = {
  type: 'host' | 'service' | 'cve';
  id: string;
  label: string;
  description: string;
  hostIp: string;
};

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const locale = useLocale();
  const router = useRouter();

  const { scanResult, cveCache } = useScanStore();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'f' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const searchResults = useMemo(() => {
    if (!scanResult || !query) return [];

    const lowerCaseQuery = query.toLowerCase();
    const results: SearchResult[] = [];
    
    const serviceOnHostText = locale === 'es' ? 'Servicio en' : 'Service on';
    const cveOnHostText = locale === 'es' ? 'CVE en' : 'CVE on';
    const hostText = locale === 'es' ? 'Host' : 'Host';

    // Search hosts
    scanResult.hosts.forEach(host => {
      const hostname = getHostname(host);
      const ip = host.address[0].addr;
      if (ip.includes(lowerCaseQuery) || hostname.toLowerCase().includes(lowerCaseQuery)) {
        results.push({
          type: 'host',
          id: `host-${ip}`,
          label: hostname !== 'N/A' ? `${hostname} (${ip})` : ip,
          description: `${hostText} - ${hostname}`,
          hostIp: ip
        });
      }
    });

    // Search services
    scanResult.hosts.forEach(host => {
        const ports = Array.isArray(host.ports.port) ? host.ports.port : (host.ports.port ? [host.ports.port] : []);
        ports.filter(p => p.state.state === 'open' && p.service).forEach(p => {
            const serviceName = p.service!.name || '';
            const productName = p.service!.product || '';
            if (serviceName.toLowerCase().includes(lowerCaseQuery) || productName.toLowerCase().includes(lowerCaseQuery)) {
                results.push({
                    type: 'service',
                    id: `service-${host.address[0].addr}-${p.portid}`,
                    label: `${productName || serviceName} on port ${p.portid}`,
                    description: `${serviceOnHostText} ${host.address[0].addr}`,
                    hostIp: host.address[0].addr,
                });
            }
        });
    });

    // Search CVEs
    Array.from(cveCache.entries()).forEach(([hostIp, entry]) => {
      if (entry.status === 'loaded' && entry.data) {
        entry.data.forEach(cveItem => {
          if (cveItem.cve.cveId.toLowerCase().includes(lowerCaseQuery)) {
            results.push({
              type: 'cve',
              id: `cve-${hostIp}-${cveItem.cve.cveId}`,
              label: `${cveItem.cve.cveId} (CVSS: ${cveItem.cve.cvssScore ?? 'N/A'})`,
              description: `${cveOnHostText} ${hostIp}`,
              hostIp: hostIp,
            });
          }
        });
      }
    });
    
    // Remove duplicates
    return Array.from(new Map(results.map(item => [item.id, item])).values());

  }, [query, scanResult, cveCache, locale]);
  
  const handleSelect = (hostIp: string) => {
    router.push(`/details/host/${hostIp}`);
    setOpen(false);
  };
  
  const groupedResults = useMemo(() => {
    return searchResults.reduce((acc, result) => {
        if (!acc[result.type]) {
            acc[result.type] = [];
        }
        acc[result.type].push(result);
        return acc;
    }, {} as Record<SearchResult['type'], SearchResult[]>);
  }, [searchResults]);

  const placeholderText = locale === 'es' ? 'Buscar IP, host, servicio, CVE...' : 'Search IP, host, service, CVE...';
  const noResultsText = locale === 'es' ? 'No se encontraron resultados.' : 'No results found.';
  const searchButtonText = locale === 'es' ? 'Buscar...' : 'Search...';
  
  const groupHeadings = {
    host: locale === 'es' ? 'Hosts' : 'Hosts',
    service: locale === 'es' ? 'Servicios' : 'Services',
    cve: locale === 'es' ? 'CVEs' : 'CVEs',
  };

  return (
    <>
      <Button
        variant="outline"
        className="group relative h-9 w-full justify-start rounded-md text-sm text-muted-foreground sm:pr-12 md:w-64 lg:w-80"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4 mr-2" />
        <span className="hidden lg:inline-flex">{placeholderText}</span>
        <span className="inline-flex lg:hidden">{searchButtonText}</span>
        <kbd className="pointer-events-none absolute right-1.5 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 group-hover:bg-primary group-hover:text-primary-foreground sm:flex">
          <span className="text-xs">⌘</span>F
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
            placeholder={placeholderText}
            value={query}
            onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>{noResultsText}</CommandEmpty>
          {Object.entries(groupedResults).map(([type, results]) => (
            <CommandGroup key={type} heading={groupHeadings[type as keyof typeof groupHeadings]}>
                 {results.map(result => (
                    <CommandItem
                        key={result.id}
                        onSelect={() => handleSelect(result.hostIp)}
                        value={`${result.label} ${result.description}`}
                    >
                         {result.type === 'host' && <Server className="mr-2 h-4 w-4" />}
                         {result.type === 'service' && <Shield className="mr-2 h-4 w-4" />}
                         {result.type === 'cve' && <Skull className="mr-2 h-4 w-4" />}
                        <span>{result.label}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{result.description}</span>
                    </CommandItem>
                ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
