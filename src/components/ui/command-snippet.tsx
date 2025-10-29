'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

export const CommandSnippet = ({ command }: { command: string }) => {
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
    <div className="relative flex items-center min-w-0 code-block-container">
      <pre className="w-full overflow-x-auto rounded-md bg-muted p-3 pr-10 text-sm font-code code-block">
        <code>{command}</code>
      </pre>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1/2 right-2 -translate-y-1/2 h-8 w-8 bg-muted"
              onClick={handleCopy}
            >
              {isCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
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