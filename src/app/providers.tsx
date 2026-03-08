'use client';

import { ReactNode } from 'react';
import { AuthContext, useAuthProvider } from '@/hooks/useAuth';
import { I18nProvider } from '@/i18n/context';
import AuthGuard from '@/components/AuthGuard';
import Navigation from '@/components/Navigation';

export default function Providers({ children }: { children: ReactNode }) {
  const auth = useAuthProvider();

  return (
    <AuthContext.Provider value={auth}>
      <I18nProvider initialLanguage={auth.profile?.language || 'ja'}>
        <AuthGuard>
          <main className="pb-28 max-w-2xl mx-auto px-4">
            {children}
          </main>
          <Navigation />
        </AuthGuard>
      </I18nProvider>
    </AuthContext.Provider>
  );
}
