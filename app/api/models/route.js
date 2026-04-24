import { NextResponse } from 'next/server';

export async function GET() {
  // Report which API keys are configured server-side (without exposing values)
  return NextResponse.json({
    serverKeys: {
      huggingface: !!process.env.HF_API_KEY,
      fal: !!process.env.FAL_API_KEY,
      together: !!process.env.TOGETHER_API_KEY,
      gemini: !!process.env.GEMINI_API_KEY,
    },
  });
}
