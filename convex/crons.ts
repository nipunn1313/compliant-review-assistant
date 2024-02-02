import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "get latest release PR",
  { seconds: 30 },
  internal.github.refetchLatestReleasePR
);

export default crons;
