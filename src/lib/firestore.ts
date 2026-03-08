import { doc, getDoc, setDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import { DailyRecord, MealEntry, UserProfile } from '@/types';
import { DEFAULT_TARGET_CALORIES, DEFAULT_TARGET_CARBS, DEFAULT_TARGET_FAT, DEFAULT_TARGET_PROTEIN } from './constants';

const defaultProfile: UserProfile = {
  nickname: '',
  language: 'ja',
  targetCalories: DEFAULT_TARGET_CALORIES,
  targetProtein: DEFAULT_TARGET_PROTEIN,
  targetCarbs: DEFAULT_TARGET_CARBS,
  targetFat: DEFAULT_TARGET_FAT,
};

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(getFirebaseDb(), 'users', uid, 'data', 'profile'));
  if (!snap.exists()) return null;
  return { ...defaultProfile, ...snap.data() } as UserProfile;
}

export async function saveUserProfile(uid: string, profile: Partial<UserProfile>): Promise<void> {
  // Firestore does not accept undefined values - filter them out
  const cleaned = Object.fromEntries(
    Object.entries(profile).filter(([, v]) => v !== undefined)
  );
  await setDoc(doc(getFirebaseDb(), 'users', uid, 'data', 'profile'), cleaned, { merge: true });
}

export async function getDailyRecord(uid: string, date: string): Promise<DailyRecord> {
  const snap = await getDoc(doc(getFirebaseDb(), 'users', uid, 'records', date));
  if (!snap.exists()) return { date, meals: [] };
  return snap.data() as DailyRecord;
}

export async function saveDailyRecord(uid: string, record: DailyRecord): Promise<void> {
  await setDoc(doc(getFirebaseDb(), 'users', uid, 'records', record.date), record);
}

export async function addMeal(uid: string, date: string, meal: MealEntry): Promise<DailyRecord> {
  const record = await getDailyRecord(uid, date);
  record.meals.push(meal);
  await saveDailyRecord(uid, record);
  return record;
}

export async function updateMeal(uid: string, date: string, meal: MealEntry): Promise<DailyRecord> {
  const record = await getDailyRecord(uid, date);
  const idx = record.meals.findIndex(m => m.id === meal.id);
  if (idx >= 0) record.meals[idx] = meal;
  await saveDailyRecord(uid, record);
  return record;
}

export async function deleteMeal(uid: string, date: string, mealId: string): Promise<DailyRecord> {
  const record = await getDailyRecord(uid, date);
  record.meals = record.meals.filter(m => m.id !== mealId);
  await saveDailyRecord(uid, record);
  return record;
}

export async function setWeight(uid: string, date: string, weight: number): Promise<DailyRecord> {
  const record = await getDailyRecord(uid, date);
  record.weight = weight;
  await saveDailyRecord(uid, record);
  return record;
}

export async function getRecordsInRange(uid: string, startDate: string, endDate: string): Promise<DailyRecord[]> {
  const colRef = collection(getFirebaseDb(), 'users', uid, 'records');
  const q = query(colRef, orderBy('date', 'asc'));
  const snap = await getDocs(q);
  const records: DailyRecord[] = [];
  snap.forEach(doc => {
    const data = doc.data() as DailyRecord;
    if (data.date >= startDate && data.date <= endDate) {
      records.push(data);
    }
  });
  return records;
}

export async function getAllRecords(uid: string): Promise<DailyRecord[]> {
  const colRef = collection(getFirebaseDb(), 'users', uid, 'records');
  const snap = await getDocs(colRef);
  const records: DailyRecord[] = [];
  snap.forEach(doc => records.push(doc.data() as DailyRecord));
  return records;
}
