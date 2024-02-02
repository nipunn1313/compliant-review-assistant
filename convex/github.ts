import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, query } from "./_generated/server";
import { Octokit } from "@octokit/rest";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

export const refetchLatestReleasePR = internalAction({
  // Validators for arguments.
  args: {},

  handler: async (ctx) => {
    const latestPR = await findLatestPRMergingMainIntoRelease();
    const latestReleasePRUrl = latestPR.html_url;
    const updated = await ctx.runMutation(internal.github.saveLatestReleasePR, {
      latestReleasePRUrl,
    });

    if (updated) {
      await postToVestabuddy(`Plz Review: ${latestReleasePRUrl}`);
    }

    return latestPR.html_url;
  },
});

export const lilVestabuddyTest = internalAction({
  args: { message: v.string() },
  handler: async (_ctx, args) => {
    return await postToVestabuddy(args.message);
  },
});

async function postToVestabuddy(message: string) {
  const httpClient = new ConvexHttpClient(
    "https://oceanic-pig-772.convex.cloud"
  );
  const result = await httpClient.action(anyApi.board.post, {
    message,
    duration: 60,
    serviceAcctKey: process.env.VESTABUDDY_KEY,
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

const token = process.env.GITHUB_READ_TOKEN;
const repoOwner = "get-convex";
const repoName = "convex";

async function findLatestPRMergingMainIntoRelease() {
  const octokit = new Octokit({ auth: token });

  const { data: pullRequests } = await octokit.rest.pulls.list({
    owner: repoOwner,
    repo: repoName,
    base: "release",
    head: `${repoOwner}:main`,
  });

  if (pullRequests.length === 0) {
    throw new Error("No pull requests found.");
  }

  const latestPR = pullRequests[0];
  return latestPR;
}
