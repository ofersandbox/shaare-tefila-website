// Read-only access to a Google Drive folder.
//
// In GitHub, the workflow signs in to Google with Workload Identity Federation
// (no key file) and passes a short-lived, read-only Drive token in
// GOOGLE_ACCESS_TOKEN. The token acts as the "website-builder" service account,
// so the Drive folder must be shared with that account's email (Viewer is enough).
// A service account key in GOOGLE_SERVICE_ACCOUNT_KEY still works as a fallback.
//
// For testing on a computer without Google access, set LOCAL_DRIVE_DIR to a
// normal folder that stands in for the Website folder (with "Life at Shaare
// Tefila", "Gallery", ... inside it) and the same code reads from there.

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

export const FOLDER = "application/vnd.google-apps.folder";

/**
 * List what is directly inside a folder:
 * [{ id, name, mimeType, version, size, created }]  (sub-folders have mimeType FOLDER)
 * On Drive, folderId is the folder's ID. With LOCAL_DRIVE_DIR it is a path.
 */
export async function listFolder(folderId) {
  if (LOCAL_DIR) {
    const dir = folderId || LOCAL_DIR;
    const names = (await readdir(dir)).filter((n) => !n.startsWith("."));
    return Promise.all(names.map(async (name) => {
      const full = path.join(dir, name);
      const s = await stat(full);
      return {
        id: full,
        name,
        mimeType: s.isDirectory() ? FOLDER : (MIME_BY_EXT[path.extname(name).toLowerCase()] || "application/octet-stream"),
        version: `${s.size}-${Math.round(s.mtimeMs)}`,
        size: s.size,
        created: new Date(s.birthtimeMs || s.mtimeMs).toISOString(),
      };
    }));
  }
  if (!folderId) throw new Error("The Drive folder ID is not set.");
  const files = [];
  let pageToken;
  do {
    const res = await drive().files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, md5Checksum, modifiedTime, createdTime, size)",
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of res.data.files) {
      files.push({
        id: f.id, name: f.name, mimeType: f.mimeType,
        version: f.md5Checksum || f.modifiedTime,
        size: Number(f.size || 0), created: f.createdTime,
      });
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return files;
}

/**
 * Find a section's folder. Uses the ID if one was set for that section;
 * otherwise looks for a sub-folder with that name inside the Website folder
 * (WEBSITE_FOLDER_ID). Returns null if there is no such folder.
 */
export async function sectionFolder(name, explicitId) {
  const want = name.trim().toLowerCase();
  if (LOCAL_DIR) {
    const hit = (await listFolder(LOCAL_DIR)).find((f) => f.mimeType === FOLDER && f.name.trim().toLowerCase() === want);
    return hit ? hit.id : null;
  }
  if (explicitId) return explicitId;
  const root = process.env.WEBSITE_FOLDER_ID;
  if (!root) throw new Error(`no folder is set for "${name}". Set the WEBSITE_FOLDER_ID variable in GitHub to the ID of the Website folder in Google Drive`);
  const hit = (await listFolder(root)).find((f) => f.mimeType === FOLDER && f.name.trim().toLowerCase() === want);
  return hit ? hit.id : null;
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
  if (LOCAL_DIR) return folderId || LOCAL_DIR;
  return folderId ? `https://drive.google.com/drive/folders/${folderId}` : "(the Website folder in Google Drive)";
}
