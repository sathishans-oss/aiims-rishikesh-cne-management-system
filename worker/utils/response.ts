import { ApiResponse } from '../types';

export function jsonResponse<T = any>(
  body: ApiResponse<T>,
  status = 200,
  extraHeaders: HeadersInit = {}
): Response {
  const headers = new Headers(extraHeaders);
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), {
    status,
    headers
  });
}

export function successResponse<T = any>(
  data: T,
  status = 200,
  extraHeaders: HeadersInit = {}
): Response {
  return jsonResponse<T>(
    {
      success: true,
      data,
      error: null
    },
    status,
    extraHeaders
  );
}

export function errorResponse(
  code: string,
  message: string,
  status = 400,
  extraHeaders: HeadersInit = {}
): Response {
  return jsonResponse(
    {
      success: false,
      data: null,
      error: {
        code,
        message
      }
    },
    status,
    extraHeaders
  );
}
