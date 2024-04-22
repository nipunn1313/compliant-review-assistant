import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, query } from "./_generated/server";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { Octokit } from "@octokit/rest";

export const updateLatestReleasePR = internalMutation({
  // Validators for arguments.
  args: {
    requestor: v.string(),
    latestPrUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const latest = await ctx.db
      .query("release_prs")
      .withIndex("by_creation_time")
      .order("desc")
      .first();
    if (latest?.url == args.latestPrUrl) {
      return;
    }
    await ctx.db.insert("release_prs", {
      url: args.latestPrUrl,
      requestor: args.requestor,
    });

    await ctx.scheduler.runAfter(0, internal.github.postToVestabuddy, {
      requestor: args.requestor,
    });
  },
});

export const markApproved = internalMutation({
  args: {
    approver: v.string(),
    prUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const releasePr = await ctx.db
      .query("release_prs")
      .withIndex("byUrl", (q) => q.eq("url", args.prUrl))
      .unique();
    if (!releasePr) return;

    if (releasePr.approver) {
      console.log(
        `PR ${args.prUrl} was already approved by ${releasePr.approver}.
         Too late to mark as approved by ${args.approver}`
      );
      return;
    }

    await ctx.db.patch(releasePr._id, { approver: args.approver });

    await ctx.scheduler.runAfter(0, internal.github.postToVestabuddy, {
      requestor: releasePr.requestor,
      approver: args.approver,
    });
  },
});

export const postToVestabuddy = internalAction({
  args: {
    requestor: v.optional(v.string()),
    approver: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const message = args.approver
      ? `${args.requestor} thanks ${args.approver} for reviewing`
      : `${args.requestor} asks - Plz review: go/ship`;
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

export const backfill = internalAction({
  args: {},
  handler: async (ctx) => {
    for (const row of await ctx.runMutation(internal.github.backfillFetcher)) {
      if (row.requestor) {
        continue;
      }

      const { author, firstApprover } = await fetchPRDetails(row.url);
      await ctx.runMutation(internal.github.backfillWriter, {
        id: row._id,
        author,
        firstApprover,
      });
    }
  },
});

export const backfillFetcher = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("release_prs")
      .withIndex("by_creation_time")
      .order("desc")
      .collect();
  },
});

export const backfillWriter = internalMutation({
  args: {
    id: v.id("release_prs"),
    author: v.string(),
    firstApprover: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.id, {
      requestor: args.author,
      approver: args.firstApprover,
    });
  },
});

async function fetchPRDetails(prUrl: string) {
  const token = process.env.GITHUB_READ_TOKEN;
  const octokit = new Octokit({ auth: token });

  const match = prUrl.match(
    /https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/
  );
  if (!match) {
    throw new Error("Invalid URL");
  }

  const [, owner, repo, pullNumber] = match;

  // Fetch PR details
  const { data: prData } = await octokit.pulls.get({
    owner,
    repo,
    pull_number: +pullNumber,
  });
  const author = prData.user.login;

  // Fetch PR reviews
  const { data: reviews } = await octokit.pulls.listReviews({
    owner,
    repo,
    pull_number: +pullNumber,
  });
  const approvedReviews = reviews.filter(
    (review) => review.state === "APPROVED"
  );
  const firstApprover =
    approvedReviews.length > 0 ? approvedReviews[0].user!.login : undefined;

  return { author, firstApprover };
}
