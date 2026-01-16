/**
 * Client-side environment variable validation
 * Validates NEXT_PUBLIC_* variables that are available in the browser
 */

const requiredClientEnvVars = [
  "NEXT_PUBLIC_CONVEX_URL",
] as const;

const optionalClientEnvVars = [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
] as const;

type RequiredClientEnvVar = typeof requiredClientEnvVars[number];
type OptionalClientEnvVar = typeof optionalClientEnvVars[number];

export function validateClientEnv() {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const key of requiredClientEnvVars) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  // Check optional variables (warn only)
  for (const key of optionalClientEnvVars) {
    if (!process.env[key]) {
      warnings.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        "Please check your .env file or environment configuration."
    );
  }

  if (warnings.length > 0 && process.env.NODE_ENV === "development") {
    console.warn(
      `Optional environment variables not set: ${warnings.join(", ")}`
    );
  }
}

/**
 * Get a client-side environment variable
 */
export function getClientEnv(key: RequiredClientEnvVar): string;
export function getClientEnv(key: OptionalClientEnvVar): string | undefined;
export function getClientEnv(key: string): string | undefined {
  return process.env[key];
}
