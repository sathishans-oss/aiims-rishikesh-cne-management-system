import { Env } from '../types';

export function getRequiredSecret(env: Env, key: keyof Env, secretName: string): string {
  const value = env[key];
  if (value && typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (env.ENVIRONMENT === 'production') {
    throw new Error(`CRITICAL_SECURITY_CONFIGURATION_ERROR: Required institutional secret '${secretName}' is not configured in production environment bindings.`);
  }

  // Explicit development fallback only when running in non-production
  console.warn(`[DEV WARNING] Missing environment secret '${secretName}'. Using temporary local development fallback.`);
  return `dev-fallback-${secretName.toLowerCase().replace(/_/g, '-')}`;
}
