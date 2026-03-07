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

export default function LogPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [record, setRecord] = useState<DailyRecord>({ date: getToday(), meals: [] });
  const [editingMeal, setEditingMeal] = useState<MealEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRecord = useCallback(async () => {
    if (!user) return;
    const rec = await getDailyRecord(user.uid, getToday());
    setRecord(rec);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadRecord(); }, [loadRecord]);

  if (!user) return null;

  const handleSaveWeight = async (w: number) => {
    const updated = await setWeight(user.uid, getToday(), w);
    setRecord(updated);
  };

  const handleSaveMeal = async (meal: MealEntry) => {
    if (editingMeal) {
      const updated = await updateMeal(user.uid, getToday(), meal);
      setRecord(updated);
      setEditingMeal(null);
    } else {
      const updated = await addMeal(user.uid, getToday(), meal);
      setRecord(updated);
    }
  };

  const handleDeleteMeal = async (mealId: string) => {
    if (!confirm(t('log.deleteConfirm'))) return;
    const updated = await deleteMeal(user.uid, getToday(), mealId);
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

      <WeightInput currentWeight={record.weight} onSave={handleSaveWeight} />

      {editingMeal ? (
        <MealForm
          editMeal={editingMeal}
          onSave={handleSaveMeal}
          onCancel={() => setEditingMeal(null)}
        />
      ) : (
        <MealForm onSave={handleSaveMeal} />
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
