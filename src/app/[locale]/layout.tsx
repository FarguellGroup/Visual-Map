import React from 'react';
import { unstable_setRequestLocale } from 'next-intl/server';
import MainLayout from '@/components/layout/main-layout';
import { NextIntlClientProvider, useMessages } from 'next-intl';

export default function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  // Enable static rendering
  unstable_setRequestLocale(locale);
  const messages = useMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <MainLayout>{children}</MainLayout>
    </NextIntlClientProvider>
  );
}