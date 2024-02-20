import { httpRouter } from "convex/server";
import { redirectToLatestPr } from "./redirectToPrs";

const http = httpRouter();

http.route({
  path: "/redirectLatest",
  method: "GET",
  handler: redirectToLatestPr,
});

export default http;