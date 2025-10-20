
'use client';

import { VmLogo } from '@/components/icons';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useScanStore } from '@/store/use-scan-store';
import { Link, usePathname } from '@/navigation';
import { PlusCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from './language-switcher';

export default function AppHeader() {
  const t = useTranslations('Header');
  const { scanResult, clearScanResult } = useScanStore();
  const pathname = usePathname();

  const handleUploadNew = () => {
    clearScanResult();
  };

  const showUploadNew = !!scanResult;
  const showSidebarTrigger = scanResult || pathname.includes('/details');

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2">
        {showSidebarTrigger && <SidebarTrigger />}
        <Link href="/" className="flex items-center gap-2">
            <VmLogo className="h-6 w-6" />
            <h1 className="text-lg md:text-xl font-bold tracking-tight">{t('title')}</h1>
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-end space-x-2">
        {showUploadNew && (
          <>
            <Button variant="outline" size="sm" onClick={handleUploadNew} className="hover:bg-primary hover:text-primary-foreground">
              <PlusCircle className="mr-2 h-4 w-4" />
              {t('newScan')}
            </Button>
            <Separator orientation="vertical" className="h-6" />
          </>
        )}
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </header>
  );
}
