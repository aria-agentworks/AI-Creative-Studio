import { NextResponse } from 'next/server';

const FAL_BASE = 'https://queue.fal.run';

function getClientKey(request, providedKey) {
  if (providedKey) return providedKey;
  return process.env.FAL_API_KEY || '';
}

async function parseJSON(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response from API: ${text.slice(0, 200)}`);
  }
}

async function submitToQueue(endpoint, payload, apiKey) {
  const url = `${FAL_BASE}/${endpoint}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorMsg = `API error (${response.status})`;
    try {
      const errData = await parseJSON(response);
      errorMsg = errData.detail || errData.error || errData.message || errorMsg;
    } catch {
      try { errorMsg = await response.text(); } catch {}
    }
    throw new Error(errorMsg);
  }

  return await parseJSON(response);
}

async function getResult(endpoint, requestId, apiKey) {
  const url = `${FAL_BASE}/${endpoint}/requests/${requestId}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Key ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch result (${response.status})`);
  }

  return await parseJSON(response);
}

async function getStatus(endpoint, requestId, apiKey) {
  const url = `${FAL_BASE}/${endpoint}/requests/${requestId}/status`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Key ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch status (${response.status})`);
  }

  return await parseJSON(response);
}

// Try direct (sync) endpoint first, fall back to queue
async function tryDirect(endpoint, payload, apiKey) {
  try {
    const url = `https://fal.run/${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) return null;
    return await parseJSON(response);
  } catch (error) {
    console.log(`[fal.ai] Direct attempt failed: ${error.message}`);
    return null;
  }
}

// POST /api/generate — Submit generation request
export async function POST(request) {
  try {
    const body = await request.json();
    const { endpoint, payload, apiKey } = body;

    if (!endpoint || !payload) {
      return NextResponse.json({ error: 'Missing endpoint or payload' }, { status: 400 });
    }

    const clientKey = getClientKey(request, apiKey);
    if (!clientKey) {
      return NextResponse.json({ error: 'API key required. Set it in settings.' }, { status: 401 });
    }

    console.log(`[fal.ai] Submitting to: ${endpoint}`);

    // Try direct (sync) first for fast image models
    const directResult = await tryDirect(endpoint, payload, clientKey);

    if (directResult) {
      // Direct result — extract image or video URL
      if (directResult.images && directResult.images.length > 0) {
        console.log(`[fal.ai] Direct result: got ${directResult.images.length} image(s)`);
        return NextResponse.json({ imageUrl: directResult.images[0].url, seed: directResult.seed });
      }
      if (directResult.video && directResult.video.url) {
        console.log(`[fal.ai] Direct result: got video`);
        return NextResponse.json({ videoUrl: directResult.video.url, seed: directResult.seed });
      }
    }

    // Fall back to queue (async) mode
    const submitData = await submitToQueue(endpoint, payload, clientKey);
    const requestId = submitData.request_id || submitData.id;

    if (!requestId) {
      // Maybe it returned a direct result in queue format
      if (submitData.images && submitData.images.length > 0) {
        return NextResponse.json({ imageUrl: submitData.images[0].url });
      }
      if (submitData.video) {
        return NextResponse.json({ videoUrl: submitData.video.url });
      }
      throw new Error('No request ID returned from queue');
    }

    console.log(`[fal.ai] Queued: request_id=${requestId}`);
    return NextResponse.json({ requestId });

  } catch (error) {
    console.error('[fal.ai] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/status — Poll for generation result
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');
    const requestId = searchParams.get('requestId');
    const apiKey = searchParams.get('apiKey');

    if (!endpoint || !requestId) {
      return NextResponse.json({ error: 'Missing endpoint or requestId' }, { status: 400 });
    }

    const clientKey = getClientKey(request, apiKey);
    if (!clientKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 401 });
    }

    // Check status first
    const statusData = await getStatus(endpoint, requestId, clientKey);
    const status = statusData.status;

    if (status === 'COMPLETED') {
      // Fetch the actual result
      const result = await getResult(endpoint, requestId, clientKey);

      const imageUrl = result.images?.[0]?.url || null;
      const videoUrl = result.video?.url || null;

      return NextResponse.json({
        status: 'COMPLETED',
        imageUrl,
        videoUrl,
        seed: result.seed,
      });
    }

    if (status === 'FAILED') {
      // Fetch the error details from the result
      let errorMsg = 'Generation failed';
      try {
        const result = await getResult(endpoint, requestId, clientKey);
        errorMsg = result.error || result.detail || errorMsg;
      } catch {
        // If we can't get the result, just use the default message
      }
      return NextResponse.json({
        status: 'FAILED',
        error: errorMsg,
      });
    }

    return NextResponse.json({ status });

  } catch (error) {
    console.error('[fal.ai] Status error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
