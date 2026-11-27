// Tells people when something needs attention.
//
// Always: prints the message and adds it to the GitHub run's summary page.
// Email: only if the SMTP_* secrets and an email address are set (see SETUP.md).
// To avoid an email every hour, the same message is re-sent at most once a day;
// that memory is kept in build/state/<section>.json.

import nodemailer from "nodemailer";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const STATE_DIR = new URL("../state/", import.meta.url);
const ONE_DAY = 24 * 60 * 60 * 1000;

async function readState(slug) {
  try { return JSON.parse(await readFile(new URL(`${slug}.json`, STATE_DIR), "utf8")); }
  catch { return {}; }
}
async function writeState(slug, state) {
  await mkdir(STATE_DIR, { recursive: true });
  await writeFile(new URL(`${slug}.json`, STATE_DIR), JSON.stringify(state, null, 2) + "\n");
}

export async function summary(markdown) {
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown + "\n\n");
}

async function sendEmail(to, subject, text) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  const recipients = to.filter(Boolean);
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || recipients.length === 0) {
    console.log("(Email not sent: email settings are not configured.)");
    return false;
  }
  const port = Number(SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  await transport.sendMail({ from: `Shaare Tefila website <${SMTP_USER}>`, to: recipients.join(", "), subject, text });
  return true;
}

/**
 * Report a section's problems (held back) and reminders (published anyway).
 * Sends an email only when the message changed, or once a day while it persists.
 */
export async function notifySection({ slug, section, folderUrl, problems = [], reminders = [], ownerEmail }) {
  const state = await readState(slug);
  if (problems.length === 0 && reminders.length === 0) {
    if (state.notice) { delete state.notice; await writeState(slug, state); }
    return;
  }
  const held = problems.length > 0;
  const lines = [
    held
      ? `The "${section}" section on the website was NOT updated, because of the problem(s) below. The website is still showing the previous version, so nothing is broken.`
      : `The "${section}" section on the website was updated. A few things to know:`,
    "",
    ...(held ? problems : reminders).map((m) => `- ${m}`),
    ...(held && reminders.length ? ["", "Also, for when it updates:", ...reminders.map((m) => `- ${m}`)] : []),
    "",
    `Open the folder: ${folderUrl}`,
    held ? "Once it's fixed, the website updates automatically within the hour." : "",
  ];
  const text = lines.join("\n");
  await summary(`### ${held ? "Held back" : "Published with reminders"}: ${section}\n\n${text}`);

  const hash = createHash("sha256").update(text).digest("hex").slice(0, 16);
  const last = state.notice;
  if (last && last.hash === hash && Date.now() - last.at < ONE_DAY) {
    console.log("(Same message already emailed in the last day; not sending again.)");
    return;
  }
  const subject = held
    ? `Website: "${section}" needs a fix before it can update`
    : `Website: "${section}" was updated (a reminder)`;
  const sent = await sendEmail([ownerEmail, process.env.NOTIFY_TO], subject, text);
  if (sent || !last || last.hash !== hash) {
    state.notice = { hash, at: Date.now() };
    await writeState(slug, state);
  }
}

/** Alert the office that a build or a live check failed. */
export async function notifyFailure(subject, text) {
  await summary(`### ${subject}\n\n${text}`);
  await sendEmail([process.env.NOTIFY_TO], `Website: ${subject}`, text);
}
