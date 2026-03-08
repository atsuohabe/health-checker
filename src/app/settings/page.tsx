'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/i18n/context';
import { saveUserProfile, getAllRecords, getRecordsInRange } from '@/lib/firestore';
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
  const [hasServerKey, setHasServerKey] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeMsg, setOptimizeMsg] = useState('');
  const initialized = useRef(false);

  useEffect(() => {
    fetch('/api/apikey-status')
      .then(res => res.json())
      .then(data => setHasServerKey(data.hasServerKey))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (profile && !initialized.current) {
      initialized.current = true;
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
    const data: Record<string, unknown> = {
      nickname,
      language: lang,
      targetCalories,
      targetProtein,
      targetCarbs,
      targetFat,
    };
    if (apiKey) {
      data.geminiApiKey = apiKey;
    }
    await saveUserProfile(user.uid, data);
    setLanguage(lang);
    await refreshProfile();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    setOptimizeMsg('');
    try {
      const now = new Date();
      const toLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      const records = await getRecordsInRange(
        user.uid,
        toLocal(start),
        toLocal(now)
      );
      const daysWithMeals = records.filter(r => r.meals.length > 0);
      if (daysWithMeals.length < 3) {
        setOptimizeMsg(t('settings.optimizeNoData'));
        return;
      }
      const totals = daysWithMeals.map(r =>
        r.meals.reduce(
          (acc, m) => ({
            calories: acc.calories + m.nutrition.calories,
            protein: acc.protein + m.nutrition.protein,
            carbs: acc.carbs + m.nutrition.carbs,
            fat: acc.fat + m.nutrition.fat,
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        )
      );
      const avg = {
        calories: totals.reduce((s, t) => s + t.calories, 0) / totals.length,
        protein: totals.reduce((s, t) => s + t.protein, 0) / totals.length,
        carbs: totals.reduce((s, t) => s + t.carbs, 0) / totals.length,
        fat: totals.reduce((s, t) => s + t.fat, 0) / totals.length,
      };
      // Round to nearest step
      setTargetCalories(Math.round(avg.calories / 100) * 100);
      setTargetProtein(Math.round(avg.protein / 10) * 10);
      setTargetCarbs(Math.round(avg.carbs / 10) * 10);
      setTargetFat(Math.round(avg.fat / 10) * 10);
      setOptimizeMsg(t('settings.optimizeDone', { days: String(daysWithMeals.length) }));
    } catch {
      setOptimizeMsg(t('settings.optimizeError'));
    } finally {
      setOptimizing(false);
    }
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
            ['targetCalories', targetCalories, setTargetCalories, t('dashboard.calories') + ' (kcal)', 800, 3800, 100, 'kcal'],
            ['targetProtein', targetProtein, setTargetProtein, t('dashboard.protein') + ' (g)', 10, 210, 10, 'g'],
            ['targetCarbs', targetCarbs, setTargetCarbs, t('dashboard.carbs') + ' (g)', 50, 450, 10, 'g'],
            ['targetFat', targetFat, setTargetFat, t('dashboard.fat') + ' (g)', 10, 210, 10, 'g'],
          ].map(([key, value, setter, label, min, max, step, unit]) => (
            <div key={key as string}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{label as string}</label>
              <select
                value={value as number}
                onChange={e => (setter as (v: number) => void)(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                {Array.from({ length: Math.floor(((max as number) - (min as number)) / (step as number)) + 1 }, (_, i) => (min as number) + i * (step as number)).map(v => (
                  <option key={v} value={v}>{v} {unit as string}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <button
          onClick={handleOptimize}
          disabled={optimizing}
          className="w-full py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 disabled:opacity-50 transition-colors"
        >
          {optimizing ? t('common.loading') : t('settings.optimizeTargets')}
        </button>
        {optimizeMsg && (
          <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{optimizeMsg}</p>
        )}
      </div>

      {/* Gemini API Key */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <h2 className="font-semibold text-gray-800">{t('settings.geminiApiKey')}</h2>
        {hasServerKey ? (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{t('settings.apiKeyServerSet')}</span>
          </div>
        ) : (
          <>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={t('settings.apiKeyPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-400">{t('settings.apiKeyHelp')}</p>
          </>
        )}
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
          onClick={async () => {
            if ('serviceWorker' in navigator) {
              const registrations = await navigator.serviceWorker.getRegistrations();
              await Promise.all(registrations.map(r => r.unregister()));
            }
            if ('caches' in window) {
              const keys = await caches.keys();
              await Promise.all(keys.map(k => caches.delete(k)));
            }
            window.location.reload();
          }}
          className="w-full py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
        >
          {t('settings.updateApp')}
        </button>
        <p className="text-xs text-gray-400">{t('settings.updateAppHelp')}</p>
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
