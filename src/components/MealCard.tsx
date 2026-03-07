'use client';

import { MealEntry } from '@/types';
import { useTranslation } from '@/i18n/context';

interface Props {
  meal: MealEntry;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function MealCard({ meal, onEdit, onDelete }: Props) {
  const { t } = useTranslation();
  const mealLabel = t(`log.${meal.type}`);

  return (
    <div className="bg-white rounded-xl shadow-sm p-3 flex gap-3">
      {meal.photoBase64 && (
        <img
          src={meal.photoBase64}
          alt={meal.description}
          className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
            {mealLabel}
          </span>
          <span className="text-xs text-gray-400">
            {new Date(meal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p className="text-sm text-gray-700 truncate mt-1">{meal.description}</p>
        <div className="flex gap-3 text-xs text-gray-500 mt-1">
          <span>{meal.nutrition.calories} kcal</span>
          <span>P:{meal.nutrition.protein}g</span>
          <span>C:{meal.nutrition.carbs}g</span>
          <span>F:{meal.nutrition.fat}g</span>
        </div>
      </div>
      {(onEdit || onDelete) && (
        <div className="flex flex-col gap-1 flex-shrink-0">
          {onEdit && (
            <button onClick={onEdit} className="text-xs text-blue-600 hover:underline">
              {t('log.edit')}
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="text-xs text-red-600 hover:underline">
              {t('log.delete')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
