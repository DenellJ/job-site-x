import { v } from "convex/values";
import { createAccount, getAuthUserId } from "@convex-dev/auth/server";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getManagerIds, requireManager } from "./helpers";
import { accountStatusValidator, formTypeValidator, roleValidator } from "./validators";
import { FORM_LABELS, FORM_TYPES } from "./formDefs";

/** Current signed-in user's profile (shape used by the client `Profile` type), or null. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (profile === null) return null;
    return {
      id: userId,
      username: profile.username,
      fullName: profile.fullName,
      role: profile.role,
      status: profile.status,
      allowedForms: profile.allowedForms,
    };
  },
});

/** True when no manager exists yet — i.e. the site still needs first-run setup. */
export const isSetupNeeded = query({
  args: {},
  handler: async (ctx) => {
    const manager = await ctx.db
      .query("profiles")
      .withIndex("by_role", (q) => q.eq("role", "manager"))
      .first();
    return manager === null;
  },
});

/** All accounts (manager-only) — for the Crew/Users page. */
export const listProfiles = query({
  args: {},
  handler: async (ctx) => {
    await requireManager(ctx);
    const profiles = await ctx.db.query("profiles").collect();
    return profiles
      .map((p) => ({
        id: p.userId,
        username: p.username,
        fullName: p.fullName,
        role: p.role,
        status: p.status,
        allowedForms: p.allowedForms,
        createdAt: p._creationTime,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Pending account requests (manager-only). */
export const listPendingUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireManager(ctx);
    const pending = await ctx.db
      .query("profiles")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    return pending
      .map((p) => ({
        id: p.userId,
        username: p.username,
        fullName: p.fullName,
        requestedAt: p._creationTime,
      }))
      .sort((a, b) => b.requestedAt - a.requestedAt);
  },
});

// --- Internal helpers used by the account-creating actions below ---

export const insertProfile = internalMutation({
  args: {
    userId: v.id("users"),
    username: v.string(),
    fullName: v.union(v.string(), v.null()),
    role: roleValidator,
    status: accountStatusValidator,
    allowedForms: v.array(formTypeValidator),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("profiles", args);
  },
});

/** Insert a pending personnel profile and notify every manager of the request. */
export const registerProfileAndNotify = internalMutation({
  args: {
    userId: v.id("users"),
    username: v.string(),
    fullName: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("profiles", {
      userId: args.userId,
      username: args.username,
      fullName: args.fullName,
      role: "personnel",
      status: "pending",
      allowedForms: [],
    });
    const managerIds = await getManagerIds(ctx);
    for (const managerId of managerIds) {
      await ctx.db.insert("notifications", {
        userId: managerId,
        message: `New account request from "${args.username}" — review & approve.`,
        href: "/manager/users",
        read: false,
      });
    }
  },
});

export const managerExists = internalQuery({
  args: {},
  handler: async (ctx) => {
    const manager = await ctx.db
      .query("profiles")
      .withIndex("by_role", (q) => q.eq("role", "manager"))
      .first();
    return manager !== null;
  },
});

export const profileRole = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return profile?.role ?? null;
  },
});

/**
 * First-run bootstrap: create the very first manager account. Only allowed while
 * no manager exists. The client signs in with the same credentials afterward.
 */
export const setupFirstManager = action({
  args: {
    email: v.string(),
    password: v.string(),
    username: v.string(),
    fullName: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    if (await ctx.runQuery(internal.users.managerExists, {})) {
      throw new Error("A site manager account already exists.");
    }
    const { user } = await createAccount(ctx, {
      provider: "password",
      account: { id: args.email, secret: args.password },
      profile: { email: args.email },
    });
    await ctx.runMutation(internal.users.insertProfile, {
      userId: user._id,
      username: args.username,
      fullName: args.fullName,
      role: "manager",
      status: "approved",
      allowedForms: FORM_TYPES,
    });
  },
});

/**
 * Dev convenience: seed the manager account `manager@test.com` / `1234`.
 * Idempotent — does nothing if a manager already exists. Run once with:
 *   npx convex run users:seedDevManager '{}'
 */
export const seedDevManager = internalAction({
  args: {},
  handler: async (ctx): Promise<string> => {
    if (await ctx.runQuery(internal.users.managerExists, {})) {
      return "A manager already exists — nothing to seed.";
    }
    const { user } = await createAccount(ctx, {
      provider: "password",
      account: { id: "manager@test.com", secret: "1234" },
      profile: { email: "manager@test.com" },
    });
    await ctx.runMutation(internal.users.insertProfile, {
      userId: user._id,
      username: "manager",
      fullName: "Site Manager",
      role: "manager",
      status: "approved",
      allowedForms: FORM_TYPES,
    });
    return "Seeded manager@test.com / 1234";
  },
});

/**
 * Public self-registration: a new user requests an account. Creates a pending
 * personnel profile and notifies the manager(s). The account cannot be used
 * until a manager approves it (status gate in the client + `requireApproved`).
 */
export const registerRequest = action({
  args: {
    email: v.string(),
    password: v.string(),
    username: v.string(),
    fullName: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const { user } = await createAccount(ctx, {
      provider: "password",
      account: { id: args.email, secret: args.password },
      profile: { email: args.email },
    });
    await ctx.runMutation(internal.users.registerProfileAndNotify, {
      userId: user._id,
      username: args.username,
      fullName: args.fullName,
    });
  },
});

/**
 * Manager-only: provision an account directly (already approved). Uses
 * `createAccount`, which does NOT touch the caller's session — the manager
 * stays signed in.
 */
export const createUser = action({
  args: {
    email: v.string(),
    password: v.string(),
    username: v.string(),
    fullName: v.union(v.string(), v.null()),
    role: roleValidator,
    allowedForms: v.array(formTypeValidator),
  },
  handler: async (ctx, args) => {
    const callerId = await getAuthUserId(ctx);
    if (callerId === null) throw new Error("Not authenticated.");
    const callerRole = await ctx.runQuery(internal.users.profileRole, {
      userId: callerId,
    });
    if (callerRole !== "manager") throw new Error("Managers only.");

    const { user } = await createAccount(ctx, {
      provider: "password",
      account: { id: args.email, secret: args.password },
      profile: { email: args.email },
    });
    await ctx.runMutation(internal.users.insertProfile, {
      userId: user._id,
      username: args.username,
      fullName: args.fullName,
      role: args.role,
      status: "approved",
      allowedForms: args.role === "manager" ? FORM_TYPES : args.allowedForms,
    });
  },
});

/** Manager-only: approve a pending account and grant it form access. */
export const approveUser = mutation({
  args: {
    userId: v.id("users"),
    allowedForms: v.array(formTypeValidator),
  },
  handler: async (ctx, args) => {
    await requireManager(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (profile === null) throw new Error("Account not found.");
    await ctx.db.patch(profile._id, { status: "approved", allowedForms: args.allowedForms });
    const formList = args.allowedForms.map((f) => FORM_LABELS[f]).join(", ") || "no forms yet";
    await ctx.db.insert("notifications", {
      userId: args.userId,
      message: `Your account was approved. You can complete: ${formList}.`,
      href: "/",
      read: false,
    });
  },
});

/** Manager-only: decline a pending account. */
export const declineUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireManager(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (profile === null) throw new Error("Account not found.");
    await ctx.db.patch(profile._id, { status: "declined" });
    await ctx.db.insert("notifications", {
      userId: args.userId,
      message: "Your account request was declined. Please contact your manager.",
      href: null,
      read: false,
    });
  },
});

/** Manager-only: change which forms an existing account may complete. */
export const updateUserForms = mutation({
  args: {
    userId: v.id("users"),
    allowedForms: v.array(formTypeValidator),
  },
  handler: async (ctx, args) => {
    await requireManager(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (profile === null) throw new Error("Account not found.");
    await ctx.db.patch(profile._id, { allowedForms: args.allowedForms });
  },
});
