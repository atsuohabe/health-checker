'use client';

import dynamic from 'next/dynamic';
import { DailyRecord } from '@/types';
import { useTranslation } from '@/i18n/context';

const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const PieChart = dynamic(() => import('recharts').then(m => m.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then(m => m.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then(m => m.Cell), { ssr: false });
const Legend = dynamic(() => import('recharts').then(m => m.Legend), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });

const COLORS = ['#EF4444', '#EAB308', '#22C55E'];

interface Props {
  record: DailyRecord;
}

export default function MacroChart({ record }: Props) {
  const { t } = useTranslation();

  const totals = record.meals.reduce(
    (acc, m) => ({
      protein: acc.protein + m.nutrition.protein,
      carbs: acc.carbs + m.nutrition.carbs,
      fat: acc.fat + m.nutrition.fat,
    }),
    { protein: 0, carbs: 0, fat: 0 }
  );

  const data = [
    { name: t('dashboard.protein'), value: Math.round(totals.protein) },
    { name: t('dashboard.carbs'), value: Math.round(totals.carbs) },
    { name: t('dashboard.fat'), value: Math.round(totals.fat) },
  ];

  if (data.every(d => d.value === 0)) return null;

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" outerRadius={60} dataKey="value" label={({ name, value }) => `${name}: ${value}g`}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
