'use client';

import React, { useMemo, useState } from 'react';
import { useScanStore } from '@/store/use-scan-store';
import { useLocale } from 'next-intl';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Loader2, Sparkles, AlertTriangle, ShieldX, Link2, Copy, Check, Terminal } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { getHostname } from '@/lib/nmap-parser';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

const CommandSnippet = ({ command }: { command: string }) => {
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();
  const locale = useLocale();
  
  const handleCopy = async () => {
    try {
        await navigator.clipboard.writeText(command);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
        console.error("Copy failed: ", err);
        toast({
            variant: 'destructive',
            title: locale === 'es' ? 'Error al copiar' : 'Copy Failed',
            description: locale === 'es' ? 'No se pudo copiar el comando al portapapeles.' : 'Could not copy command to clipboard.',
        });
    }
  };

  return (
    <div className="relative mt-4">
      <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm"><Terminal className="w-4 h-4"/><span>{locale === 'es' ? 'Comando de Explotación' : 'Exploitation Command'}</span></h4>
      <pre className="rounded-md bg-muted p-3 pr-12 text-sm font-code overflow-x-auto">
        <code>{command}</code>
      </pre>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1/2 right-2 -translate-y-1/2 h-8 w-8"
              onClick={handleCopy}
            >
              {isCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 w-4" />}
              <span className="sr-only">Copy command</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{locale === 'es' ? 'Copiar al portapapeles' : 'Copy to clipboard'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};


export default function AttackPathsView() {
    const { 
        scanResult, 
        fetchAttackPaths, 
        attackPathsCache,
        hostFilter,
    } = useScanStore();
    const locale = useLocale();
    
    const cacheKey = useMemo(() => `attack-path-${locale}`, [locale]);
    const cacheEntry = attackPathsCache.get(cacheKey);
    const isAnalyzing = cacheEntry?.status === 'loading';
    const analysisError = cacheEntry?.status === 'error' ? cacheEntry.error : null;
    const analysisResult = cacheEntry?.status === 'loaded' ? cacheEntry.data : null;
    const hasBeenAnalyzed = !!analysisResult;

    const handleAnalyzeAttackPaths = () => {
        if (scanResult) {
            fetchAttackPaths(scanResult.hosts, locale);
        }
    };
    
    const getHostLabel = (ip: string) => {
        const host = scanResult?.hosts.find(h => h.address[0].addr === ip);
        if (!host) return ip;
        const hostname = getHostname(host);
        return hostname !== 'N/A' ? `${hostname} (${ip})` : ip;
    };

    const filteredAttackPaths = useMemo(() => {
        if (!analysisResult?.paths) return [];
        if (!hostFilter) return analysisResult.paths;
        return analysisResult.paths.filter(path => path.source === hostFilter || path.target === hostFilter);
    }, [analysisResult, hostFilter]);

    const title = locale === 'es' ? 'Análisis de Rutas de Ataque' : 'Attack Path Analysis';
    const description = locale === 'es' ? 'Rutas de ataque potenciales identificadas por la IA.' : 'Potential attack paths identified by AI.';
    const analyzeButtonText = locale === 'es' ? 'Analizar Rutas de Ataque con IA' : 'Analyze Attack Paths with AI';
    const analyzingButtonText = locale === 'es' ? 'Analizando rutas...' : 'Analyzing paths...';
    const errorTitle = locale === 'es' ? 'Error en el Análisis' : 'Analysis Error';
    const noPathsFoundText = locale === 'es' ? 'La IA no identificó posibles rutas de ataque para los hosts de riesgo alto.' : 'AI did not identify any potential attack paths for high-risk hosts.';

    return (
        <Card>
            <CardHeader>
                 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <CardTitle>{title}</CardTitle>
                        <CardDescription>{description}</CardDescription>
                    </div>
                    {!hasBeenAnalyzed && (
                      <Button onClick={handleAnalyzeAttackPaths} disabled={isAnalyzing}>
                          {isAnalyzing ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Sparkles className="mr-2 h-4 w-4" />
                            )}
                          {isAnalyzing ? analyzingButtonText : analyzeButtonText}
                      </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {isAnalyzing && (
                    <div className="flex flex-col items-center justify-center space-y-2 p-4 min-h-[100px]">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">
                            {analyzingButtonText}
                        </p>
                    </div>
                )}
                {analysisError && (
                    <Alert variant="destructive" className="mt-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>{errorTitle}</AlertTitle>
                        <AlertDescription>{analysisError}</AlertDescription>
                    </Alert>
                )}
                {analysisResult ? (
                    filteredAttackPaths.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full">
                            {filteredAttackPaths.map((path, index) => (
                                <AccordionItem value={`path-${index}`} key={index}>
                                    <AccordionTrigger className='hover:no-underline group rounded-lg px-4 hover:bg-muted/50 data-[state=open]:bg-muted/50'>
                                        <div className='flex items-center gap-4 text-sm'>
                                            <span className='font-mono'>{getHostLabel(path.source)}</span>
                                            <Link2 className='h-4 w-4 text-primary'/>
                                            <span className='font-mono'>{getHostLabel(path.target)}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-4 px-4 pb-2">
                                        <div className="text-sm prose prose-sm dark:prose-invert max-w-full" dangerouslySetInnerHTML={{ __html: path.description.replace(/\n/g, '<br />') }} />
                                        {path.command && <CommandSnippet command={path.command} />}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : (
                         <div className="flex flex-col items-center justify-center space-y-2 p-4 min-h-[100px] text-center">
                            <ShieldX className="h-8 w-8 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground max-w-md">
                                {noPathsFoundText}
                            </p>
                        </div>
                    )
                ) : (!isAnalyzing && !analysisError && (
                    <Alert variant="default" className="items-center border-orange-500/50 text-orange-700 dark:text-orange-300 [&>svg]:text-orange-600 dark:[&>svg]:text-orange-400 bg-orange-500/10">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>{locale === 'es' ? 'Nota sobre el Análisis' : 'Analysis Note'}</AlertTitle>
                        <AlertDescription>
                           {locale === 'es' ? 'Solo se generarán rutas de ataque para hosts con un puntaje de riesgo superior a 60.' : 'Attack paths will only be generated for hosts with a risk score greater than 60.'}
                        </AlertDescription>
                    </Alert>
                 ))}
            </CardContent>
        </Card>
    );
}
