
'use client';

import React, { useMemo } from 'react';
import type { Host } from '@/types/nmap';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useScanStore } from '@/store/use-scan-store';

interface NseSummaryProps {
  host: Host;
}

const formatExplanation = (text: string = '') => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/<\/strong>\s*:/g, '</strong>:')
      .replace(/\n/g, '<br />')
      .replace(/<br \/>\s*-\s/g, '<br />&bull; ')
      .replace(/^- /g, '&bull; ');
};

export function NseSummary({ host }: NseSummaryProps) {
  const t = useTranslations('HostDetail');
  const tCommon = useTranslations('VulnerabilityExplanation');
  const locale = useLocale();

  const { nseSummaryCache } = useScanStore();
  const cacheKey = useMemo(() => `${host.address[0].addr}-${locale}`, [host, locale]);

  const cacheEntry = nseSummaryCache.get(cacheKey);

  const loading = !cacheEntry || cacheEntry.status === 'loading';
  const error = cacheEntry?.status === 'error' ? cacheEntry.error : null;
  const data = cacheEntry?.status === 'loaded' ? cacheEntry.data : null;
  const hasRawOutput = useScanStore(state => state.hostHasNseScripts(host.address[0].addr));


  if (!hasRawOutput) {
    return (
      <p className="text-sm text-muted-foreground text-center">
        {t('noNseScripts')}
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center space-y-2 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          {locale === 'es' ? 'Generando resumen de scripts NSE...' : 'Generating NSE script summary...'}
        </p>
      </div>
    );
  }

  if (error) {
    const rateLimitError = locale === 'es' 
        ? 'Se ha excedido el límite de peticiones a la API. Por favor, espera un momento y vuelve a intentarlo.'
        : 'API rate limit exceeded. Please wait a moment and try again.';
    const isRateLimitError = error.toLowerCase().includes('rate limit');
    
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{tCommon('errorTitle')}</AlertTitle>
        <AlertDescription>{isRateLimitError ? rateLimitError : error}</AlertDescription>
      </Alert>
    );
  }
  
  if (!data?.summary) {
    return null;
  }

  return (
     <div className="text-sm prose prose-sm dark:prose-invert prose-p:leading-relaxed max-w-full">
        <span dangerouslySetInnerHTML={{ __html: formatExplanation(data.summary) }} />
     </div>
  );
}
