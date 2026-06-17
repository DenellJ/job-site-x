import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx } from "./_generated/server";

/**
 * Resolve the signed-in user + their app profile, or throw.
 * `MutationCtx` is assignable to `QueryCtx`, so this works in queries and mutations.
 */
export async function requireProfile(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated.");
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (profile === null) throw new Error("No profile found for this account.");
  return { userId, profile };
}

/** Like {@link requireProfile} but additionally requires an approved account. */
export async function requireApproved(ctx: QueryCtx) {
  const result = await requireProfile(ctx);
  if (result.profile.status !== "approved") {
    throw new Error("Your account is not approved yet.");
  }
  return result;
}

/** Like {@link requireProfile} but additionally requires the manager role. */
export async function requireManager(ctx: QueryCtx) {
  const result = await requireProfile(ctx);
  if (result.profile.role !== "manager") throw new Error("Managers only.");
  return result;
}

/** All manager user ids (single-tenant: usually one). For routing notifications. */
export async function getManagerIds(ctx: QueryCtx): Promise<Array<import("./_generated/dataModel").Id<"users">>> {
  const managers = await ctx.db
    .query("profiles")
    .withIndex("by_role", (q) => q.eq("role", "manager"))
    .collect();
  return managers.map((m) => m.userId);
}

/** The primary (oldest) manager's user id, or throw if none exists. */
export async function getPrimaryManagerId(ctx: QueryCtx) {
  const manager = await ctx.db
    .query("profiles")
    .withIndex("by_role", (q) => q.eq("role", "manager"))
    .first();
  if (manager === null) throw new Error("No manager account exists.");
  return manager.userId;
}
