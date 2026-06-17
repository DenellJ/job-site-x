import { mutation } from "./_generated/server";
import { requireProfile } from "./helpers";

/**
 * Issue a short-lived upload URL. The client POSTs the file (photo or signature)
 * directly to it and receives a `storageId` to pass to the relevant mutation.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireProfile(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});
