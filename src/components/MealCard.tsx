'use client';

import { useState, useEffect } from 'react';
import { MealEntry } from '@/types';
import { useTranslation } from '@/i18n/context';
import { getPhotos } from '@/lib/photo-storage';

interface Props {
  meal: MealEntry;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function MealCard({ meal, onEdit, onDelete }: Props) {
  const { t } = useTranslation();
  const mealLabel = t(`log.${meal.type}`);
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    // Load photos from IndexedDB, fall back to legacy Firestore-stored photos
    const legacyPhotos = meal.photos?.length ? meal.photos : meal.photoBase64 ? [meal.photoBase64] : [];
    if (legacyPhotos.length > 0) {
      setPhotos(legacyPhotos);
    } else {
      getPhotos(meal.id).then(p => {
        if (p.length > 0) setPhotos(p);
      }).catch(() => {});
    }
  }, [meal.id, meal.photos, meal.photoBase64]);

  return (
    <div className="bg-white rounded-xl shadow-sm p-3 flex gap-3">
      {photos.length > 0 && (
        <div className="flex gap-1 flex-shrink-0">
          {photos.map((photo, idx) => (
            <img
              key={idx}
              src={photo}
              alt={meal.description}
              className="w-16 h-16 rounded-lg object-cover"
            />
          ))}
        </div>
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
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs mt-1">
          <span className="text-gray-500">{meal.nutrition.calories} kcal</span>
          <span className="text-red-500">P:{meal.nutrition.protein}g</span>
          <span className="text-yellow-600">C:{meal.nutrition.carbs}g</span>
          <span className="text-green-500">F:{meal.nutrition.fat}g</span>
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
