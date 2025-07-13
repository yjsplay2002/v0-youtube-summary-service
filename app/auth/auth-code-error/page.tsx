'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/hooks/use-i18n';

export default function AuthCodeError() {
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    // Redirect to home page after 5 seconds
    const timer = setTimeout(() => {
      router.push('/');
    }, 5000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">{t('authError.title')}</h1>
        <p className="text-gray-700 mb-6">
          {t('authError.message')}
        </p>
        <p className="text-sm text-gray-500">
          {t('authError.redirect')}
        </p>
      </div>
    </div>
  );
}
