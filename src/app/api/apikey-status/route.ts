import { NextResponse } from 'next/server';

export async function GET() {
  const hasServerKey = !!(process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY);
  return NextResponse.json({ hasServerKey });
}
