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

/** Like {@link requireProfile} but requires staff (manager OR admin — admins are
 *  superusers, so every manager-gated function works for them too). */
export async function requireManager(ctx: QueryCtx) {
  const result = await requireProfile(ctx);
  if (result.profile.role !== "manager" && result.profile.role !== "admin") {
    throw new Error("Managers only.");
  }
  return result;
}

/** Like {@link requireProfile} but requires the admin role. */
export async function requireAdmin(ctx: QueryCtx) {
  const result = await requireProfile(ctx);
  if (result.profile.role !== "admin") throw new Error("Admins only.");
  return result;
}

/** All staff (admin + manager) user ids. For routing signup/submission notifications. */
export async function getManagerIds(ctx: QueryCtx): Promise<Array<import("./_generated/dataModel").Id<"users">>> {
  const managers = await ctx.db
    .query("profiles")
    .withIndex("by_role", (q) => q.eq("role", "manager"))
    .collect();
  const admins = await ctx.db
    .query("profiles")
    .withIndex("by_role", (q) => q.eq("role", "admin"))
    .collect();
  return [...managers, ...admins].map((p) => p.userId);
}

/** The primary staff user id for a submission: the oldest manager, else the
 *  oldest admin. Throws only if no staff account exists at all. */
export async function getPrimaryManagerId(ctx: QueryCtx) {
  const manager = await ctx.db
    .query("profiles")
    .withIndex("by_role", (q) => q.eq("role", "manager"))
    .first();
  if (manager !== null) return manager.userId;
  const admin = await ctx.db
    .query("profiles")
    .withIndex("by_role", (q) => q.eq("role", "admin"))
    .first();
  if (admin === null) throw new Error("No staff account exists.");
  return admin.userId;
}
