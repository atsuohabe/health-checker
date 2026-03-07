'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/i18n/context';
import { saveUserProfile, getAllRecords } from '@/lib/firestore';
import { Language } from '@/types';

export default function SettingsPage() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { t, setLanguage } = useTranslation();
  const router = useRouter();

  const [nickname, setNickname] = useState('');
  const [lang, setLang] = useState<Language>('ja');
  const [targetCalories, setTargetCalories] = useState(2000);
  const [targetProtein, setTargetProtein] = useState(60);
  const [targetCarbs, setTargetCarbs] = useState(250);
  const [targetFat, setTargetFat] = useState(55);
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setNickname(profile.nickname);
      setLang(profile.language);
      setTargetCalories(profile.targetCalories);
      setTargetProtein(profile.targetProtein);
      setTargetCarbs(profile.targetCarbs);
      setTargetFat(profile.targetFat);
      setApiKey(profile.geminiApiKey || '');
    }
  }, [profile]);

  if (!user || !profile) return null;

  const handleSave = async () => {
    await saveUserProfile(user.uid, {
      nickname,
      language: lang,
      targetCalories,
      targetProtein,
      targetCarbs,
      targetFat,
      geminiApiKey: apiKey || undefined,
    });
    setLanguage(lang);
    await refreshProfile();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExport = async () => {
    const records = await getAllRecords(user.uid);
    const data = JSON.stringify({ profile, records }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calorie-tracker-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLogout = async () => {
    if (!confirm(t('settings.logoutConfirm'))) return;
    await signOut();
    router.push('/setup');
  };

  return (
    <div className="py-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">{t('settings.title')}</h1>

      {/* Profile */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
        <h2 className="font-semibold text-gray-800">{t('settings.profile')}</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.nickname')}</label>
          <input
            type="text"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.language')}</label>
          <div className="flex gap-2">
            {([['ja', '日本語'], ['en', 'English'], ['zh-TW', '繁體中文']] as [Language, string][]).map(([l, label]) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  lang === l ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Targets */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
        <h2 className="font-semibold text-gray-800">{t('settings.targets')}</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            ['targetCalories', targetCalories, setTargetCalories, t('dashboard.calories') + ' (kcal)'],
            ['targetProtein', targetProtein, setTargetProtein, t('dashboard.protein') + ' (g)'],
            ['targetCarbs', targetCarbs, setTargetCarbs, t('dashboard.carbs') + ' (g)'],
            ['targetFat', targetFat, setTargetFat, t('dashboard.fat') + ' (g)'],
          ].map(([key, value, setter, label]) => (
            <div key={key as string}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{label as string}</label>
              <input
                type="number"
                value={value as number}
                onChange={e => (setter as (v: number) => void)(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Gemini API Key */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <h2 className="font-semibold text-gray-800">{t('settings.geminiApiKey')}</h2>
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder={t('settings.apiKeyPlaceholder')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-400">{t('settings.apiKeyHelp')}</p>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
      >
        {saved ? t('settings.saved') : t('settings.save')}
      </button>

      {/* Data Management */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <h2 className="font-semibold text-gray-800">{t('settings.dataManagement')}</h2>
        <button
          onClick={handleExport}
          className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          {t('settings.exportData')}
        </button>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full py-3 bg-red-50 text-red-600 font-medium rounded-xl hover:bg-red-100 transition-colors"
      >
        {t('settings.logout')}
      </button>
    </div>
  );
}
