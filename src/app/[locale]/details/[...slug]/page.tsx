
'use client';

import { useParams } from 'next/navigation';
import { useRouter } from '@/navigation';
import { useScanStore } from '@/store/use-scan-store';
import { useEffect } from 'react';
import HostsDetailView from '@/components/details/hosts-detail-view';
import PortsDetailView from '@/components/details/ports-detail-view';
import ServicesDetailView from '@/components/details/services-detail-view';
import VulnerabilitiesDetailView from '@/components/details/vulnerabilities-detail-view';
import { useLocale, useTranslations } from 'next-intl';
import HostDetailDrawer from '@/components/dashboard/host-detail-drawer';
import NetworkGraphView from '@/components/details/network-graph-view';
import ThreatsDetailView from '@/components/details/threats-detail-view';
import ApiPage from '../api/page';

export default function DetailsPage() {
  const params = useParams();
  const slug = (params.slug || []) as string[];
  const page = slug[0] || 'hosts';
  const { scanResult, setSelectedHost } = useScanStore();
  const router = useRouter();
  const t = useTranslations('DetailsPage');
  const locale = useLocale();

  useEffect(() => {
    if (!scanResult && page !== 'api') {
      router.push('/');
    }
  }, [scanResult, router, page]);
  
  useEffect(() => {
    // Close the host detail drawer when navigating between detail pages
    setSelectedHost(null);
  }, [page, setSelectedHost]);

  const getPageTitle = () => {
    // Hardcoding titles as requested to fix translation key issue.
    if (page === 'vulnerable-hosts') {
        return locale === 'es' ? 'Hosts Vulnerables' : 'Vulnerable Hosts';
    }
    if (page === 'vulnerabilities') {
        return locale === 'es' ? 'Vulnerabilidades' : 'Vulnerabilities';
    }

    const pageTitles: { [key: string]: string } = {
        hosts: t('hosts'),
        ports: t('openPorts'),
        services: t('services'),
        network: t('networkGraph'),
        api: t('api'),
    };
    return pageTitles[page] || t('pageNotFound');
  }

  const renderContent = () => {
    if (!scanResult && page !== 'api') {
        return null;
    }
    switch(page) {
        case 'hosts':
            return <HostsDetailView hosts={scanResult!.hosts} />;
        case 'ports':
            return <PortsDetailView hosts={scanResult!.hosts} />;
        case 'services':
            return <ServicesDetailView hosts={scanResult!.hosts} />;
        case 'vulnerable-hosts':
            return <VulnerabilitiesDetailView hosts={scanResult!.hosts} />;
        case 'vulnerabilities':
            return <ThreatsDetailView hosts={scanResult!.hosts} />;
        case 'network':
            return <NetworkGraphView hosts={scanResult!.hosts} />;
        case 'api':
            return <ApiPage />;
        default:
            return <p>{t('pageNotFound')}</p>;
    }
  };

  return (
    <>
      <div className="container mx-auto p-0">
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-2xl md:text-3xl font-bold capitalize">{getPageTitle()}</h1>
        </div>
        {renderContent()}
      </div>
      <HostDetailDrawer />
    </>
  );
}
