'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/i18n/context';
import { getDailyRecord, getRecordsInRange } from '@/lib/firestore';
import { DailyRecord } from '@/types';
import NutritionSummary from '@/components/NutritionSummary';
import MealCard from '@/components/MealCard';
import WeightChart from '@/components/WeightChart';
import DailyChart from '@/components/DailyChart';
import MacroChart from '@/components/MacroChart';

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getDateNDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const [todayRecord, setTodayRecord] = useState<DailyRecord>({ date: getToday(), meals: [] });
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [chartDays, setChartDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const today = getToday();
      const [rec, rangeRecs] = await Promise.all([
        getDailyRecord(user.uid, today),
        getRecordsInRange(user.uid, getDateNDaysAgo(chartDays), today),
      ]);
      setTodayRecord(rec);
      setRecords(rangeRecs);
      setLoading(false);
    };
    load();
  }, [user, chartDays]);

  if (!user || !profile) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="py-6 space-y-6">
      {/* Greeting */}
      <div>
        <p className="text-sm text-gray-500 mb-1">
          {(() => {
            const d = new Date();
            return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}（${'日月火水木金土'[d.getDay()]}）`;
          })()}
        </p>
        <h1 className="text-2xl font-bold text-gray-800">
          {t('dashboard.greeting', { name: profile.nickname })}
        </h1>
        {todayRecord.weight ? (
          <p className="text-gray-500 mt-1">
            {t('dashboard.weight')}: {todayRecord.weight} {t('dashboard.kg')}
          </p>
        ) : (
          <Link href="/log" className="text-blue-600 text-sm hover:underline mt-1 inline-block">
            {t('dashboard.enterWeight')}
          </Link>
        )}
      </div>

      {/* Nutrition Summary */}
      <NutritionSummary record={todayRecord} profile={profile} />

      {/* Today's Meals */}
      <div className="space-y-2">
        {todayRecord.meals.length > 0 ? (
          todayRecord.meals.map(meal => <MealCard key={meal.id} meal={meal} />)
        ) : (
          <p className="text-center text-gray-400 py-4">{t('dashboard.noMeals')}</p>
        )}
      </div>

      {/* Log Meal Button */}
      <Link
        href="/log"
        className="block w-full py-3 bg-blue-600 text-white text-center font-medium rounded-xl hover:bg-blue-700 transition-colors"
      >
        {t('dashboard.logMeal')}
      </Link>

      {/* Charts */}
      <div className="space-y-4">
        {/* Time Range Selector */}
        <div className="flex gap-2 justify-center">
          {[7, 30, 90].map(days => (
            <button
              key={days}
              onClick={() => setChartDays(days)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                chartDays === days ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              {days === 7 ? t('dashboard.days7') : days === 30 ? t('dashboard.days30') : t('dashboard.days90')}
            </button>
          ))}
        </div>

        {/* Weight Trend */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-gray-800 mb-3">{t('dashboard.weightTrend')}</h3>
          <WeightChart records={records} />
        </div>

        {/* Calorie Trend */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-gray-800 mb-3">{t('dashboard.calorieTrend')}</h3>
          <DailyChart records={records} />
        </div>

        {/* Macro Trends */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-gray-800 mb-3">{t('dashboard.macroTrend')}</h3>
          <MacroChart records={records} />
        </div>
      </div>
    </div>
  );
}
