import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const PROMPT = `あなたは栄養士のAIアシスタントです。
以下の食事について、各食品ごとの栄養素を推定してください。

以下のJSON形式のみで回答してください（他のテキストは不要）:
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

export async function POST(request: NextRequest) {
  const { imageBase64, description } = await request.json();
  const apiKey = request.headers.get('X-Gemini-Key') || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 400 });
  }

  try {
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts }],
      config: {
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const text = response.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse response' }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const items = (parsed.items || []).map((item: Record<string, unknown>) => ({
      name: String(item.name || ''),
      calories: Number(item.calories) || 0,
      protein: Number(item.protein) || 0,
      carbs: Number(item.carbs) || 0,
      fat: Number(item.fat) || 0,
    }));

    return NextResponse.json({
      calories: Number(parsed.calories) || 0,
      protein: Number(parsed.protein) || 0,
      carbs: Number(parsed.carbs) || 0,
      fat: Number(parsed.fat) || 0,
      items,
    });
  } catch (e) {
    console.error('Gemini API error:', e);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
