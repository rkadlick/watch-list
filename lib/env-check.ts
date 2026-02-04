/**
 * Server-side Environment Validation
 *
 * Runs at app startup to ensure all required environment variables
 * are present and correctly set.
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
  // Skip validation during build (Docker sets SKIP_ENV_VALIDATION=true)
  if (process.env.SKIP_ENV_VALIDATION === 'true' || process.env.npm_lifecycle_event === 'build') {
    return;
  }

  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required vars
  for (const key of requiredServerEnvVars) {
    if (!process.env[key]) missing.push(key);
  }

  // Check optional vars (warn only)
  for (const key of optionalServerEnvVars) {
    if (!process.env[key]) warnings.push(key);
  }

  if (missing.length > 0) {
    const message = `
❌ Missing required environment variables:
${missing.map((key) => `  - ${key}`).join("\n")}
  
Please add them to your .env file or environment configuration.
See .env.example for a reference.
`;
    console.error(message.trim());
    throw new Error("Missing required environment variables");
  }

  if (warnings.length > 0 && process.env.NODE_ENV === "development") {
    console.warn(
      `
⚠️  Optional environment variables not set:
${warnings.map((key) => `  - ${key}`).join("\n")}
`
    );
  }
}

// Automatically validate on import (optional)
validateServerEnv();