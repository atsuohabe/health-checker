import { Nutrition } from '@/types';

export async function analyzeFood(
  options: { imageBase64?: string; description?: string },
  apiKey?: string
): Promise<Nutrition & { items?: Array<{ name: string; calories: number; protein: number; carbs: number; fat: number }> }> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-Gemini-Key': apiKey } : {}),
    },
    body: JSON.stringify(options),
  });

  if (!res.ok) {
    throw new Error('Analysis failed');
  }

  return res.json();
}

export function resizeImage(dataUrl: string, maxWidth = 800): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(maxWidth / img.width, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = dataUrl;
  });
}
