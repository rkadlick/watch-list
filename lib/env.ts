/**
 * Environment Variable Validation Utility
 *
 * - validateEnv(): validates both client + server vars
 * - validateClientEnv(): browser-only subset
 * - validateServerEnv(): backend-only subset
 * - getEnv(): safely read any variable
 */

const requiredClientEnvVars = ["NEXT_PUBLIC_CONVEX_URL"] as const;
const optionalClientEnvVars = ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"] as const;

const requiredServerEnvVars = [
  "CONVEX_DEPLOYMENT",
  "CLERK_PUBLISHABLE_KEY",
  "CLERK_JWT_ISSUER_DOMAIN",
  "TMDB_API_KEY",
] as const;
const optionalServerEnvVars = [] as const;

type RequiredClientEnvVar = (typeof requiredClientEnvVars)[number];
type OptionalClientEnvVar = (typeof optionalClientEnvVars)[number];
type RequiredServerEnvVar = (typeof requiredServerEnvVars)[number];
type OptionalServerEnvVar = (typeof optionalServerEnvVars)[number];

export function validateClientEnv() {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const key of requiredClientEnvVars) {
    if (!process.env[key]) missing.push(key);
  }
  for (const key of optionalClientEnvVars) {
    if (!process.env[key]) warnings.push(key);
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required client environment variables: ${missing.join(", ")}`
    );
  }

  if (warnings.length > 0 && process.env.NODE_ENV === "development") {
    console.warn(
      `Optional client environment variables not set: ${warnings.join(", ")}`
    );
  }
}

export function validateServerEnv() {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const key of requiredServerEnvVars) {
    if (!process.env[key]) missing.push(key);
  }
  for (const key of optionalServerEnvVars) {
    if (!process.env[key]) warnings.push(key);
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required server environment variables: ${missing.join(", ")}`
    );
  }

  if (warnings.length > 0 && process.env.NODE_ENV === "development") {
    console.warn(
      `Optional server environment variables not set: ${warnings.join(", ")}`
    );
  }
}

/**
 * Combined validator for convenience (can call from app/layout.tsx)
 */
export function validateEnv() {
  if (typeof window === "undefined") {
    validateServerEnv();
  } else {
    validateClientEnv();
  }
}

/**
 * Safe getter
 */
export function getEnv(key: string): string | undefined {
  return process.env[key];
}