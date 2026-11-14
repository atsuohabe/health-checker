import { MealType } from '@/types';

export const DEFAULT_TARGET_CALORIES = 2000;
export const DEFAULT_TARGET_PROTEIN = 60;
export const DEFAULT_TARGET_CARBS = 250;
export const DEFAULT_TARGET_FAT = 55;

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

// Calories implied by a P/C/F split (protein/carbs = 4 kcal/g, fat = 9 kcal/g).
export function caloriesFromMacros(protein: number, carbs: number, fat: number): number {
  return protein * 4 + carbs * 4 + fat * 9;
}

// Round to `step` and clamp into [min, max] so the value matches a select's option grid.
export function snapToGrid(value: number, step: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value / step) * step));
}
