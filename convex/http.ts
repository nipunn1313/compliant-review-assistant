import { httpRouter } from "convex/server";
import { redirectToLatestPr } from "./redirectToPrs";
import { handleGithubPullRequestWebhook } from "./webhook";
const http = httpRouter();

http.route({
  path: "/redirectLatest",
  method: "GET",
  handler: redirectToLatestPr,
});

http.route({
  path: "/onPullRequestReview",
  method: "POST",
  handler: handleGithubPullRequestWebhook,
});

export default http;

