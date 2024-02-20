
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

export const redirectToLatestPr = httpAction(async (ctx) => {
  const latestPr = await ctx.runQuery(api.github.getLatestReleasePR, {});

  if (latestPr) {
    return Response.redirect(latestPr.url, 302)
  } else {
    return new Response(null, {
      status: 404,
    });
  }
});