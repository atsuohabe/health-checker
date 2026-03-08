'use client';

import { useTranslation } from '@/i18n/context';
import { DailyRecord, UserProfile } from '@/types';

interface Props {
  record: DailyRecord;
  profile: UserProfile;
}

export default function NutritionSummary({ record, profile }: Props) {
  const { t } = useTranslation();

  const totals = record.meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.nutrition.calories,
      protein: acc.protein + m.nutrition.protein,
      carbs: acc.carbs + m.nutrition.carbs,
      fat: acc.fat + m.nutrition.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const bars = [
    { label: t('dashboard.calories'), value: totals.calories, target: profile.targetCalories, unit: t('dashboard.kcal'), color: 'bg-blue-500', overColor: 'bg-red-500' },
    { label: t('dashboard.protein'), value: totals.protein, target: profile.targetProtein, unit: t('dashboard.g'), color: 'bg-red-500', overColor: 'bg-red-700' },
    { label: t('dashboard.carbs'), value: totals.carbs, target: profile.targetCarbs, unit: t('dashboard.g'), color: 'bg-yellow-500', overColor: 'bg-red-500' },
    { label: t('dashboard.fat'), value: totals.fat, target: profile.targetFat, unit: t('dashboard.g'), color: 'bg-green-500', overColor: 'bg-red-500' },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
      <h2 className="font-semibold text-gray-800">{t('dashboard.todaySummary')}</h2>
      {bars.map(({ label, value, target, unit, color, overColor }) => {
        const isOver = value > target;
        const pct = Math.min((value / target) * 100, 100);
        return (
          <div key={label}>
            <div className="flex justify-between text-sm mb-1">
              <span className={isOver ? 'text-red-600 font-semibold' : 'text-gray-600'}>{label}</span>
              <span className={isOver ? 'text-red-600 font-bold' : 'text-gray-800 font-medium'}>
                {Math.round(value)} / {target} {unit}
                {isOver && ' ⚠'}
              </span>
            </div>
            <div className="h-3 rounded-full bg-gray-200 overflow-hidden">
              <div className={`h-full rounded-full ${isOver ? overColor : color} transition-all`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
