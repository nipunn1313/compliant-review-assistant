import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

export const redirectToLatestPr = httpAction(async (ctx) => {
  const latestPr = await ctx.runQuery(api.github.getLatestReleasePR, {});

  if (latestPr) {
    return Response.redirect(latestPr.url, 302);
  } else {
    return new Response(null, {
      status: 404,
    });
  }
});

export const handleGithubPullRequestWebhook = httpAction(
  async ({ scheduler }, request) => {
    console.log("Got request", request);
    const payload = await request.text();

    const signingSecret = process.env.GITHUB_CREATE_WEBHOOK_SECRET;
    if (!signingSecret) {
      throw Error("Missing github create webhook signing secret");
    }
    const headerSignatureWithPrefix = request.headers.get(
      "X-Hub-Signature-256"
    );
    if (!headerSignatureWithPrefix) {
      throw Error("Missing signature in header");
    }
    // "sha256=xyz" => "xyz";
    const calculatedSignature = await hmacSha256(signingSecret, payload);
    if (headerSignatureWithPrefix !== `sha256=${calculatedSignature}`) {
      throw Error("Mismatched signatures!");
    }

    const githubEvent = request.headers.get("x-github-event");
    if (!githubEvent) {
      throw Error("Missing event!");
    }
    if (githubEvent === "ping" || githubEvent === "push") {
      return new Response(null, {
        status: 200,
      });
    } else if (githubEvent === "pull_request") {
      const json = JSON.parse(payload);
      if (
        json.action === "opened" &&
        json.pull_request.base.label === "get-convex:release" &&
        json.pull_request.head.label === "get-convex:main" &&
        json.pull_request.user?.login
      ) {
        await scheduler.runAfter(0, internal.github.updateLatestReleasePR, {
          user: json.pull_request.user.login,
          latestPrUrl: json.pull_request.html_url,
        });
      } else {
        console.log("Ignoring unrecognized PR", json);
      }
      return new Response(null, {
        status: 200,
      });
    } else {
      console.error(`Unrecognized github event: ${githubEvent}`);
      return new Response(null, {
        status: 200,
      });
    }
  }
);

async function hmacSha256(key: string, content: string) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    {
      name: "HMAC",
      hash: { name: "SHA-256" },
    },
    false,
    ["sign", "verify"]
  );
  const digest = await crypto.subtle.sign(
    {
      name: "HMAC",
      hash: { name: "SHA-256" },
    },
    cryptoKey,
    enc.encode(content)
  );
  const digestBytes = new Uint8Array(digest);
  // Use prototype.map so that we can change the type from number -> string.
  return Array.prototype.map
    .call(digestBytes, (x) => x.toString(16).padStart(2, "0"))
    .join("");
}

