import { query } from "./_generated/server";

// Debug query to check authentication
export const checkAuth = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    return {
      authenticated: !!identity,
      identity: identity ? {
        subject: identity.subject,
        issuer: identity.issuer,
        // Don't log the full token for security
      } : null,
    };
  },
});

