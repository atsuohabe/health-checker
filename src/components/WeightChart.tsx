'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslation } from '@/i18n/context';
import { DailyRecord } from '@/types';

const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const LineChart = dynamic(() => import('recharts').then(m => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then(m => m.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });

interface Props {
  records: DailyRecord[];
}

// Monday-anchored week key so entries in the same calendar week are grouped together.
function getWeekKey(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  const dayOffset = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - dayOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function WeightChart({ records }: Props) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');

  const weighed = records.filter(r => r.weight);

  const dailyData = weighed.map(r => ({
    date: r.date.slice(5),
    weight: r.weight,
  }));

  const weeklyBuckets = new Map<string, { sum: number; count: number }>();
  weighed.forEach(r => {
    const key = getWeekKey(r.date);
    const bucket = weeklyBuckets.get(key) || { sum: 0, count: 0 };
    bucket.sum += r.weight!;
    bucket.count += 1;
    weeklyBuckets.set(key, bucket);
  });
  const weeklyData = Array.from(weeklyBuckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { sum, count }]) => ({
      date: key.slice(5),
      weight: Math.round((sum / count) * 10) / 10,
    }));

  const data = viewMode === 'weekly' ? weeklyData : dailyData;

  const lastTwoWeeks = weeklyData.slice(-2);
  const weeklyDiff =
    lastTwoWeeks.length === 2 ? Math.round((lastTwoWeeks[1].weight - lastTwoWeeks[0].weight) * 10) / 10 : null;

  if (data.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(['daily', 'weekly'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                viewMode === mode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {mode === 'daily' ? t('dashboard.weightViewDaily') : t('dashboard.weightViewWeekly')}
            </button>
          ))}
        </div>
        {viewMode === 'weekly' && weeklyDiff !== null && (
          <span className={`text-xs font-medium ${weeklyDiff > 0 ? 'text-red-600' : weeklyDiff < 0 ? 'text-blue-600' : 'text-gray-500'}`}>
            {t('dashboard.weightVsLastWeek')}: {weeklyDiff > 0 ? '+' : ''}{weeklyDiff} {t('dashboard.kg')}
          </span>
        )}
      </div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="weight" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
