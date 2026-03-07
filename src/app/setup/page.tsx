'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/i18n/context';
import { saveUserProfile } from '@/lib/firestore';
import { Language } from '@/types';
import { DEFAULT_TARGET_CALORIES, DEFAULT_TARGET_PROTEIN, DEFAULT_TARGET_CARBS, DEFAULT_TARGET_FAT } from '@/lib/constants';

export default function SetupPage() {
  const { user, profile, signInWithGoogle, refreshProfile } = useAuth();
  const { t, language, setLanguage } = useTranslation();
  const router = useRouter();

  const [nickname, setNickname] = useState(profile?.nickname || '');
  const [targetCalories, setTargetCalories] = useState(profile?.targetCalories || DEFAULT_TARGET_CALORIES);
  const [targetProtein, setTargetProtein] = useState(profile?.targetProtein || DEFAULT_TARGET_PROTEIN);
  const [targetCarbs, setTargetCarbs] = useState(profile?.targetCarbs || DEFAULT_TARGET_CARBS);
  const [targetFat, setTargetFat] = useState(profile?.targetFat || DEFAULT_TARGET_FAT);
  const [saving, setSaving] = useState(false);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
  };

  const handleStart = async () => {
    if (!user || !nickname.trim()) return;
    setSaving(true);
    await saveUserProfile(user.uid, {
      nickname: nickname.trim(),
      language,
      targetCalories,
      targetProtein,
      targetCarbs,
      targetFat,
    });
    await refreshProfile();
    setSaving(false);
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800">{t('setup.welcome')}</h1>
          <p className="text-gray-500 mt-2">{t('setup.subtitle')}</p>
        </div>

        {/* Language Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('setup.selectLanguage')}
          </label>
          <div className="flex gap-2">
            {([['ja', '日本語'], ['en', 'English'], ['zh-TW', '繁體中文']] as [Language, string][]).map(([lang, label]) => (
              <button
                key={lang}
                onClick={() => handleLanguageChange(lang)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  language === lang
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Google Sign-In */}
        {!user ? (
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="text-gray-700 font-medium">{t('setup.signInGoogle')}</span>
          </button>
        ) : (
          <div className="text-center text-sm text-green-600 bg-green-50 rounded-lg py-2">
            {t('setup.signedInAs', { email: user.email || '' })}
          </div>
        )}

        {/* Profile Setup (shown after sign-in) */}
        {user && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('setup.nickname')}</label>
              <input
                type="text"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                placeholder={t('setup.nicknamePlaceholder')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('setup.targetCalories')}</label>
                <input type="number" value={targetCalories} onChange={e => setTargetCalories(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('setup.targetProtein')}</label>
                <input type="number" value={targetProtein} onChange={e => setTargetProtein(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('setup.targetCarbs')}</label>
                <input type="number" value={targetCarbs} onChange={e => setTargetCarbs(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('setup.targetFat')}</label>
                <input type="number" value={targetFat} onChange={e => setTargetFat(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            </div>

            <button
              onClick={handleStart}
              disabled={!nickname.trim() || saving}
              className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? t('common.loading') : t('setup.start')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
