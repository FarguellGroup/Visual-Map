'use client';

import type { DropzoneRootProps, DropzoneInputProps } from 'react-dropzone';
import { UploadCloud, Terminal, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { useState, useCallback } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useDropzone } from 'react-dropzone';
import { useScanStore } from '@/store/use-scan-store';
import { parseNmapXml } from '@/lib/nmap-parser';
import { Loader2 } from 'lucide-react';

const NmapCommand = ({ title, command }: { title: string, command: string }) => {
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
        <div>
            <h4 className="font-semibold">{title}</h4>
            <div className="relative mt-2">
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
                            <p>Copy to clipboard</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        </div>
    );
}

export default function UploadZone({ className }: { className?: string }) {
  const t = useTranslations('UploadZone');
  const tLoader = useTranslations('Loader');
  const locale = useLocale();
  const { setScanResult, clearScanResult, riskWeights } = useScanStore();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const infraScanCommand = "sudo nmap -v -A 10.0.0.0/24 -oX scan.xml";
  const hostScanCommand = "sudo nmap -v -A 10.0.0.1 -oX scan.xml";
  const ipListScanCommand = "sudo nmap -v -A -iL targets.txt -oX scan.xml";
  
  const ipListScanTitle = locale === 'es' ? "Escaneo mediante listado de IPs" : "Scan from IP list";
  const infraScanTitle = locale === 'es' ? "Escaneo de infraestructura completa" : "Full infrastructure scan";
  const hostScanTitle = locale === 'es' ? "Escaneo de host completo" : "Full host scan";

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      setIsLoading(true);
      const file = acceptedFiles[0];
      const reader = new FileReader();

      reader.onabort = () => {
        setIsLoading(false);
        toast({ variant: 'destructive', title: 'File reading aborted' });
      };
      reader.onerror = () => {
        setIsLoading(false);
        toast({ variant: 'destructive', title: 'File reading failed' });
      };
      reader.onload = async () => {
        try {
          const xmlData = reader.result as string;
          let hosts = await parseNmapXml(xmlData);
          setScanResult(file.name, hosts, riskWeights, true);
        } catch (error) {
          console.error('Parsing error:', error);
          toast({
            variant: 'destructive',
            title: 'Failed to parse XML',
            description: error instanceof Error ? error.message : 'An unknown error occurred.',
          });
          clearScanResult();
        } finally {
          setIsLoading(false);
        }
      };

      reader.readAsText(file);
    },
    [setScanResult, clearScanResult, toast, riskWeights]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/xml': ['.xml'] },
    maxFiles: 1,
  });

  if (isLoading) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center gap-4">
        <Loader2 className={cn('w-16 h-16 animate-spin text-primary')} />
        <p className="text-lg text-muted-foreground">{tLoader('analyzing')}</p>
      </div>
    );
  }

  return (
    <div className={cn("p-4 md:p-8", className)}>
        <div className="grid md:grid-cols-2 gap-8">
            <div
                {...getRootProps()}
                className={cn(
                'flex flex-col items-center justify-center aspect-square p-12 border-2 border-dashed rounded-xl cursor-pointer transition-colors bg-card',
                isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-primary/5'
                )}
            >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center justify-center gap-4 text-center">
                    <UploadCloud className="w-12 h-12 md:w-16 md:h-16 text-primary" />
                    <h3 className="text-xl md:text-2xl font-bold font-headline">{t('title')}</h3>
                    <p className="text-primary">{t('subtitle')}</p>
                    <p className="text-xs text-muted-foreground">{t('caption')}</p>
                </div>
            </div>

            <Card className="w-full flex flex-col justify-center aspect-square bg-card">
                <CardContent className="p-6 space-y-4">
                    <CardTitle className="text-lg flex items-center gap-2 mb-4">
                        <Terminal className="w-5 h-5" />
                        {t('examplesTitle')}
                    </CardTitle>
                    <NmapCommand title={infraScanTitle} command={infraScanCommand} />
                    <NmapCommand title={hostScanTitle} command={hostScanCommand} />
                    <NmapCommand title={ipListScanTitle} command={ipListScanCommand} />
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
