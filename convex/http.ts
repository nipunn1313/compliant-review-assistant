import { httpRouter } from "convex/server";
import { handleGithubPullRequestWebhook, redirectToLatestPr } from "./redirectToPrs";
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
})

export default http;