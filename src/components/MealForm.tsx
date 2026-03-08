'use client';

import { useState, useRef } from 'react';
import { useTranslation } from '@/i18n/context';
import { useAuth } from '@/hooks/useAuth';
import { MealType, Nutrition, MealEntry } from '@/types';
import { analyzeFood, resizeImage } from '@/lib/gemini';
import { MEAL_TYPES } from '@/lib/constants';

interface Props {
  onSave: (meal: MealEntry) => void | Promise<void>;
  editMeal?: MealEntry | null;
  onCancel?: () => void;
}

export default function MealForm({ onSave, editMeal, onCancel }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [mealType, setMealType] = useState<MealType>(editMeal?.type || 'lunch');
  const [description, setDescription] = useState(editMeal?.description || '');
  const [photoBase64, setPhotoBase64] = useState<string | undefined>(editMeal?.photoBase64);
  const [nutrition, setNutrition] = useState<Nutrition>(
    editMeal?.nutrition || { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      const resized = await resizeImage(dataUrl);
      setPhotoBase64(resized);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    const apiKey = profile?.geminiApiKey || undefined;
    if (!apiKey && !process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      setError(t('log.noApiKey'));
      return;
    }
    setAnalyzing(true);
    setError('');
    try {
      const result = await analyzeFood({ imageBase64: photoBase64, description }, apiKey);
      const round = (v: number, step: number, max: number) => Math.min(Math.round(v / step) * step, max);
      setNutrition({
        calories: round(result.calories, 10, 2000),
        protein: round(result.protein, 1, 200),
        carbs: round(result.carbs, 1, 300),
        fat: round(result.fat, 1, 200),
      });
    } catch {
      setError(t('log.analyzeError'));
    } finally {
      setAnalyzing(false);
    }
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saving) return;
    const meal: MealEntry = {
      id: editMeal?.id || crypto.randomUUID(),
      type: mealType,
      description,
      photoBase64,
      nutrition,
      timestamp: editMeal?.timestamp || new Date().toISOString(),
    };
    setSaving(true);
    try {
      await onSave(meal);
      setSaved(true);
      if (!editMeal) {
        setDescription('');
        setPhotoBase64(undefined);
        setNutrition({ calories: 0, protein: 0, carbs: 0, fat: 0 });
        if (fileRef.current) fileRef.current.value = '';
      }
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError(t('log.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
      {/* Meal Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('log.mealType')}</label>
        <div className="flex gap-2">
          {MEAL_TYPES.map(type => (
            <button
              key={type}
              onClick={() => setMealType(type)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                mealType === type ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t(`log.${type}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Photo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('log.photo')}</label>
        {photoBase64 ? (
          <div className="relative">
            <img src={photoBase64} alt="meal" className="w-full h-48 object-cover rounded-lg" />
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-2 right-2 bg-white/80 text-sm px-3 py-1 rounded-full"
            >
              {t('log.changePhoto')}
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-400 transition-colors"
          >
            {t('log.takePhoto')}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('log.description')}</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={t('log.descriptionPlaceholder')}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>

      {/* AI Analyze */}
      <button
        onClick={handleAnalyze}
        disabled={analyzing || (!photoBase64 && !description)}
        className="w-full py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {analyzing ? t('log.analyzing') : t('log.analyze')}
      </button>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {/* Nutrition Editor */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('log.nutrition')}</label>
        <div className="grid grid-cols-2 gap-3">
          {([
            ['calories', 0, 2000, 10, 'kcal'],
            ['protein', 0, 200, 1, 'g'],
            ['carbs', 0, 300, 1, 'g'],
            ['fat', 0, 200, 1, 'g'],
          ] as const).map(([key, min, max, step, unit]) => (
            <div key={key}>
              <label className="block text-xs text-gray-500 mb-1">
                {t(`dashboard.${key}`)} ({unit})
              </label>
              <select
                value={nutrition[key]}
                onChange={e => setNutrition({ ...nutrition, [key]: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                {Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, i) => min + i * step).map(v => (
                  <option key={v} value={v}>{v} {unit}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="flex gap-2">
        {onCancel && (
          <button onClick={onCancel} className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors">
            {t('log.cancel')}
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={!description.trim() || saving}
          className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? t('common.loading') : saved ? t('log.saved') : t('log.save')}
        </button>
      </div>
    </div>
  );
}
