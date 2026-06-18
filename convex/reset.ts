import { internalMutation } from "./_generated/server";

/**
 * DEV/admin utility: wipe all accounts + app data so the app returns to its
 * first-run state (the `/setup` screen). Internal — only runnable via the
 * Convex CLI/dashboard (`npx convex run reset:resetAccounts '{}'`), never by a
 * client. Remove before a real production launch if you don't want it around.
 */
export const resetAccounts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tables = [
      "profiles",
      "notifications",
      "formSubmissions",
      "approvals",
      "authAccounts",
      "authSessions",
      "authRefreshTokens",
      "authVerificationCodes",
      "authVerifiers",
      "authRateLimits",
      "users",
    ];
    let deleted = 0;
    for (const table of tables) {
      const docs = await ctx.db.query(table as any).collect();
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
        deleted++;
      }
    }
    return `Deleted ${deleted} documents across ${tables.length} tables.`;
  },
});
