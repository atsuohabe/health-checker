export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type Language = 'ja' | 'en' | 'zh-TW' | 'es';

export interface Nutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealEntry {
  id: string;
  type: MealType;
  description: string;
  photoBase64?: string;
  nutrition: Nutrition;
  timestamp: string;
}

export interface DailyRecord {
  date: string;
  weight?: number;
  meals: MealEntry[];
}

export interface UserProfile {
  nickname: string;
  language: Language;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  geminiApiKey?: string;
}
