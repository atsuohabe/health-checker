'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '@/i18n/context';
import { useAuth } from '@/hooks/useAuth';
import { MealType, Nutrition, MealEntry } from '@/types';
import { analyzeFood, resizeImage, RateLimitError } from '@/lib/gemini';
import { savePhotos } from '@/lib/photo-storage';
import { MEAL_TYPES } from '@/lib/constants';

function generateId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
}

interface FoodItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface Props {
  onSave: (meal: MealEntry) => void | Promise<void>;
  editMeal?: MealEntry | null;
  onCancel?: () => void;
  defaultMealType?: MealType;
}

const DRAFT_KEY = 'meal-draft';

export default function MealForm({ onSave, editMeal, onCancel, defaultMealType }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  // Load draft once from localStorage (only for new meals, not edits)
  const [draft] = useState<{
    description?: string;
    nutrition?: Nutrition;
    foodItems?: FoodItem[];
  } | null>(() => {
    if (editMeal) return null;
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); }
    catch { return null; }
  });

  const [mealType, setMealType] = useState<MealType>(editMeal?.type || defaultMealType || 'breakfast');
  const [description, setDescription] = useState(editMeal?.description || draft?.description || '');
  const [photos, setPhotos] = useState<string[]>(() => {
    if (editMeal?.photos?.length) return editMeal.photos;
    if (editMeal?.photoBase64) return [editMeal.photoBase64];
    return [];
  });
  const [nutrition, setNutrition] = useState<Nutrition>(
    editMeal?.nutrition || draft?.nutrition || { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const [hasServerKey, setHasServerKey] = useState(false);
  const [foodItems, setFoodItems] = useState<FoodItem[]>(draft?.foodItems || []);
  const [originalItems, setOriginalItems] = useState<FoodItem[] | null>(null);
  const [showItems, setShowItems] = useState((draft?.foodItems?.length ?? 0) > 0);

  useEffect(() => {
    fetch('/api/apikey-status')
      .then(res => res.json())
      .then(data => setHasServerKey(data.hasServerKey))
      .catch(() => {});
  }, []);

  // Persist draft to localStorage so it survives app updates/refreshes
  useEffect(() => {
    if (editMeal) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ description, nutrition, foodItems }));
  }, [description, nutrition, foodItems, editMeal]);

  // Countdown timer for rate limit — does NOT auto-retry to avoid infinite loops
  useEffect(() => {
    if (retryCountdown === null || retryCountdown <= 0) return;
    const timer = setTimeout(
      () => setRetryCountdown(c => (c !== null && c > 1 ? c - 1 : null)),
      1000
    );
    return () => clearTimeout(timer);
  }, [retryCountdown]);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newPhotos: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.readAsDataURL(files[i]);
      });
      const resized = await resizeImage(dataUrl);
      newPhotos.push(resized);
    }
    setPhotos(prev => [...prev, ...newPhotos]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const recalcFromItems = (items: FoodItem[]) => {
    const totals = items.reduce(
      (acc, item) => ({
        calories: acc.calories + item.calories,
        protein: acc.protein + item.protein,
        carbs: acc.carbs + item.carbs,
        fat: acc.fat + item.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    setNutrition({
      calories: Math.round(totals.calories / 10) * 10,
      protein: Math.round(totals.protein),
      carbs: Math.round(totals.carbs),
      fat: Math.round(totals.fat),
    });
  };

  const handleAnalyze = async () => {
    const apiKey = profile?.geminiApiKey || undefined;
    if (!apiKey && !hasServerKey) {
      setError(t('log.noApiKey'));
      return;
    }
    setAnalyzing(true);
    setError('');
    try {
      const result = await analyzeFood({ imageBase64: photos[0], description }, apiKey);
      const round = (v: number, step: number, max: number) => Math.min(Math.round(v / step) * step, max);
      setNutrition({
        calories: round(result.calories, 10, 2000),
        protein: round(result.protein, 1, 200),
        carbs: round(result.carbs, 1, 300),
        fat: round(result.fat, 1, 200),
      });
      if (result.items && result.items.length > 0) {
        setFoodItems(result.items);
        setOriginalItems(null);
        setShowItems(true);
      }
    } catch (err) {
      if (err instanceof RateLimitError) {
        setRetryCountdown(err.retryAfter);
        setError('');
      } else {
        const msg = err instanceof Error ? err.message : '';
        setError(msg || t('log.analyzeError'));
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const updateItem = (index: number, field: keyof FoodItem, value: string | number) => {
    const updated = [...foodItems];
    if (field === 'name') {
      updated[index] = { ...updated[index], name: value as string };
    } else {
      updated[index] = { ...updated[index], [field]: Number(value) || 0 };
    }
    setFoodItems(updated);
    if (field !== 'name') {
      recalcFromItems(updated);
    }
  };

  const removeItem = (index: number) => {
    const updated = foodItems.filter((_, i) => i !== index);
    setFoodItems(updated);
    setOriginalItems(null);
    recalcFromItems(updated);
  };

  const divideItem = (index: number, divisor: number) => {
    if (!originalItems) {
      setOriginalItems(foodItems.map(item => ({ ...item })));
    }
    const updated = [...foodItems];
    const item = updated[index];
    updated[index] = {
      ...item,
      calories: Math.round(item.calories / divisor),
      protein: Math.round(item.protein / divisor),
      carbs: Math.round(item.carbs / divisor),
      fat: Math.round(item.fat / divisor),
    };
    setFoodItems(updated);
    recalcFromItems(updated);
  };

  const undoDivide = () => {
    if (originalItems) {
      setFoodItems(originalItems);
      recalcFromItems(originalItems);
      setOriginalItems(null);
    }
  };

  const [servingPrompt, setServingPrompt] = useState<number | null>(null);

  const handleOneServing = (index: number) => {
    if (servingPrompt === index) {
      setServingPrompt(null);
    } else {
      setServingPrompt(index);
    }
  };

  const handleRecalc = () => {
    recalcFromItems(foodItems);
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saving) return;
    const mealId = editMeal?.id || generateId();
    const meal: MealEntry = {
      id: mealId,
      type: mealType,
      description,
      nutrition,
      timestamp: editMeal?.timestamp || new Date().toISOString(),
    };
    setSaving(true);
    try {
      // Save photos to IndexedDB (not Firestore) to avoid 1MB document size limit
      if (photos.length > 0) {
        await savePhotos(mealId, photos);
      }
      await onSave(meal);
      setSaved(true);
      if (!editMeal) {
        localStorage.removeItem(DRAFT_KEY);
        setDescription('');
        setPhotos([]);
        setNutrition({ calories: 0, protein: 0, carbs: 0, fat: 0 });
        setFoodItems([]);
        setShowItems(false);
        if (fileRef.current) fileRef.current.value = '';
      }
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Meal save failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`${t('log.saveError')}: ${msg}`);
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
        {photos.length > 0 ? (
          <div className="space-y-2">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photos.map((photo, idx) => (
                <div key={idx} className="relative flex-shrink-0">
                  <img src={photo} alt={`meal-${idx + 1}`} className="h-32 w-32 object-cover rounded-lg" />
                  <button
                    onClick={() => removePhoto(idx)}
                    className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileRef.current?.click()}
                className="flex-shrink-0 h-32 w-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-400 transition-colors"
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-400 transition-colors"
          >
            {t('log.takePhoto')}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={handlePhoto} className="hidden" />
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
        disabled={analyzing || retryCountdown !== null || (photos.length === 0 && !description)}
        className="w-full py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {analyzing
          ? t('log.analyzing')
          : retryCountdown !== null
            ? `${retryCountdown}秒後に再試行できます`
            : t('log.analyze')}
      </button>
      {error && <p className="text-red-600 text-sm font-medium bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {/* Food Items Breakdown */}
      {foodItems.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700">{t('log.itemBreakdown')}</h4>
            <button
              onClick={() => setShowItems(!showItems)}
              className="text-xs text-blue-600 hover:underline"
            >
              {showItems ? t('log.hideItems') : t('log.showItems')}
            </button>
          </div>
          {showItems && (
            <div className="space-y-2">
              {foodItems.map((item, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={e => updateItem(idx, 'name', e.target.value)}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm bg-white"
                    />
                    <button
                      onClick={() => removeItem(idx)}
                      className="text-red-400 hover:text-red-600 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {(['calories', 'protein', 'carbs', 'fat'] as const).map(field => (
                      <div key={field}>
                        <label className="block text-[10px] text-gray-400">
                          {field === 'calories' ? 'kcal' : field === 'protein' ? 'P' : field === 'carbs' ? 'C' : 'F'}
                        </label>
                        <input
                          type="number"
                          value={item[field]}
                          onChange={e => updateItem(idx, field, e.target.value)}
                          className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs bg-white text-center"
                        />
                      </div>
                    ))}
                  </div>
                  {/* Divide buttons */}
                  <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                    <span className="text-[10px] text-gray-400 mr-0.5">{t('log.divideLabel')}</span>
                    {[2, 3, 4].map(d => (
                      <button
                        key={d}
                        onClick={() => divideItem(idx, d)}
                        className="text-xs px-2 py-1 bg-orange-50 text-orange-600 rounded-md border border-orange-200 hover:bg-orange-100 active:bg-orange-200 transition-colors font-semibold"
                      >
                        ÷{d}
                      </button>
                    ))}
                    <button
                      onClick={() => handleOneServing(idx)}
                      className={`text-xs px-2 py-1 rounded-md border font-semibold transition-colors ${
                        servingPrompt === idx
                          ? 'bg-green-100 text-green-700 border-green-300'
                          : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100 active:bg-green-200'
                      }`}
                    >
                      {t('log.oneServing')}
                    </button>
                    {originalItems && (
                      <button
                        onClick={undoDivide}
                        className="text-xs px-2 py-1 bg-gray-50 text-gray-600 rounded-md border border-gray-300 hover:bg-gray-100 active:bg-gray-200 transition-colors font-semibold"
                      >
                        {t('log.undoDivide')}
                      </button>
                    )}
                  </div>
                  {servingPrompt === idx && (
                    <div className="flex items-center gap-2 bg-green-50 rounded-md p-2 flex-wrap">
                      <span className="text-xs text-green-700 whitespace-nowrap">{t('log.howManyPeople')}</span>
                      <div className="flex gap-1 flex-wrap">
                        {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                          <button
                            key={n}
                            onClick={() => { divideItem(idx, n); setServingPrompt(null); }}
                            className="text-xs px-2 py-1 bg-white text-green-700 rounded border border-green-300 hover:bg-green-100 active:bg-green-200 transition-colors font-semibold"
                          >
                            {n}{t('log.peopleSuffix')}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <button
                onClick={handleRecalc}
                className="w-full py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
              >
                {t('log.recalculate')}
              </button>
            </div>
          )}
        </div>
      )}

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
          disabled={(!description.trim() && photos.length === 0) || saving}
          className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? t('common.loading') : saved ? t('log.saved') : t('log.save')}
        </button>
      </div>
    </div>
  );
}
