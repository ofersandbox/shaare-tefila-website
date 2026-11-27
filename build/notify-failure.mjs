// Emails the office when the publish run fails (for example, a Check 2 test).
// Used by the last step of .github/workflows/publish.yml.
import { notifyFailure } from "./lib/notify.mjs";

const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
const runUrl = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;

await notifyFailure(
  "an update was stopped by the automatic checks",
  [
    "The latest website update did not pass its automatic checks, so it was NOT published.",
    "The website is still showing the previous version, so visitors see nothing broken.",
    "",
    `Details (for whoever maintains the site): ${runUrl}`,
  ].join("\n"),
);
