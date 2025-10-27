
'use client';

import React, { useEffect, useMemo } from 'react';
import { useScanStore } from '@/store/use-scan-store';
import { useLocale } from 'next-intl';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Terminal, Sparkles, FileText, BarChart2, ShieldAlert } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';

export default function ExecutiveSummaryView() {
  const { 
    scanResult, 
    fetchExecutiveSummary, 
    executiveSummaryCache 
  } = useScanStore();
  const locale = useLocale();
  
  const cacheKey = useMemo(() => `summary-${locale}`, [locale]);

  useEffect(() => {
    if (scanResult) {
      fetchExecutiveSummary(scanResult, locale);
    }
  }, [scanResult, locale, fetchExecutiveSummary]);

  const cacheEntry = executiveSummaryCache.get(cacheKey);
  const loading = !cacheEntry || cacheEntry.status === 'loading';
  const error = cacheEntry?.status === 'error' ? cacheEntry.error : null;
  const data = cacheEntry?.status === 'loaded' ? cacheEntry.data : null;

  const formatMarkdown = (text: string = '') => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => `<p>${line}</p>`)
      .join('');
  };
  
  const generatingText = locale === 'es' ? 'Generando resumen ejecutivo con IA...' : 'Generating executive summary with AI...';
  const waitText = locale === 'es' ? 'Esto puede tardar un momento...' : 'This may take a moment...';
  const errorTitle = locale === 'es' ? 'Error' : 'Error';

  const mainTitle = locale === 'es' ? 'Resumen Ejecutivo Generado por IA' : 'AI-Generated Executive Summary';
  const mainDescription = locale === 'es' ? 'Este es un resumen de alto nivel de los resultados del escaneo, generado por IA. Proporciona una visión general de la postura de seguridad, los hallazgos clave y las recomendaciones estratégicas.' : 'This is an AI-generated summary of the scan results. It provides a high-level overview of the security posture, key findings, and strategic recommendations.';
  const assessmentTitle = locale === 'es' ? 'Evaluación General de Seguridad' : 'Overall Security Assessment';
  const findingsTitle = locale === 'es' ? 'Principales Hallazgos Críticos' : 'Key Critical Findings';
  const recommendationsTitle = locale === 'es' ? 'Recomendaciones Estratégicas' : 'Strategic Recommendations';


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 p-8 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h2 className="text-xl font-semibold">{generatingText}</h2>
        <p className="text-muted-foreground">{waitText}</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <Terminal className="h-4 w-4" />
        <AlertTitle>{errorTitle}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <Card>
          <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                  <Sparkles className='h-6 w-6 text-primary' />
                  {mainTitle}
              </CardTitle>
              <CardDescription>{mainDescription}</CardDescription>
          </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <FileText className='h-6 w-6 text-primary' />
            {assessmentTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="prose prose-sm dark:prose-invert max-w-full"
            dangerouslySetInnerHTML={{ __html: formatMarkdown(data.overallAssessment) }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <BarChart2 className='h-6 w-6 text-primary' />
            {findingsTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5">
            {data.criticalFindings.map((finding, index) => (
              <li key={index} className="text-sm">{finding}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <ShieldAlert className='h-6 w-6 text-primary' />
           {recommendationsTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5">
            {data.strategicRecommendations.map((rec, index) => (
              <li key={index} className="text-sm">{rec}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
