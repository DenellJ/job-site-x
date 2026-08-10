import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

/** Unread notifications for the current user, newest first (reactive). */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_read", (q) => q.eq("userId", userId).eq("read", false))
      .order("desc")
      .take(50);
    return notifications
      .map((n) => ({ id: n._id, message: n.message, href: n.href, at: n._creationTime }));
  },
});

/** Mark a notification read (dismiss). */
export const dismiss = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return;
    const notification = await ctx.db.get(notificationId);
    if (notification !== null && notification.userId === userId) {
      await ctx.db.patch(notificationId, { read: true });
    }
  },
});
