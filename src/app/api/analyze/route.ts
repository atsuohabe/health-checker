import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const PROMPT = `あなたは栄養士のAIアシスタントです。
以下の食事について、各食品ごとの栄養素を推定してください。

以下のJSON形式で回答してください:
{
  "items": [
    {
      "name": "食品名",
      "calories": <数値(kcal)>,
      "protein": <数値(g)>,
      "carbs": <数値(g)>,
      "fat": <数値(g)>
    }
  ],
  "calories": <合計カロリー(kcal)>,
  "protein": <合計タンパク質(g)>,
  "carbs": <合計炭水化物(g)>,
  "fat": <合計脂質(g)>
}`;

// Fallback order: try each model until one succeeds
const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

/** True if the error means the model is overloaded/unavailable (try next model) */
function isModelUnavailable(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('temporarily unavailable') ||
    lower.includes('service unavailable') ||
    lower.includes('503')
  );
}

/** Parse "Please retry in Xs" from Gemini rate-limit error, returns seconds */
function parseRetryAfterSec(msg: string): number | null {
  const m = msg.match(/retry in (\d+(?:\.\d+)?)s/i);
  return m ? Math.ceil(parseFloat(m[1])) : null;
}

/** Extract user-friendly message from Gemini ApiError JSON */
function extractErrorDetail(raw: string): string {
  try {
    const jsonStart = raw.indexOf('{');
    if (jsonStart >= 0) {
      const parsed = JSON.parse(raw.slice(jsonStart));
      if (parsed.error?.message) return parsed.error.message;
    }
  } catch { /* fall through */ }
  return raw;
}

export async function POST(request: NextRequest) {
  const { imageBase64, description } = await request.json();
  const apiKey = request.headers.get('X-Gemini-Key') || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 400 });
  }

  if (!imageBase64 && !description) {
    return NextResponse.json({ error: 'No input provided' }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey });

  const parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [];

  if (imageBase64) {
    const match = imageBase64.match(/^data:(.*?);base64,(.*)$/);
    if (match) {
      parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
    }
  }

  if (description) {
    parts.push({ text: `食事の説明: ${description}` });
  }

  parts.push({ text: PROMPT });

  let lastError = '';

  for (const model of MODELS) {
    try {
      console.log(`Trying model: ${model}`);
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      const text = response.text || '';
      if (!text) {
        console.error(`${model}: empty response`);
        lastError = 'Empty response from model';
        continue; // try next model
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(text);
      } catch (parseErr) {
        console.error(`${model}: JSON parse failed. Raw:`, text, parseErr);
        lastError = 'Failed to parse response';
        continue; // try next model
      }

      const items = (Array.isArray(parsed.items) ? parsed.items : []).map((item: Record<string, unknown>) => ({
        name: String(item.name || ''),
        calories: Number(item.calories) || 0,
        protein: Number(item.protein) || 0,
        carbs: Number(item.carbs) || 0,
        fat: Number(item.fat) || 0,
      }));

      console.log(`Success with model: ${model}`);
      return NextResponse.json({
        calories: Number(parsed.calories) || 0,
        protein: Number(parsed.protein) || 0,
        carbs: Number(parsed.carbs) || 0,
        fat: Number(parsed.fat) || 0,
        items,
      });

    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      console.error(`${model} error:`, raw);
      lastError = raw;

      // Rate limited: return immediately so client can show countdown
      const retryAfterSec = parseRetryAfterSec(raw);
      if (retryAfterSec !== null) {
        return NextResponse.json(
          { error: 'RATE_LIMITED', retryAfter: retryAfterSec },
          { status: 429 }
        );
      }

      // Model overloaded: try next model in the list
      if (isModelUnavailable(raw)) {
        console.log(`${model} unavailable, trying next...`);
        continue;
      }

      // Any other error (auth, invalid request, etc.): return immediately
      return NextResponse.json({ error: extractErrorDetail(raw) }, { status: 500 });
    }
  }

  // All models failed
  return NextResponse.json(
    { error: extractErrorDetail(lastError) || 'All models are currently unavailable. Please try again later.' },
    { status: 503 }
  );
}
