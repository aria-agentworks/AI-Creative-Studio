import { NextResponse } from 'next/server';

async function parseJSON(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid response: ${text.slice(0, 300)}`);
  }
}

// ==========================================
// PROVIDER 1: Pollinations.ai (FREE, no key)
// ==========================================
async function generatePollinations(payload) {
  const { prompt, width = 1024, height = 1024, model = 'flux' } = payload;
  const encodedPrompt = encodeURIComponent(prompt);
  const seed = payload.seed && payload.seed !== -1 ? `&seed=${payload.seed}` : `&seed=${Math.floor(Math.random() * 999999)}`;
  const nologo = '&nologo=true';
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=${model}${seed}${nologo}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Pollinations error (${response.status})`);
  }

  // Returns the image directly — we return the URL itself
  const imageUrl = url;
  return { imageUrl, seed: payload.seed || 0 };
}

// ==========================================
// PROVIDER 2: Together AI (FREE FLUX.1-schnell)
// ==========================================
async function generateTogether(payload, apiKey) {
  if (!apiKey) throw new Error('Together AI key required. Add it in Settings.');

  const w = payload.width || 1024;
  const h = payload.height || 1024;

  const response = await fetch('https://api.together.xyz/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: payload.model_id || 'black-forest-labs/FLUX.1-schnell',
      prompt: payload.prompt,
      n: 1,
      width: w,
      height: h,
      steps: payload.steps || 4,
    }),
  });

  if (!response.ok) {
    let msg = `Together AI error (${response.status})`;
    try { const d = await parseJSON(response); msg = d.error?.message || d.error || msg; } catch {}
    throw new Error(msg);
  }

  const data = await parseJSON(response);
  const imageUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json;
  if (!imageUrl) throw new Error('No image returned from Together AI');
  return { imageUrl, seed: data.data?.[0]?.seed || 0 };
}

// ==========================================
// PROVIDER 3: Hugging Face (FREE inference)
// ==========================================
async function generateHuggingFace(payload, apiKey) {
  if (!apiKey) throw new Error('Hugging Face token required. Add it in Settings.');

  const modelId = payload.model_id || 'black-forest-labs/FLUX.1-schnell';
  const response = await fetch(`https://router.huggingface.co/hf-inference/models/${modelId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: payload.prompt,
      parameters: {
        width: payload.width || 1024,
        height: payload.height || 1024,
        num_inference_steps: payload.steps || 4,
        seed: payload.seed && payload.seed !== -1 ? payload.seed : undefined,
      },
    }),
  });

  if (response.status === 503) {
    const data = await parseJSON(response);
    const estTime = data.estimated_time || 30;
    throw new Error(`Model is loading. Please try again in ~${Math.ceil(estTime)} seconds.`);
  }

  if (!response.ok) {
    let msg = `Hugging Face error (${response.status})`;
    try { const d = await parseJSON(response); msg = d.error || msg; } catch {}
    throw new Error(msg);
  }

  // HF returns raw image bytes, not JSON
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('image')) {
    const blob = await response.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());
    const base64 = `data:${contentType};base64,${buffer.toString('base64')}`;
    return { imageUrl: base64, seed: payload.seed || 0 };
  }

  // Some models return JSON with URL
  try {
    const data = await parseJSON(response);
    if (data[0]?.image) return { imageUrl: data[0].image, seed: 0 };
    if (data.images?.[0]?.url) return { imageUrl: data.images[0].url, seed: 0 };
  } catch {}

  throw new Error('Unexpected response format from Hugging Face');
}

// ==========================================
// PROVIDER 4: Google Gemini (FREE image gen)
// ==========================================
async function generateGemini(payload, apiKey) {
  if (!apiKey) throw new Error('Google Gemini key required. Add it in Settings.');

  const model = payload.model_id || 'gemini-2.0-flash-image-generation';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Build requestParts — include reference image if provided
  const requestParts = [];
  if (payload.image) {
    const matches = payload.image.match(/^data:(.+?);base64,/);
    const mimeType = matches ? matches[1] : 'image/jpeg';
    const base64Data = payload.image.replace(/^data:.+?;base64,/, '');
    requestParts.push({ inlineData: { mimeType, data: base64Data } });
    requestParts.push({ text: `Based on this reference image, generate: ${payload.prompt}` });
  } else {
    requestParts.push({ text: `Generate an image: ${payload.prompt}` });
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: requestParts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    }),
  });

  if (!response.ok) {
    let msg = `Gemini error (${response.status})`;
    try {
      const d = await parseJSON(response);
      msg = d.error?.message || msg;
    } catch {}
    throw new Error(msg);
  }

  const data = await parseJSON(response);
  const parts = data.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData) {
      const imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      return { imageUrl, seed: 0 };
    }
  }
  throw new Error('No image in Gemini response');
}

// ==========================================
// PROVIDER 5: Hugging Face VIDEO (free inference)
// ==========================================
async function generateHuggingFaceVideo(payload, apiKey) {
  if (!apiKey) throw new Error('Hugging Face token required. Add it in Settings.');

  const modelId = payload.model_id;
  const response = await fetch(`https://router.huggingface.co/hf-inference/models/${modelId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload.request_body || { inputs: payload.prompt }),
  });

  if (response.status === 503) {
    const data = await parseJSON(response);
    const estTime = data.estimated_time || 60;
    throw new Error(`Model is loading (cold start). Please try again in ~${Math.ceil(estTime)} seconds.`);
  }

  if (!response.ok) {
    let msg = `Hugging Face Video error (${response.status})`;
    try { const d = await parseJSON(response); msg = d.error || msg; } catch {}
    throw new Error(msg);
  }

  // HF returns raw video bytes for video models
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('video') || contentType.includes('octet-stream')) {
    const blob = await response.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());
    const base64 = `data:video/mp4;base64,${buffer.toString('base64')}`;
    return { videoUrl: base64 };
  }

  // Some models may return JSON with a URL
  try {
    const data = await parseJSON(response);
    if (data[0]?.url) return { videoUrl: data[0].url };
    if (data.video?.url) return { videoUrl: data.video.url };
    if (data.output?.url) return { videoUrl: data.output.url };
    if (typeof data[0] === 'string' && data[0].startsWith('http')) return { videoUrl: data[0] };
  } catch {}

  throw new Error('Unexpected response from Hugging Face video model');
}

// ==========================================
// PROVIDER 6: fal.ai (paid, existing logic)
// ==========================================
const FAL_BASE = 'https://queue.fal.run';

async function generateFal(payload, apiKey) {
  if (!apiKey) throw new Error('fal.ai key required. Add it in Settings.');

  const { endpoint, image, ...rest } = payload;
  const falPayload = { ...rest };
  // Add reference image if provided (image_url for img2img/editing)
  if (image) falPayload.image_url = image;

  // Try direct (sync) first
  try {
    const directRes = await fetch(`https://fal.run/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${apiKey}`,
      },
      body: JSON.stringify(falPayload),
    });
    if (directRes.ok) {
      const data = await parseJSON(directRes);
      if (data.images?.[0]?.url) return { imageUrl: data.images[0].url, seed: data.seed };
      if (data.video?.url) return { videoUrl: data.video.url, seed: data.seed };
    }
  } catch (e) {
    console.log(`[fal.ai] Direct failed: ${e.message}`);
  }

  // Fall back to queue
  const queueRes = await fetch(`${FAL_BASE}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${apiKey}`,
    },
    body: JSON.stringify(falPayload),
  });

  if (!queueRes.ok) {
    let msg = `fal.ai error (${queueRes.status})`;
    try { const d = await parseJSON(queueRes); msg = d.detail || d.error || msg; } catch {}
    throw new Error(msg);
  }

  const submitData = await parseJSON(queueRes);
  const requestId = submitData.request_id || submitData.id;

  if (!requestId) {
    if (submitData.images?.[0]?.url) return { imageUrl: submitData.images[0].url };
    if (submitData.video?.url) return { videoUrl: submitData.video.url };
    throw new Error('No request ID from fal.ai queue');
  }

  return { requestId, endpoint };
}

// ==========================================
// MAIN ROUTE HANDLER
// ==========================================
export async function POST(request) {
  try {
    const body = await request.json();
    const { provider, payload, apiKeys } = body;

    if (!provider || !payload) {
      return NextResponse.json({ error: 'Missing provider or payload' }, { status: 400 });
    }

    console.log(`[${provider}] Generating: ${payload.prompt?.slice(0, 50)}...`);

    let result;

    switch (provider) {
      case 'pollinations':
        result = await generatePollinations(payload);
        break;

      case 'together':
        result = await generateTogether(payload, apiKeys?.together || process.env.TOGETHER_API_KEY);
        break;

      case 'huggingface':
        result = await generateHuggingFace(payload, apiKeys?.huggingface || process.env.HF_API_KEY);
        break;

      case 'gemini':
        result = await generateGemini(payload, apiKeys?.gemini || process.env.GEMINI_API_KEY);
        break;

      case 'huggingface_video':
        result = await generateHuggingFaceVideo(payload, apiKeys?.huggingface || process.env.HF_API_KEY);
        break;

      case 'fal':
        result = await generateFal(payload, apiKeys?.fal || process.env.FAL_API_KEY);
        break;

      default:
        return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error(`[generate] Error: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/generate — Poll for fal.ai queue results
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');
    const requestId = searchParams.get('requestId');
    const apiKey = searchParams.get('apiKey') || process.env.FAL_API_KEY;

    if (!endpoint || !requestId) {
      return NextResponse.json({ error: 'Missing endpoint or requestId' }, { status: 400 });
    }
    if (!apiKey) {
      return NextResponse.json({ error: 'fal.ai API key required' }, { status: 401 });
    }

    const statusRes = await fetch(`${FAL_BASE}/${endpoint}/requests/${requestId}/status`, {
      headers: { 'Authorization': `Key ${apiKey}` },
    });

    if (!statusRes.ok) throw new Error(`Status check failed (${statusRes.status})`);
    const statusData = await parseJSON(statusRes);

    if (statusData.status === 'COMPLETED') {
      const resultRes = await fetch(`${FAL_BASE}/${endpoint}/requests/${requestId}`, {
        headers: { 'Authorization': `Key ${apiKey}` },
      });
      const result = await parseJSON(resultRes);
      return NextResponse.json({
        status: 'COMPLETED',
        imageUrl: result.images?.[0]?.url || null,
        videoUrl: result.video?.url || null,
        seed: result.seed,
      });
    }

    if (statusData.status === 'FAILED') {
      let errorMsg = 'Generation failed';
      try {
        const r = await fetch(`${FAL_BASE}/${endpoint}/requests/${requestId}`, {
          headers: { 'Authorization': `Key ${apiKey}` },
        });
        const d = await parseJSON(r);
        errorMsg = d.error || errorMsg;
      } catch {}
      return NextResponse.json({ status: 'FAILED', error: errorMsg });
    }

    return NextResponse.json({ status: statusData.status });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
