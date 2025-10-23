'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, ExternalLink, ChevronLeft, ChevronRight, Replace, ChevronDown, Info, ShieldAlert, KeyRound } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useScanStore } from '@/store/use-scan-store';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';

type Model = {
  name: string;
  displayName: string;
};

const RateLimitsDescription = ({ locale }: { locale: string }) => {
    if (locale === 'es') {
       return (
            <div className="prose prose-sm dark:prose-invert max-w-full space-y-4">
               <p>La documentación oficial de límites de tasa (rate limits) de la API Gemini para el nivel gratuito (Free Tier) indica varios límites para diferentes modelos:</p>
               <ul className='text-xs list-disc list-inside'>
                   <li><b>RPM:</b> Peticiones por minuto</li>
                   <li><b>TPM:</b> Tokens por minuto</li>
                   <li><b>RPD:</b> Peticiones por día</li>
               </ul>
                <a href="https://ai.google.dev/gemini-api/docs/rate-limits?hl=es-419" target="_blank" rel="noopener noreferrer" className="block pt-4">
                   <Button variant="link" className="p-0 h-auto">Saber Más <ExternalLink className="ml-2 h-3 w-3" /></Button>
               </a>
           </div>
       )
   }
   return (
       <div className="prose prose-sm dark:prose-invert max-w-full space-y-4">
           <p>The official Gemini API rate limits documentation for the Free Tier indicates various limits for different models:</p>
            <ul className='text-xs list-disc list-inside'>
               <li><b>RPM:</b> Requests Per Minute</li>
               <li><b>TPM:</b> Tokens Per Minute</li>
               <li><b>RPD:</b> Requests Per Day</li>
           </ul>
            <a href="https://ai.google.dev/gemini-api/docs/rate-limits?hl=en" target="_blank" rel="noopener noreferrer" className="block pt-4">
               <Button variant="link" className="p-0 h-auto">Learn More <ExternalLink className="ml-2 h-3 w-3" /></Button>
           </a>
       </div>
   )
 }

export default function ApiPage() {
  const t = useTranslations('ApiPage');
  const locale = useLocale();
  const { 
    apiStatus, 
    setApiStatus, 
    aiModel, 
    setAiModel, 
    apiKey: storedApiKey, 
    setApiKey,
    isUsingEnvVar,
    _hydrated
  } = useScanStore();
  
  const [localApiKey, setLocalApiKey] = useState('');
  const [models, setModels] = useState<Model[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const modelsPerPage = 10;
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    // Only check connection on mount if a key exists (from env or localStorage)
    if (_hydrated && storedApiKey) {
      checkApiConnection(storedApiKey);
    } else if (_hydrated && !storedApiKey) {
        setApiStatus('error');
        setError(t('noKey'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hydrated]);

  useEffect(() => {
    // Sync local input with store if it's not from env var
    if (!isUsingEnvVar) {
      setLocalApiKey(storedApiKey || '');
    }
  }, [storedApiKey, isUsingEnvVar]);

  const checkApiConnection = async (key?: string) => {
    const keyToCheck = key || storedApiKey;

    setIsChecking(true);
    setApiStatus('loading');
    setError(null);
    setModels([]);

    if (!keyToCheck) {
      setApiStatus('error');
      setError(t('noKey'));
      setIsChecking(false);
      return false;
    }
    
    // If the key is user-provided, save it to the store (and localStorage)
    if (!isUsingEnvVar && key) {
        setApiKey(key);
    }
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${keyToCheck}`);
      
      if (!response.ok) {
        let errorMsg = `Request failed with status ${response.status}`;
        try {
            const errorData = await response.json();
            errorMsg = errorData.error?.message || errorMsg;
        } catch (e) { /* Not a JSON response */ }
        
        if (errorMsg.toLowerCase().includes('api key not valid')) {
            errorMsg = t('invalidKey');
        } else if (errorMsg.toLowerCase().includes('fetch')) {
            errorMsg = locale === 'es' ? 'Error de red: No se pudo conectar a la API.' : 'Network Error: Could not connect to the API.';
        } else {
            errorMsg = t('invalidKey');
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      let availableModels = data.models
        .filter((model: any) => 
            model.supportedGenerationMethods.includes('generateContent') && 
            model.name.includes('gemini') &&
            !model.name.toLowerCase().includes('-exp-') &&
            !model.name.toLowerCase().includes('-preview') &&
            !model.name.toLowerCase().includes('-tts') &&
            !/\d{4}-\d{2}-\d{2}$/.test(model.name.toLowerCase()) &&
            !/-\d{2}-\d{2}$/.test(model.name.toLowerCase()) &&
            !/-\d{4}$/.test(model.name.toLowerCase())
        )
        .map((model: any) => ({
            name: model.name,
            displayName: model.displayName,
        }));
      
      const getVersion = (name: string) => {
        const match = name.match(/(\d\.\d)/);
        return match ? parseFloat(match[1]) : 0;
      };

      availableModels.sort((a: Model, b: Model) => {
        const versionB = getVersion(b.displayName);
        const versionA = getVersion(a.displayName);
        if (versionB !== versionA) {
          return versionB - versionA;
        }
        return b.displayName.localeCompare(a.displayName);
      });
      
      const currentModelName = `models/${aiModel}`;
      const currentModelIndex = availableModels.findIndex(m => m.name === currentModelName);
      if (currentModelIndex > -1) {
          const [currentModel] = availableModels.splice(currentModelIndex, 1);
          availableModels.unshift(currentModel);
      }
        
      setModels(availableModels);
      setApiStatus('success');
      setError(null);
      setIsChecking(false);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('invalidKey');
      setApiStatus('error');
      setError(errorMessage);
      setIsChecking(false);
      return false;
    }
  };

  const getStatusContent = () => {
    if (!_hydrated && !isUsingEnvVar) {
        return (
             <div className="flex items-center text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>{locale === 'es' ? 'Cargando configuración...' : 'Loading configuration...'}</span>
            </div>
        )
    }
    switch (apiStatus) {
      case 'loading':
        return (
          <div className="flex items-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span>{t('checking')}</span>
          </div>
        );
      case 'success':
        return (
          <div className="flex items-center text-green-700 dark:text-green-400">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            <span>{t('validKey')}</span>
          </div>
        );
      case 'error':
         return (
            <div className="flex items-center text-destructive">
                <XCircle className="mr-2 h-4 w-4" />
                <p className="text-sm">{error || t('invalidKey')}</p>
            </div>
        );
      default:
        return null;
    }
  };

  const apiRateLimitsTitle = locale === 'es' ? 'Límites de la API' : 'API Rate Limits';
  const showApiLimitsTitle = locale === 'es' ? 'Mostrar Límites de la API (Nivel Gratuito)' : 'Show Free Tier API Limits';

  const indexOfLastModel = currentPage * modelsPerPage;
  const indexOfFirstModel = indexOfLastModel - modelsPerPage;
  const currentModels = models.slice(indexOfFirstModel, indexOfLastModel);
  const totalPages = Math.ceil(models.length / modelsPerPage);

  const pageText = locale === 'es'
    ? `Página ${currentPage} de ${totalPages}`
    : `Page ${currentPage} of ${totalPages}`;

  const setCurrentModelTitle = locale === 'es' ? 'Establecer como modelo actual' : 'Set as current model';
  
  const modelDescriptionText = locale === 'es' 
    ? "Selecciona un modelo para utilizarlo en la plataforma:"
    : "Select a model to use on the platform:";

  const rateLimitHintTitleText = locale === 'es' ? 'Consejo sobre el Límite de la API' : 'API Rate Limit Tip';
  const rateLimitHintDescriptionText = locale === 'es' ? 'Si alcanzas el límite de peticiones (rate limit) de la API para un modelo, prueba a cambiar a uno diferente para seguir utilizando la plataforma.' : 'If you reach the API rate limit for a model, try switching to a different one to continue using the platform.';

  return (
    <div className="space-y-8 w-full">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold font-headline text-primary">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

       <Card>
        <CardContent className="p-4 flex items-center justify-between">
            <div>
                <h4 className="font-semibold text-base">{t('getApiKeyTitle')}</h4>
                <p className="text-sm text-muted-foreground">{t('getApiKeyDescription')}</p>
            </div>
            <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer">
                <Button variant="outline">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t('getApiKeyButton')}
                </Button>
            </a>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>{t('status')}</CardTitle>
          {isUsingEnvVar && (
              <Alert variant="default" className="border-blue-500/50 text-blue-700 dark:text-blue-300 [&>svg]:text-blue-600 dark:[&>svg]:text-blue-400 mt-4">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle>{locale === 'es' ? 'Variable de Entorno Detectada' : 'Environment Variable Detected'}</AlertTitle>
                  <AlertDescription>
                      {locale === 'es' ? 'La clave API se está utilizando desde una variable de entorno. No se puede cambiar desde aquí.' : 'The API key is being used from an environment variable. It cannot be changed here.'}
                  </AlertDescription>
              </Alert>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {!isUsingEnvVar && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-muted-foreground" />
                    <h3 className="text-lg font-semibold">{locale === 'es' ? 'Tu Clave API Gemini' : 'Your Gemini API Key'}</h3>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <Input 
                        type="password"
                        placeholder={locale === 'es' ? 'Introduce tu clave API...' : 'Enter your API key...'}
                        value={localApiKey}
                        onChange={(e) => setLocalApiKey(e.target.value)}
                        className="flex-grow"
                        disabled={isChecking}
                    />
                    <Button onClick={() => checkApiConnection(localApiKey)} disabled={isChecking || !localApiKey}>
                      {isChecking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {t('checkButton')}
                    </Button>
                </div>
            </div>
          )}

          <div className={cn(
                "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border rounded-lg",
                apiStatus === 'success' && 'bg-green-500/10 border-green-500/20',
                apiStatus === 'error' && 'bg-destructive/10 border-destructive/20'
            )}>
            <div className="text-sm font-medium">{getStatusContent()}</div>
            {isUsingEnvVar && (
                 <Button onClick={() => checkApiConnection()} disabled={isChecking}>
                    {isChecking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {locale === 'es' ? 'Re-verificar Conexión' : 'Re-check Connection'}
                </Button>
            )}
          </div>
          
          {apiStatus === 'success' && models.length > 0 && (
            <div>
              <h3 className="mb-2 text-lg font-semibold">{t('availableModels')}</h3>
              <p className="mb-4 text-sm text-muted-foreground">{modelDescriptionText}</p>
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>{rateLimitHintTitleText}</AlertTitle>
                    <AlertDescription>
                        {rateLimitHintDescriptionText}
                    </AlertDescription>
                </Alert>
              <div className="rounded-md border mt-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>{t('modelName')}</TableHead>
                        <TableHead>{t('modelDisplayName')}</TableHead>
                        <TableHead className="text-right">{t('currentModel')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentModels.map(model => (
                        <TableRow key={model.name} className={cn(model.name === `models/${aiModel}` && 'bg-primary/10 hover:bg-primary/20')}>
                            <TableCell className="font-mono text-xs">{model.name.replace('models/', '')}</TableCell>
                            <TableCell>{model.displayName}</TableCell>
                            <TableCell className="flex justify-end">
                                {model.name === `models/${aiModel}` ? (
                                    <CheckCircle2 className="h-5 w-5 text-primary" />
                                ) : (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAiModel(model.name.replace('models/', ''))}>
                                                    <Replace className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{setCurrentModelTitle}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                 <div className="flex items-center justify-end space-x-2 py-4">
                    <span className="text-sm text-muted-foreground">
                        {pageText}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                    >
                       <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>{apiRateLimitsTitle}</CardTitle>
        </CardHeader>
        <CardContent>
            <Accordion type="single" collapsible>
                <AccordionItem value="rate-limits">
                    <AccordionTrigger className='hover:no-underline [&[data-state=open]>div>svg]:rotate-180'>
                        <div className="flex items-center justify-between w-full">
                            <span>{showApiLimitsTitle}</span>
                            <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className='space-y-4'>
                        <RateLimitsDescription locale={locale} />
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t('modelName')}</TableHead>
                                        <TableHead>RPM</TableHead>
                                        <TableHead>TPM</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                     <TableRow>
                                        <TableCell>Gemini 1.5 Pro</TableCell>
                                        <TableCell>2</TableCell>
                                        <TableCell>32,768</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell>Gemini 1.5 Flash</TableCell>
                                        <TableCell>15</TableCell>
                                        <TableCell>1,000,000</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </CardContent>
      </Card>
      
    </div>
  );
}
