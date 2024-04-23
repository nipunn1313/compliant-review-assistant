import { ConvexHttpClient } from "convex/browser";
import { internalAction } from "./_generated/server";
import { anyApi } from "convex/server";
import { v } from "convex/values";

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
