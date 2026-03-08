'use client';

import dynamic from 'next/dynamic';
import { DailyRecord } from '@/types';

const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });
const ReferenceLine = dynamic(() => import('recharts').then(m => m.ReferenceLine), { ssr: false });

interface Props {
  records: DailyRecord[];
  target?: number;
}

export default function DailyChart({ records, target }: Props) {
  const data = records.map(r => ({
    date: r.date.slice(5),
    calories: r.meals.reduce((sum, m) => sum + m.nutrition.calories, 0),
  }));

  if (data.length === 0) return null;

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          {target && <ReferenceLine y={target} stroke="#EF4444" strokeDasharray="6 3" strokeWidth={2} label={{ value: `${target}`, position: 'right', fontSize: 10, fill: '#EF4444' }} />}
          <Bar dataKey="calories" fill="#3B82F6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
