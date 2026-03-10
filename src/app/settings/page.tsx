'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/i18n/context';
import { saveUserProfile, getAllRecords, getRecordsInRange } from '@/lib/firestore';
import { Language, Gender } from '@/types';

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
  const [height, setHeight] = useState<number | undefined>(undefined);
  const [birthYear, setBirthYear] = useState<number | undefined>(undefined);
  const [gender, setGender] = useState<Gender | undefined>(undefined);
  const [goalPreset, setGoalPreset] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [hasServerKey, setHasServerKey] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeMsg, setOptimizeMsg] = useState('');
  const [records, setRecords] = useState<import('@/types').DailyRecord[]>([]);
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
      setHeight(profile.height);
      setBirthYear(profile.birthYear);
      setGender(profile.gender);
      setGoalPreset(profile.goalPreset || '');
      setDarkMode(profile.darkMode || false);
      setApiKey(profile.geminiApiKey || '');
    }
  }, [profile]);

  if (!user || !profile) return null;

  const handleSave = async () => {
    const data: Record<string, unknown> = {
      nickname,
      language: lang,
      height: height || null,
      birthYear: birthYear || null,
      gender: gender || null,
      goalPreset: goalPreset || null,
      darkMode,
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

  // Estimate BMR using Mifflin-St Jeor if body stats available
  const estimateBmr = (w?: number) => {
    if (!height || !birthYear) return null;
    const age = new Date().getFullYear() - birthYear;
    const weightKg = w || 60;
    if (gender === 'male') return 10 * weightKg + 6.25 * height - 5 * age + 5;
    if (gender === 'female') return 10 * weightKg + 6.25 * height - 5 * age - 161;
    return 10 * weightKg + 6.25 * height - 5 * age - 78; // average for 'other'
  };

  // Apply preset with body-stats adjustment
  const applyPreset = (presetKey: string) => {
    setGoalPreset(presetKey);
    const basePresets: Record<string, { cal: number; p: number; c: number; f: number; activityFactor: number }> = {
      diet:        { cal: 1400, p: 60,  c: 150, f: 40, activityFactor: 1.2 },
      gentle_diet: { cal: 1700, p: 70,  c: 200, f: 45, activityFactor: 1.3 },
      maintain:    { cal: 2000, p: 60,  c: 250, f: 55, activityFactor: 1.5 },
      muscle:      { cal: 2500, p: 130, c: 300, f: 60, activityFactor: 1.6 },
      lean_bulk:   { cal: 2200, p: 120, c: 250, f: 50, activityFactor: 1.55 },
      cut_fat:     { cal: 1600, p: 110, c: 130, f: 45, activityFactor: 1.4 },
      active:      { cal: 2800, p: 100, c: 350, f: 70, activityFactor: 1.75 },
    };
    const preset = basePresets[presetKey];
    if (!preset) return;

    // Get latest weight from records if available
    const latestWeight = records.find(r => r.weight)?.weight;
    const bmr = estimateBmr(latestWeight);

    if (bmr) {
      // Use BMR * activity factor, then distribute macros proportionally
      const tdee = Math.round(bmr * preset.activityFactor);
      // Adjust calorie target based on goal type
      let calTarget: number;
      if (['diet', 'cut_fat'].includes(presetKey)) calTarget = Math.round((tdee - 500) / 100) * 100;
      else if (presetKey === 'gentle_diet') calTarget = Math.round((tdee - 300) / 100) * 100;
      else if (['muscle', 'lean_bulk', 'active'].includes(presetKey)) calTarget = Math.round((tdee + 200) / 100) * 100;
      else calTarget = Math.round(tdee / 100) * 100;

      // Scale macros proportionally from preset baseline
      const ratio = calTarget / preset.cal;
      setTargetCalories(Math.max(1000, calTarget));
      setTargetProtein(Math.max(10, Math.round(preset.p * ratio / 10) * 10));
      setTargetCarbs(Math.max(50, Math.round(preset.c * ratio / 10) * 10));
      setTargetFat(Math.max(10, Math.round(preset.f * ratio / 10) * 10));
    } else {
      // No body stats - use preset defaults
      setTargetCalories(preset.cal);
      setTargetProtein(preset.p);
      setTargetCarbs(preset.c);
      setTargetFat(preset.f);
    }
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    setOptimizeMsg('');
    try {
      const now = new Date();
      const toLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      const recs = await getRecordsInRange(user.uid, toLocal(start), toLocal(now));
      setRecords(recs);
      const daysWithMeals = recs.filter(r => r.meals.length > 0);
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
        calories: totals.reduce((s, v) => s + v.calories, 0) / totals.length,
        protein: totals.reduce((s, v) => s + v.protein, 0) / totals.length,
        carbs: totals.reduce((s, v) => s + v.carbs, 0) / totals.length,
        fat: totals.reduce((s, v) => s + v.fat, 0) / totals.length,
      };

      // If body stats available, blend past average with BMR-based estimate
      const latestWeight = recs.find(r => r.weight)?.weight;
      const bmr = estimateBmr(latestWeight);
      let details = '';

      if (bmr) {
        const tdee = bmr * 1.5; // moderate activity assumption
        // Blend: 60% past data, 40% BMR-based
        const blended = Math.round((avg.calories * 0.6 + tdee * 0.4) / 100) * 100;
        const ratio = blended / (avg.calories || 1);
        setTargetCalories(blended);
        setTargetProtein(Math.round(avg.protein * ratio / 10) * 10);
        setTargetCarbs(Math.round(avg.carbs * ratio / 10) * 10);
        setTargetFat(Math.round(avg.fat * ratio / 10) * 10);
        details = ` (BMR: ${Math.round(bmr)} kcal)`;
      } else {
        setTargetCalories(Math.round(avg.calories / 100) * 100);
        setTargetProtein(Math.round(avg.protein / 10) * 10);
        setTargetCarbs(Math.round(avg.carbs / 10) * 10);
        setTargetFat(Math.round(avg.fat / 10) * 10);
      }
      setOptimizeMsg(t('settings.optimizeDone', { days: String(daysWithMeals.length) }) + details);
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

        {/* Body Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t('settings.gender')}</label>
            <select
              value={gender || ''}
              onChange={e => setGender((e.target.value || undefined) as Gender | undefined)}
              className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">{t('settings.unset')}</option>
              <option value="male">{t('settings.male')}</option>
              <option value="female">{t('settings.female')}</option>
              <option value="other">{t('settings.otherGender')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t('settings.birthYear')}</label>
            <select
              value={birthYear || ''}
              onChange={e => setBirthYear(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">{t('settings.unset')}</option>
              {Array.from({ length: 87 }, (_, i) => new Date().getFullYear() - 4 - i).map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t('settings.height')}</label>
            <select
              value={height || ''}
              onChange={e => setHeight(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">{t('settings.unset')}</option>
              {Array.from({ length: 81 }, (_, i) => i + 120).map(v => (
                <option key={v} value={v}>{v} cm</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-400">{t('settings.bodyStatsHelp')}</p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.language')}</label>
          <div className="grid grid-cols-2 gap-2">
            {([['ja', '日本語'], ['en', 'English'], ['zh-TW', '繁體中文'], ['es', 'Español']] as [Language, string][]).map(([l, label]) => (
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

        {/* Dark Mode */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">{t('settings.darkMode')}</span>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              darkMode ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                darkMode ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Targets */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
        <h2 className="font-semibold text-gray-800">{t('settings.targets')}</h2>

        {/* Goal Preset */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{t('settings.goalPreset')}</label>
          <select
            value={goalPreset}
            onChange={e => applyPreset(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="" disabled>{t('settings.goalPlaceholder')}</option>
            <option value="diet">{t('settings.goalDiet')}</option>
            <option value="gentle_diet">{t('settings.goalGentleDiet')}</option>
            <option value="maintain">{t('settings.goalMaintain')}</option>
            <option value="muscle">{t('settings.goalMuscle')}</option>
            <option value="lean_bulk">{t('settings.goalLeanBulk')}</option>
            <option value="cut_fat">{t('settings.goalCutFat')}</option>
            <option value="active">{t('settings.goalActive')}</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">{t('settings.goalHelp')}</p>
        </div>

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

      {/* Share */}
      <button
        onClick={async () => {
          const url = window.location.origin;
          if (navigator.share) {
            navigator.share({ title: 'Calorie Tracker', url }).catch(() => {});
          } else {
            await navigator.clipboard.writeText(url);
            setShareCopied(true);
            setTimeout(() => setShareCopied(false), 2000);
          }
        }}
        className="w-full py-3 bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200 font-medium rounded-xl hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors"
      >
        {shareCopied ? t('settings.shareCopied') : t('settings.shareApp')}
      </button>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full py-3 bg-red-50 text-red-600 font-medium rounded-xl hover:bg-red-100 transition-colors"
      >
        {t('settings.logout')}
      </button>

      <p className="text-center text-xs text-gray-400 mt-2 mb-4">v{process.env.APP_VERSION}</p>
    </div>
  );
}
