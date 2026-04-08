import { Nutrition } from '@/types';

export class RateLimitError extends Error {
  retryAfter: number;
  constructor(retryAfter: number) {
    super(`rate_limited`);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter + 1; // +1s buffer
  }
}

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

  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    const retryAfter = typeof body.retryAfter === 'number' ? body.retryAfter : 30;
    throw new RateLimitError(retryAfter);
  }

  if (!res.ok) {
    let errMsg = 'Analysis failed';
    try {
      const body = await res.json();
      if (body.error) errMsg = body.error;
    } catch { /* keep default message */ }
    throw new Error(errMsg);
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
