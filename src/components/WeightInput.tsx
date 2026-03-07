'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n/context';

interface Props {
  currentWeight?: number;
  onSave: (weight: number) => void;
}

export default function WeightInput({ currentWeight, onSave }: Props) {
  const { t } = useTranslation();
  const [weight, setWeight] = useState(currentWeight?.toString() || '');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const w = parseFloat(weight);
    if (isNaN(w) || w <= 0) return;
    onSave(w);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4">
      <h3 className="font-semibold text-gray-800 mb-3">{t('log.weightEntry')}</h3>
      <div className="flex gap-2">
        <input
          type="number"
          step="0.1"
          value={weight}
          onChange={e => setWeight(e.target.value)}
          placeholder={t('log.weightPlaceholder')}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <span className="flex items-center text-sm text-gray-500">kg</span>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          {saved ? '✓' : t('log.saveWeight')}
        </button>
      </div>
    </div>
  );
}
