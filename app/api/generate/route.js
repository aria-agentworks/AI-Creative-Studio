import { NextResponse } from 'next/server';

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';

export async function POST(request) {
  try {
    const body = await request.json();
    const { model, prompt, width, height, seed, n } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Get API key from environment variable (set in Vercel dashboard)
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'NVIDIA API key not configured. Please set NVIDIA_API_KEY environment variable.' },
        { status: 500 }
      );
    }

    // NVIDIA NIM uses OpenAI-compatible image generation API
    const size = `${width}x${height}`;

    const payload = {
      model: model,
      prompt: prompt,
      n: n || 1,
      size: size,
    };

    // Only include seed if it's provided and not -1
    if (seed && seed !== -1) {
      payload.seed = seed;
    }

    console.log(`[NVIDIA NIM] Generating image with model: ${model}, size: ${size}`);

    const response = await fetch(`${NVIDIA_BASE}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'NVCF-Function-Id': model,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[NVIDIA NIM] API Error:', response.status, data);
      const errorMsg = data?.detail || data?.error?.message || data?.message || `NVIDIA API error (${response.status})`;
      return NextResponse.json({ error: errorMsg }, { status: response.status });
    }

    // Normalize response - NVIDIA may return data in different formats
    const images = [];

    if (data.data) {
      // OpenAI format: { data: [{ url, b64_json }] }
      for (const item of data.data) {
        if (item.url) {
          images.push({ url: item.url });
        } else if (item.b64_json) {
          images.push({ b64_json: item.b64_json });
        }
      }
    } else if (data.images) {
      // Alternative format
      for (const item of data.images) {
        if (item.url) {
          images.push({ url: item.url });
        } else if (item.base64) {
          images.push({ b64_json: item.base64 });
        }
      }
    }

    if (images.length === 0) {
      console.error('[NVIDIA NIM] No images in response:', JSON.stringify(data).slice(0, 500));
      return NextResponse.json({ error: 'No images were generated. Try a different prompt.' }, { status: 500 });
    }

    console.log(`[NVIDIA NIM] Successfully generated ${images.length} image(s)`);

    return NextResponse.json({
      images,
      seeds: data.seeds || [seed],
    });

  } catch (error) {
    console.error('[NVIDIA NIM] Generation error:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
