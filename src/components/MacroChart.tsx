'use client';

import dynamic from 'next/dynamic';
import { DailyRecord } from '@/types';
import { useTranslation } from '@/i18n/context';

const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });

interface Props {
  records: DailyRecord[];
}

const MACROS = [
  { key: 'protein', color: '#EF4444', labelKey: 'dashboard.protein' },
  { key: 'carbs', color: '#EAB308', labelKey: 'dashboard.carbs' },
  { key: 'fat', color: '#22C55E', labelKey: 'dashboard.fat' },
] as const;

export default function MacroChart({ records }: Props) {
  const { t } = useTranslation();

  const data = records.map(r => {
    const totals = r.meals.reduce(
      (acc, m) => ({
        protein: acc.protein + m.nutrition.protein,
        carbs: acc.carbs + m.nutrition.carbs,
        fat: acc.fat + m.nutrition.fat,
      }),
      { protein: 0, carbs: 0, fat: 0 }
    );
    return {
      date: r.date.slice(5),
      protein: Math.round(totals.protein),
      carbs: Math.round(totals.carbs),
      fat: Math.round(totals.fat),
    };
  });

  if (data.length === 0) return null;

  return (
    <div className="space-y-4">
      {MACROS.map(({ key, color, labelKey }) => (
        <div key={key}>
          <h4 className="text-sm font-medium text-gray-600 mb-2">{t(labelKey)} (g)</h4>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey={key} fill={color} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}
