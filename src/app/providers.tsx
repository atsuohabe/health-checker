'use client';

import { ReactNode, useEffect } from 'react';
import { AuthContext, useAuthProvider } from '@/hooks/useAuth';
import { I18nProvider } from '@/i18n/context';
import AuthGuard from '@/components/AuthGuard';
import Navigation from '@/components/Navigation';

export default function Providers({ children }: { children: ReactNode }) {
  const auth = useAuthProvider();

  // Apply dark mode class to <html>
  useEffect(() => {
    const isDark = auth.profile?.darkMode ?? false;
    document.documentElement.classList.toggle('dark', isDark);
  }, [auth.profile?.darkMode]);

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
