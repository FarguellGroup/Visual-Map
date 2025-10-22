import React from 'react';
import AppFooter from '@/components/layout/footer';
import AppHeader from '@/components/layout/header';
import { unstable_setRequestLocale } from 'next-intl/server';
import { ClientSidebarProvider } from '@/components/layout/sidebar-provider';
import ApiErrorToast from '@/components/api-error-toast';
import MainLayout from '@/components/layout/main-layout';

export default function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  // Enable static rendering
  unstable_setRequestLocale(locale);

  return (
    <ClientSidebarProvider>
      <MainLayout>{children}</MainLayout>
    </ClientSidebarProvider>
  );
}
