
'use client';

import { useEffect } from 'react';
import { useScanStore } from '@/store/use-scan-store';
import { useToast } from '@/hooks/use-toast';
import { useLocale } from 'next-intl';

export default function ApiErrorToast() {
  const { apiError, setApiError } = useScanStore();
  const { toast } = useToast();
  const locale = useLocale();

  useEffect(() => {
    if (apiError) {
      const title = locale === 'es' ? 'Error de API' : 'API Error';
      let description = apiError;

      if (apiError.toLowerCase().includes('rate limit')) {
        description = locale === 'es'
          ? 'Límite de peticiones a la API excedido. Algunas funciones de IA se han detenido temporalmente. Inténtalo de nuevo en un minuto.'
          : 'API rate limit exceeded. Some AI features are temporarily paused. Please try again in a minute.';
      } else if (apiError.toLowerCase().includes('api key not valid')) {
        description = locale === 'es' 
          ? 'La clave API no es válida. Por favor, revisa tu configuración.'
          : 'The API key is not valid. Please check your configuration.';
      } else {
         description = locale === 'es'
          ? `Se ha producido un error de comunicación con la API. (${apiError})`
          : `An API communication error occurred. (${apiError})`;
      }
      
      toast({
        variant: 'destructive',
        title: title,
        description: description,
        duration: 8000,
      });

      // We clear the error so the toast doesn't re-appear on every render
      setApiError(null);
    }
  }, [apiError, setApiError, toast, locale]);

  return null;
}
