import { Env } from '../types';
export function withSecurityHeaders(response: Response, env: Env): Response {
  const h=new Headers(response.headers);
  h.set('X-Content-Type-Options','nosniff');
  h.set('Referrer-Policy','strict-origin-when-cross-origin');
  h.set('X-Frame-Options','DENY');
  h.set('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=()');
  h.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  if(env.ENVIRONMENT==='production') h.set('Strict-Transport-Security','max-age=31536000; includeSubDomains');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers:h});
}
