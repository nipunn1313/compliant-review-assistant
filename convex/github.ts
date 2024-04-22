import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, query } from "./_generated/server";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

export const updateLatestReleasePR = internalAction({
  // Validators for arguments.
  args: {
    user: v.string(),
    latestPrUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const updated = await ctx.runMutation(internal.github.saveLatestReleasePR, {
      latestReleasePRUrl: args.latestPrUrl,
    });

    const msg = `${args.user} asks - Plz review: go/ship`;
    if (updated) {
      await postToVestabuddy(msg);
    } else {
      console.log(`Skipped reposting: ${msg}`);
    }

    return args.latestPrUrl;
  },
});

export const lilVestabuddyTest = internalAction({
  args: { message: v.string() },
  handler: async (_ctx, args) => {
    return await postToVestabuddy(args.message);
  },
});

async function postToVestabuddy(message: string) {
  if (!process.env.VESTABUDDY_KEY) {
    console.log(`No Vestabuddy key found. Would have posted ${message}`);
    return;
  }
  const httpClient = new ConvexHttpClient(
    "https://oceanic-pig-772.convex.cloud"
  );
  const result = await httpClient.mutation(anyApi.board.post, {
    message,
    duration: 60,
    serviceKey: process.env.VESTABUDDY_KEY,
  });
  return result;
}

export const saveLatestReleasePR = internalMutation({
  // Validators for arguments.
  args: { latestReleasePRUrl: v.string() },

  handler: async (ctx, args) => {
    const latest = await ctx.db
      .query("release_prs")
      .withIndex("by_creation_time")
      .order("desc")
      .first();
    if (latest?.url == args.latestReleasePRUrl) {
      return false;
    }
    await ctx.db.insert("release_prs", { url: args.latestReleasePRUrl });
    return true;
  },
});

export const getLatestReleasePR = query({
  args: {},

  handler: async (ctx) => {
    return ctx.db
      .query("release_prs")
      .withIndex("by_creation_time")
      .order("desc")
      .first();
  },
});
