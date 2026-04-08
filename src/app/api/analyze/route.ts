import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, GenerateContentConfig } from '@google/genai';

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

/**
 * Model fallback list. Each entry has an ordered list of configs to attempt.
 * When a config causes an INVALID_ARGUMENT error, the next config is tried.
 * When a model is overloaded/unavailable, the next model is tried.
 *
 * To add a new model: prepend a new entry to this array.
 * To remove a deprecated model: delete its entry.
 */
const MODELS: Array<{ name: string; configs: GenerateContentConfig[] }> = [
  {
    name: 'gemini-2.5-flash',
    configs: [
      // Full config: JSON mode + disable thinking for clean output
      { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      // Fallback: JSON mode only (if thinkingConfig is rejected)
      { responseMimeType: 'application/json' },
      // Minimal: no special config (if responseMimeType is rejected)
      {},
    ],
  },
  {
    name: 'gemini-2.0-flash',
    configs: [
      { responseMimeType: 'application/json' },
      {},
    ],
  },
  {
    name: 'gemini-1.5-flash',
    configs: [
      { responseMimeType: 'application/json' },
      {},
    ],
  },
];

// ── Error classification ──────────────────────────────────────────────────────

function classifyError(msg: string): 'rate_limit' | 'unavailable' | 'config_invalid' | 'auth' | 'other' {
  const lower = msg.toLowerCase();

  if (/retry in \d+/i.test(msg)) return 'rate_limit';

  if (
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('service unavailable') ||
    lower.includes('temporarily unavailable') ||
    lower.includes('"code":503') ||
    lower.includes('"code": 503')
  ) return 'unavailable';

  if (
    lower.includes('invalid argument') ||
    lower.includes('invalid_argument') ||
    lower.includes('unknown field') ||
    lower.includes('thinkingconfig') ||
    lower.includes('responsemimetype') ||
    lower.includes('unsupported') ||
    lower.includes('"code":400') ||
    lower.includes('"code": 400')
  ) return 'config_invalid';

  if (
    lower.includes('api key') ||
    lower.includes('api_key') ||
    lower.includes('unauthorized') ||
    lower.includes('permission denied') ||
    lower.includes('"code":401') ||
    lower.includes('"code": 401') ||
    lower.includes('"code":403') ||
    lower.includes('"code": 403')
  ) return 'auth';

  return 'other';
}

function parseRetryAfterSec(msg: string): number | null {
  const m = msg.match(/retry in (\d+(?:\.\d+)?)s/i);
  return m ? Math.ceil(parseFloat(m[1])) : null;
}

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

// ── Response parsing ──────────────────────────────────────────────────────────

function parseModelResponse(text: string, usedJsonMode: boolean): Record<string, unknown> | null {
  if (!text) return null;
  try {
    if (usedJsonMode) {
      return JSON.parse(text);
    }
    // No JSON mode: extract first {...} block from free-form text
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch { /* fall through */ }
  return null;
}

// ── Main handler ──────────────────────────────────────────────────────────────

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
    if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
  }
  if (description) parts.push({ text: `食事の説明: ${description}` });
  parts.push({ text: PROMPT });

  let lastError = '';

  for (const { name, configs } of MODELS) {
    let skipModel = false;

    for (const config of configs) {
      if (skipModel) break;

      try {
        console.log(`Trying model=${name} config=${JSON.stringify(config)}`);
        const response = await ai.models.generateContent({
          model: name,
          contents: [{ role: 'user', parts }],
          config,
        });

        const text = response.text || '';
        const usedJsonMode = !!config.responseMimeType;
        const parsed = parseModelResponse(text, usedJsonMode);

        if (!parsed) {
          console.warn(`${name}: unparseable response, trying next config`);
          lastError = 'Failed to parse response';
          continue; // try next config
        }

        const items = (Array.isArray(parsed.items) ? parsed.items : []).map((item: Record<string, unknown>) => ({
          name: String(item.name || ''),
          calories: Number(item.calories) || 0,
          protein: Number(item.protein) || 0,
          carbs: Number(item.carbs) || 0,
          fat: Number(item.fat) || 0,
        }));

        console.log(`Success: model=${name}`);
        return NextResponse.json({
          calories: Number(parsed.calories) || 0,
          protein: Number(parsed.protein) || 0,
          carbs: Number(parsed.carbs) || 0,
          fat: Number(parsed.fat) || 0,
          items,
        });

      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        console.error(`${name} error:`, raw);
        lastError = raw;

        const kind = classifyError(raw);

        if (kind === 'rate_limit') {
          const retryAfterSec = parseRetryAfterSec(raw);
          return NextResponse.json(
            { error: 'RATE_LIMITED', retryAfter: retryAfterSec ?? 30 },
            { status: 429 }
          );
        }

        if (kind === 'unavailable') {
          skipModel = true; // skip remaining configs for this model
          break;
        }

        if (kind === 'auth') {
          return NextResponse.json({ error: extractErrorDetail(raw) }, { status: 401 });
        }

        // config_invalid or other: try next config variant
      }
    }
  }

  // All models and configs exhausted
  return NextResponse.json(
    { error: extractErrorDetail(lastError) || 'All models are currently unavailable. Please try again later.' },
    { status: 503 }
  );
}
