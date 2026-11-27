// Read-only access to a Google Drive folder.
//
// In GitHub, the workflow signs in to Google with Workload Identity Federation
// (no key file) and passes a short-lived, read-only Drive token in
// GOOGLE_ACCESS_TOKEN. The token acts as the "website-builder" service account,
// so the Drive folder must be shared with that account's email (Viewer is enough).
// A service account key in GOOGLE_SERVICE_ACCOUNT_KEY still works as a fallback.
//
// For testing on a computer without Google access, set LOCAL_DRIVE_DIR to a
// normal folder and the same code reads files from there instead.

import { google } from "googleapis";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const LOCAL_DIR = process.env.LOCAL_DRIVE_DIR;

const MIME_BY_EXT = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".heic": "image/heic", ".heif": "image/heif",
  ".gif": "image/gif",
};

let driveClient;
function drive() {
  if (driveClient) return driveClient;
  const token = process.env.GOOGLE_ACCESS_TOKEN;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  let auth;
  if (token) {
    auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token });
  } else if (key) {
    auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(key),
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
  } else {
    throw new Error("the build could not sign in to Google (no access token). Check the GCP_WORKLOAD_IDENTITY_PROVIDER and GCP_SERVICE_ACCOUNT settings in GitHub");
  }
  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}

/** List the files directly inside a folder: [{ id, name, mimeType, version }] */
export async function listFolder(folderId) {
  if (LOCAL_DIR) {
    const names = (await readdir(LOCAL_DIR)).filter((n) => !n.startsWith("."));
    return Promise.all(names.map(async (name) => {
      const full = path.join(LOCAL_DIR, name);
      const s = await stat(full);
      return {
        id: full,
        name,
        mimeType: MIME_BY_EXT[path.extname(name).toLowerCase()] || "application/octet-stream",
        version: `${s.size}-${Math.round(s.mtimeMs)}`,
      };
    }));
  }
  if (!folderId) throw new Error("The Drive folder ID is not set (LIFE_AT_FOLDER_ID).");
  const files = [];
  let pageToken;
  do {
    const res = await drive().files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, md5Checksum, modifiedTime)",
      pageSize: 200,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of res.data.files) {
      files.push({ id: f.id, name: f.name, mimeType: f.mimeType, version: f.md5Checksum || f.modifiedTime });
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return files;
}

/** Download a file's bytes. */
export async function downloadFile(id) {
  if (LOCAL_DIR) return readFile(id);
  const res = await drive().files.get(
    { fileId: id, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  return Buffer.from(res.data);
}

/** A link people can click to open the folder in Google Drive. */
export function folderLink(folderId) {
  return LOCAL_DIR ? LOCAL_DIR : `https://drive.google.com/drive/folders/${folderId}`;
}
