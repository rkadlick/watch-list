/**
 * Server-side environment variable validation
 * Validates all environment variables (including server-only ones)
 * This should be called at app startup
 */

const requiredServerEnvVars = [
  "NEXT_PUBLIC_CONVEX_URL",
  "CLERK_JWT_ISSUER_DOMAIN",
  "TMDB_API_KEY",
] as const;

const optionalServerEnvVars = [
  "CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
] as const;

export function validateServerEnv() {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const key of requiredServerEnvVars) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  // Check optional variables (warn only)
  for (const key of optionalServerEnvVars) {
    if (!process.env[key]) {
      warnings.push(key);
    }
  }

  if (missing.length > 0) {
    const error = new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        "Please check your .env file or environment configuration.\n" +
        "See .env.example for required variables."
    );
    console.error(error.message);
    throw error;
  }

  if (warnings.length > 0) {
    console.warn(
      `Optional environment variables not set: ${warnings.join(", ")}`
    );
  }
}
