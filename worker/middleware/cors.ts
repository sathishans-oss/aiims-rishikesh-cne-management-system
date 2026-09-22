import { Env } from '../types';

export function getCorsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers();
  const origin = request.headers.get('Origin');
  if (!origin) return headers;

  // Build allowed origin list
  const allowedList = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
  ];

  if (env.ALLOWED_ORIGIN && env.ALLOWED_ORIGIN !== '*') {
    const configured = env.ALLOWED_ORIGIN.split(',').map(s => s.trim()).filter(Boolean);
    allowedList.push(...configured);
  }

  // Same host origin is always allowed
  try {
    const reqUrl = new URL(request.url);
    allowedList.push(reqUrl.origin);
  } catch {}

  const isAllowed = allowedList.includes(origin);

  if (isAllowed) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Vary', 'Origin');
  }

  return headers;
}

export function handleCorsPreflight(request: Request, env: Env): Response {
  const headers = getCorsHeaders(request, env);
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(null, { status: 204, headers });
}

export function handleCors(request: Request, response: Response, env: Env): Response {
  const corsHeaders = getCorsHeaders(request, env);
  const newHeaders = new Headers(response.headers);
  corsHeaders.forEach((value, key) => {
    newHeaders.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}
