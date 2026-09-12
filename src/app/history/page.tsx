'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/i18n/context';
import { getRecordsInRange } from '@/lib/firestore';
import { DailyRecord } from '@/types';
import MealCard from '@/components/MealCard';

function getWeekRange(offset: number) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + offset * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function HistoryPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [weekOffset, setWeekOffset] = useState(0);
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { start, end } = getWeekRange(weekOffset);
      const recs = await getRecordsInRange(user.uid, start, end);
      setRecords(recs);
      setLoading(false);
    };
    load();
  }, [user, weekOffset]);

  if (!user) return null;

  const { start, end } = getWeekRange(weekOffset);

  // Generate all dates in the week
  const dates: string[] = [];
  const d = new Date(start + 'T00:00:00');
  const endD = new Date(end + 'T00:00:00');
  while (d <= endD) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }

  return (
    <div className="py-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">{t('history.title')}</h1>

      {/* Week Navigation */}
      <div className="flex items-center justify-between bg-white rounded-xl shadow-sm px-4 py-3">
        <button
          onClick={() => setWeekOffset(w => w - 1)}
          className="text-blue-600 hover:text-blue-800 font-medium text-sm"
        >
          &larr; {t('history.prev')}
        </button>
        <span className="text-sm font-medium text-gray-700">
          {formatDate(start)} - {formatDate(end)}
        </span>
        <button
          onClick={() => setWeekOffset(w => Math.min(w + 1, 0))}
          disabled={weekOffset >= 0}
          className="text-blue-600 hover:text-blue-800 font-medium text-sm disabled:text-gray-300"
        >
          {t('history.next')} &rarr;
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="space-y-2">
          {dates.map(date => {
            const rec = records.find(r => r.date === date);
            const totals = (rec?.meals || []).reduce(
              (acc, m) => ({
                calories: acc.calories + m.nutrition.calories,
                protein: acc.protein + m.nutrition.protein,
                carbs: acc.carbs + m.nutrition.carbs,
                fat: acc.fat + m.nutrition.fat,
              }),
              { calories: 0, protein: 0, carbs: 0, fat: 0 }
            );
            const hasMeals = !!rec && rec.meals.length > 0;
            const expanded = expandedDate === date;

            return (
              <div key={date} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedDate(expanded ? null : date)}
                  className="w-full flex flex-col gap-1 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-800">{formatDate(date)}</span>
                      {rec?.weight && (
                        <span className="text-xs text-gray-500">{rec.weight}kg</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {hasMeals ? (
                        <>
                          <span className="text-sm font-medium text-blue-600">{Math.round(totals.calories)} kcal</span>
                          <span className="text-xs text-gray-400">{rec!.meals.length} {t('history.meals')}</span>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">{t('history.noRecords')}</span>
                      )}
                      <span className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}>
                        &#9660;
                      </span>
                    </div>
                  </div>
                  {hasMeals && (
                    <div className="flex gap-3 text-xs text-gray-400">
                      <span>P {Math.round(totals.protein)}g</span>
                      <span>C {Math.round(totals.carbs)}g</span>
                      <span>F {Math.round(totals.fat)}g</span>
                    </div>
                  )}
                </button>
                {expanded && rec && rec.meals.length > 0 && (
                  <div className="px-4 pb-3 space-y-2">
                    {rec.meals.map(meal => (
                      <MealCard key={meal.id} meal={meal} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
