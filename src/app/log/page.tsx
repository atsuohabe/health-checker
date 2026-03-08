'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/i18n/context';
import { getDailyRecord, addMeal, updateMeal, deleteMeal, setWeight } from '@/lib/firestore';
import { DailyRecord, MealEntry } from '@/types';
import WeightInput from '@/components/WeightInput';
import MealForm from '@/components/MealForm';
import MealCard from '@/components/MealCard';

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(dateStr: string, delta: number) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}（${'日月火水木金土'[d.getDay()]}）`;
}

export default function LogPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [record, setRecord] = useState<DailyRecord>({ date: selectedDate, meals: [] });
  const [editingMeal, setEditingMeal] = useState<MealEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const isToday = selectedDate === getToday();

  const loadRecord = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const rec = await getDailyRecord(user.uid, selectedDate);
    setRecord(rec);
    setLoading(false);
  }, [user, selectedDate]);

  useEffect(() => { loadRecord(); }, [loadRecord]);

  if (!user) return null;

  const handleSaveWeight = async (w: number) => {
    const updated = await setWeight(user.uid, selectedDate, w);
    setRecord(updated);
  };

  const handleSaveMeal = async (meal: MealEntry) => {
    if (editingMeal) {
      const updated = await updateMeal(user.uid, selectedDate, meal);
      setRecord(updated);
      setEditingMeal(null);
    } else {
      const updated = await addMeal(user.uid, selectedDate, meal);
      setRecord(updated);
    }
  };

  const handleDeleteMeal = async (mealId: string) => {
    if (!confirm(t('log.deleteConfirm'))) return;
    const updated = await deleteMeal(user.uid, selectedDate, mealId);
    setRecord(updated);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="py-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">{t('log.title')}</h1>

      {/* Date Navigation */}
      <div className="flex items-center justify-between bg-white rounded-2xl shadow-sm px-4 py-3">
        <button
          onClick={() => { setEditingMeal(null); setSelectedDate(shiftDate(selectedDate, -1)); }}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
        </button>
        <div className="text-center">
          <span className="font-semibold text-gray-800">{formatDateLabel(selectedDate)}</span>
          {isToday && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Today</span>}
        </div>
        <button
          onClick={() => { setEditingMeal(null); setSelectedDate(shiftDate(selectedDate, 1)); }}
          disabled={isToday}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
        </button>
      </div>

      <WeightInput currentWeight={record.weight} onSave={handleSaveWeight} />

      {editingMeal ? (
        <MealForm
          key={`edit-${editingMeal.id}`}
          editMeal={editingMeal}
          onSave={handleSaveMeal}
          onCancel={() => setEditingMeal(null)}
        />
      ) : (
        <MealForm key="new" onSave={handleSaveMeal} />
      )}

      {/* Today's Meals */}
      {record.meals.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-gray-800">{t('log.todayMeals')}</h2>
          {record.meals.map(meal => (
            <MealCard
              key={meal.id}
              meal={meal}
              onEdit={() => setEditingMeal(meal)}
              onDelete={() => handleDeleteMeal(meal.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
