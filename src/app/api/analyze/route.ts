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

export async function POST(request: NextRequest) {
  const { imageBase64, description } = await request.json();
  const apiKey = request.headers.get('X-Gemini-Key') || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 400 });
  }

  if (!imageBase64 && !description) {
    return NextResponse.json({ error: 'No input provided' }, { status: 400 });
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
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '';
    if (!text) {
      console.error('Gemini API: empty response');
      return NextResponse.json({ error: 'Empty response from model' }, { status: 500 });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      console.error('Gemini API: JSON parse failed. Raw text:', text, 'Error:', parseErr);
      return NextResponse.json({ error: 'Failed to parse response' }, { status: 500 });
    }

    const items = (Array.isArray(parsed.items) ? parsed.items : []).map((item: Record<string, unknown>) => ({
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
    const raw = e instanceof Error ? e.message : String(e);
    console.error('Gemini API error:', raw);

    // Extract the human-readable message from Gemini API error JSON
    // Format: "got status: NNN. {\"error\":{\"code\":NNN,\"message\":\"...\"}}"
    let detail = raw;
    try {
      const jsonStart = raw.indexOf('{');
      if (jsonStart >= 0) {
        const parsed = JSON.parse(raw.slice(jsonStart));
        if (parsed.error?.message) detail = parsed.error.message;
      }
    } catch { /* keep raw message */ }

    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
