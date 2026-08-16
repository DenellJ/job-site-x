import { v } from "convex/values";
import {
  createAccount,
  getAuthSessionId,
  getAuthUserId,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";
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
function requireFullName(value: string) {
  const fullName = value.trim();
  if (!fullName) throw new Error("Full name is required.");
  return fullName;
}

function requireValidPassword(value: string) {
  if (value.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
}

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

/** True when no admin exists yet — i.e. the site still needs first-run setup. */
export const isSetupNeeded = query({
  args: {},
  handler: async (ctx) => {
    const admin = await ctx.db
      .query("profiles")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .first();
    return admin === null;
  },
});

/** All accounts (manager-only) — for the Crew/Users page. */
export const listProfiles = query({
  args: {},
  handler: async (ctx) => {
    await requireManager(ctx);
    const profiles = await ctx.db.query("profiles").take(500);
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
      .order("desc")
      .take(200);
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

export const adminExists = internalQuery({
  args: {},
  handler: async (ctx) => {
    const admin = await ctx.db
      .query("profiles")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .first();
    return admin !== null;
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
export const passwordAccountForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId).eq("provider", "password"))
      .unique();
    return account === null ? null : { providerAccountId: account.providerAccountId };
  },
});

/**
 * First-run bootstrap: create the very first admin account. Only allowed while
 * no admin exists. The client signs in with the same credentials afterward.
 */
export const setupFirstAdmin = action({
  args: {
    email: v.string(),
    password: v.string(),
    fullName: v.string(),
  },
  handler: async (ctx, args) => {
    if (await ctx.runQuery(internal.users.adminExists, {})) {
      throw new Error("An admin account already exists.");
    }
    const fullName = requireFullName(args.fullName);
    requireValidPassword(args.password);
    const { user } = await createAccount(ctx, {
      provider: "password",
      account: { id: args.email, secret: args.password },
      profile: { email: args.email },
    });
    await ctx.runMutation(internal.users.insertProfile, {
      userId: user._id,
      username: fullName,
      fullName,
      role: "admin",
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
 * Seed the admin account `admin@jobsitex.com` / `admin1234`. Idempotent — does
 * nothing if an admin already exists. Run once with:
 *   npx convex run users:seedAdmin '{}'
 */
export const seedAdmin = internalAction({
  args: {},
  handler: async (ctx): Promise<string> => {
    if (await ctx.runQuery(internal.users.adminExists, {})) {
      return "An admin already exists — nothing to seed.";
    }
    const { user } = await createAccount(ctx, {
      provider: "password",
      account: { id: "admin@jobsitex.com", secret: "admin1234" },
      profile: { email: "admin@jobsitex.com" },
    });
    await ctx.runMutation(internal.users.insertProfile, {
      userId: user._id,
      username: "admin",
      fullName: "Administrator",
      role: "admin",
      status: "approved",
      allowedForms: FORM_TYPES,
    });
    return "Seeded admin@jobsitex.com / admin1234";
  },
});

/**
 * Public self-registration: a new user requests an account. Creates a pending
 * personnel profile and notifies the manager(s). The account cannot be used
 * until a manager approves it (status gate in the client + `requireApproved`).
 */
/**
 * Manager-only: provision an account directly (already approved). Uses
 * `createAccount`, which does NOT touch the caller's session — the manager
 * stays signed in.
 */
export const createUser = action({
  args: {
    email: v.string(),
    password: v.string(),
    fullName: v.string(),
    role: roleValidator,
    allowedForms: v.array(formTypeValidator),
  },
  handler: async (ctx, args) => {
    const callerId = await getAuthUserId(ctx);
    if (callerId === null) throw new Error("Not authenticated.");
    const callerRole = await ctx.runQuery(internal.users.profileRole, {
      userId: callerId,
    });
    const isStaff = callerRole === "manager" || callerRole === "admin";
    if (!isStaff) throw new Error("Managers only.");
    if (args.role !== "personnel" && callerRole !== "admin") {
      throw new Error("Only an admin can create manager accounts.");
    }

    const fullName = requireFullName(args.fullName);
    requireValidPassword(args.password);
    const { user } = await createAccount(ctx, {
      provider: "password",
      account: { id: args.email, secret: args.password },
      profile: { email: args.email },
    });
    await ctx.runMutation(internal.users.insertProfile, {
      userId: user._id,
      username: fullName,
      fullName,
      role: args.role,
      status: "approved",
      allowedForms: args.role === "personnel" ? args.allowedForms : FORM_TYPES,
    });
    return user._id;
  },
});

/** Staff-only: change the signed-in user's password after verifying the current password. */
export const changeOwnPassword = action({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated.");
    const role = await ctx.runQuery(internal.users.profileRole, { userId });
    if (role !== "manager" && role !== "admin") throw new Error("Managers only.");
    requireValidPassword(args.newPassword);

    const account = await ctx.runQuery(internal.users.passwordAccountForUser, { userId });
    if (account === null) throw new Error("Password account not found.");

    const verified = await retrieveAccount(ctx, {
      provider: "password",
      account: { id: account.providerAccountId, secret: args.currentPassword },
    });
    if (verified === null || verified.user._id !== userId) {
      throw new Error("Current password is incorrect.");
    }

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: account.providerAccountId, secret: args.newPassword },
    });
    const sessionId = await getAuthSessionId(ctx);
    await invalidateSessions(ctx, {
      userId,
      ...(sessionId === null ? {} : { except: [sessionId] }),
    });
  },
});

/** Staff-only: set a contractor's temporary password and sign them out everywhere. */
export const resetContractorPassword = action({
  args: {
    userId: v.id("users"),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const callerId = await getAuthUserId(ctx);
    if (callerId === null) throw new Error("Not authenticated.");
    const callerRole = await ctx.runQuery(internal.users.profileRole, { userId: callerId });
    if (callerRole !== "manager" && callerRole !== "admin") throw new Error("Managers only.");

    const targetRole = await ctx.runQuery(internal.users.profileRole, { userId: args.userId });
    if (targetRole !== "personnel") throw new Error("Only contractor passwords can be reset.");
    requireValidPassword(args.newPassword);

    const account = await ctx.runQuery(internal.users.passwordAccountForUser, { userId: args.userId });
    if (account === null) throw new Error("Password account not found.");
    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: account.providerAccountId, secret: args.newPassword },
    });
    await invalidateSessions(ctx, { userId: args.userId });
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
/** Staff-only: delete a contractor's access while preserving all work records. */
export const deleteContractor = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireManager(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (profile === null) throw new Error("Account not found.");
    if (profile.role !== "personnel") throw new Error("Only contractor accounts can be deleted.");

    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", args.userId))
      .collect();
    for (const account of accounts) {
      const codes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", account._id))
        .collect();
      for (const code of codes) await ctx.db.delete(code._id);
      await ctx.db.delete(account._id);
    }

    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .collect();
    for (const session of sessions) {
      const refreshTokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const token of refreshTokens) await ctx.db.delete(token._id);
      const verifiers = await ctx.db
        .query("authVerifiers")
        .filter((q) => q.eq(q.field("sessionId"), session._id))
        .collect();
      for (const verifier of verifiers) await ctx.db.delete(verifier._id);
      await ctx.db.delete(session._id);
    }

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const notification of notifications) await ctx.db.delete(notification._id);

    const assignments = await ctx.db.query("formAssignments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId)).take(500);
    for (const assignment of assignments) await ctx.db.delete(assignment._id);

    await ctx.db.delete(profile._id);
    const user = await ctx.db.get(args.userId);
    if (user !== null) await ctx.db.delete(args.userId);
  },
});
