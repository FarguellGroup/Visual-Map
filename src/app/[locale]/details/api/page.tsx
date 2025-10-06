
'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, ExternalLink, ChevronLeft, ChevronRight, Replace, ChevronDown, Info, Save, Eye, EyeOff } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useScanStore } from '@/store/use-scan-store';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

type Model = {
  name: string;
  displayName: string;
};

const RateLimitsDescription = ({ locale }: { locale: string }) => {
    if (locale === 'es') {
       return (
            <div className="prose prose-sm dark:prose-invert max-w-full space-y-4">
               <p>En la documentación oficial de límites de tasa (rate limits) de la API Gemini, para el nivel gratis (Free Tier / Tier 1) se indican los siguientes límites para diferentes modelos:</p>
               <ul className='text-xs list-disc list-inside'>
                   <li><b>RPM:</b> Peticiones por minuto</li>
                   <li><b>TPM:</b> Tokens por minuto</li>
                   <li><b>RPD:</b> Peticiones por día</li>
               </ul>
                <a href="https://ai.google.dev/gemini-api/docs/rate-limits?authuser=2&utm_source=chatgpt.com&hl=es-419" target="_blank" rel="noopener noreferrer" className="block pt-4">
                   <Button variant="link" className="p-0 h-auto">Saber Más <ExternalLink className="ml-2 h-3 w-3" /></Button>
               </a>
           </div>
       )
   }
   return (
       <div className="prose prose-sm dark:prose-invert max-w-full space-y-4">
           <p>The official Gemini API rate limits documentation (Free Tier / Tier 1) indicates the following limits for different models:</p>
            <ul className='text-xs list-disc list-inside'>
               <li><b>RPM:</b> Requests Per Minute</li>
               <li><b>TPM:</b> Tokens Per Minute</li>
               <li><b>RPD:</b> Requests Per Day</li>
           </ul>
            <a href="https://ai.google.dev/gemini-api/docs/rate-limits?authuser=2&utm_source=chatgpt.com&hl=en#free-tier" target="_blank" rel="noopener noreferrer" className="block pt-4">
               <Button variant="link" className="p-0 h-auto">Learn More <ExternalLink className="ml-2 h-3 w-3" /></Button>
           </a>
       </div>
   )
 }

export default function ApiPage() {
  const t = useTranslations('ApiPage');
  const locale = useLocale();
  const { toast } = useToast();
  const { apiStatus, setApiStatus, aiModel, setAiModel, apiKey: storedApiKey, setApiKey } = useScanStore();
  const [models, setModels] = useState<Model[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const modelsPerPage = 10;
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);


  const checkApiConnection = async (key?: string) => {
    setApiStatus('loading');
    setError(null);
    setModels([]);
    
    const apiKey = key || storedApiKey;

    if (!apiKey) {
      setApiStatus('error');
      setError(t('noKeyDescription'));
      return;
    }
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      
      if (!response.ok) {
        let errorMsg = `Request failed with status ${response.status}`;
        try {
            const errorData = await response.json();
            errorMsg = errorData.error?.message || errorMsg;
        } catch (e) {
            // Not a JSON response
        }
        if (errorMsg.toLowerCase().includes('fetch')) {
            errorMsg = locale === 'es' ? 'Error de red: No se pudo conectar a la API. Verifica tu conexión a internet.' : 'Network Error: Could not connect to the API. Check your internet connection.';
        } else if (errorMsg.toLowerCase().includes('api key not valid')) {
            errorMsg = t('invalidKeyDescription');
        }

        throw new Error(errorMsg);
      }

      const data = await response.json();
      let availableModels = data.models
        .filter((model: any) => 
            model.supportedGenerationMethods.includes('generateContent') && 
            model.name.includes('gemini') &&
            !model.name.toLowerCase().includes('preview') &&
            !model.name.toLowerCase().includes('-exp-') &&
            !model.name.endsWith('-001') &&
            !/\d{4}$/.test(model.name.split('-').pop()!) &&
            !/-(\d{2,}-\d{2,}|\d{4,})$/.test(model.name.split('-').pop()!)
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
        const versionA = getVersion(a.displayName);
        const versionB = getVersion(b.displayName);
        if (versionB !== versionA) {
          return versionB - versionA;
        }
        return a.displayName.localeCompare(b.displayName);
      });
      
      const currentModelName = `models/${aiModel}`;
      const currentModelIndex = availableModels.findIndex(m => m.name === currentModelName);
      if (currentModelIndex > -1) {
          const [currentModel] = availableModels.splice(currentModelIndex, 1);
          availableModels.unshift(currentModel);
      }
        
      setModels(availableModels);
      setApiStatus('success');
      if (key && key !== storedApiKey) {
        setApiKey(key);
      }
    } catch (err) {
      setApiStatus('error');
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error("API Connection Error:", err);
    }
  };

  useEffect(() => {
    checkApiConnection();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveApiKey = async () => {
    if (!apiKeyInput) return;
    setIsSaving(true);
    
    try {
        const response = await fetch('/api/save-api-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: apiKeyInput }),
        });

        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error || 'Failed to save API key.');
        }

        toast({
            title: locale === 'es' ? 'Clave API guardada' : 'API Key Saved',
            description: locale === 'es' ? 'La clave ha sido guardada en tu archivo .env.' : 'The key has been saved to your .env file.',
        });
        
        setApiKey(apiKeyInput);
        await checkApiConnection(apiKeyInput);
        setApiKeyInput('');

    } catch (error) {
        const saveError = error instanceof Error ? error.message : 'Failed to save API key.';
        toast({
            variant: 'destructive',
            title: 'Error',
            description: saveError,
        });
    } finally {
        setIsSaving(false);
    }
  };


  const getStatusContent = () => {
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
          <div className="flex items-center text-green-600">
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

  const shouldShowApiKeyInput = apiStatus === 'error' || (apiStatus !== 'success' && !storedApiKey);

  return (
    <div className="container mx-auto p-0 space-y-8">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{locale === 'es' ? 'Verifica tu clave API Gemini y consulta los modelos disponibles.' : 'Verify your Gemini API key and see the available models.'}</p>
      </div>

       <Card>
        <CardContent className="p-4 flex items-center justify-between">
            <div>
                <h4 className="font-semibold text-base">{locale === 'es' ? 'Obtén tu clave API' : 'Get your API Key'}</h4>
                <p className="text-sm text-muted-foreground">{locale === 'es' ? 'Necesitas una clave API Gemini válida para usar las funciones de IA.' : 'You need a valid Gemini API key to use the AI features.'}</p>
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
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border rounded-lg">
            <div className="text-sm font-medium">{getStatusContent()}</div>
            <Button onClick={() => checkApiConnection(apiKeyInput || undefined)} disabled={apiStatus === 'loading'}>
              {apiStatus === 'loading' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('checkButton')}
            </Button>
          </div>
          
          {shouldShowApiKeyInput && (
              <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-semibold">{locale === 'es' ? 'Añadir Clave API' : 'Add API Key'}</h4>
                   <div className="flex items-center gap-2">
                        <div className="relative w-full">
                           <Input 
                                type={isApiKeyVisible ? 'text' : 'password'}
                                placeholder={locale === 'es' ? 'Introduce tu clave API Gemini...' : 'Enter your Gemini API key...'}
                                value={apiKeyInput}
                                onChange={(e) => setApiKeyInput(e.target.value)}
                                className="pr-10"
                            />
                           <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                                onClick={() => setIsApiKeyVisible(prev => !prev)}
                           >
                               {isApiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                               <span className="sr-only">{isApiKeyVisible ? (locale === 'es' ? 'Ocultar clave API' : 'Hide API key') : (locale === 'es' ? 'Mostrar clave API' : 'Show API key')}</span>
                           </Button>
                        </div>
                        <Button onClick={handleSaveApiKey} disabled={!apiKeyInput || isSaving}>
                           {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            {locale === 'es' ? 'Guardar' : 'Save'}
                        </Button>
                   </div>
              </div>
          )}


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
                                        <TableHead>RPD</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow>
                                        <TableCell>Gemini 1.5 Pro</TableCell>
                                        <TableCell>5</TableCell>
                                        <TableCell>250,000</TableCell>
                                        <TableCell>100</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell>Gemini 1.5 Flash</TableCell>
                                        <TableCell>10</TableCell>
                                        <TableCell>250,000</TableCell>
                                        <TableCell>250</TableCell>
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

    
