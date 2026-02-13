import { google, type drive_v3 } from "googleapis";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink: string | null;
  webViewLink: string | null;
  size: string | null;
  modifiedTime: string | null;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";
const PROJECT_SUBFOLDERS = ["Briefing", "Indoor", "Entregable"];

/**
 * Authenticate with a Service Account and return a Drive client.
 */
function formatPrivateKey(raw: string): string {
  // Handle both escaped \n (from .env files) and real newlines (from Vercel dashboard)
  let key = raw.replace(/\\n/g, "\n");

  // Remove surrounding quotes if present
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).replace(/\\n/g, "\n");
  }

  return key;
}

function getDriveClient(): drive_v3.Drive {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !privateKey) {
    throw new Error("Missing Google Service Account credentials");
  }

  const auth = new google.auth.JWT({
    email,
    key: formatPrivateKey(privateKey),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return google.drive({ version: "v3", auth });
}

/**
 * Create a folder inside a parent on Shared Drive. Returns the new folder ID.
 */
async function createFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string,
): Promise<string> {
  const res = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name,
      mimeType: FOLDER_MIME,
      parents: [parentId],
    },
    fields: "id",
  });
  if (!res.data.id) throw new Error(`Failed to create folder "${name}"`);
  return res.data.id;
}

/**
 * Get or create the client folder inside the root parent.
 * Returns the Drive folder ID for the client.
 */
export async function getOrCreateClientFolder(
  clientName: string,
  parentFolderId: string,
): Promise<string> {
  const drive = getDriveClient();
  return createFolder(drive, clientName, parentFolderId);
}

/**
 * Create the project folder structure inside a client folder:
 *   /{clientFolder}/{projectName}/
 *     ├── Briefing/
 *     ├── Indoor/
 *     └── Entregable/
 *
 * Returns the ID of the project folder.
 */
export async function createProjectFolder(
  projectName: string,
  clientFolderId: string,
): Promise<string> {
  const drive = getDriveClient();

  const projectId = await createFolder(drive, projectName, clientFolderId);

  // Create sub-folders in parallel
  await Promise.all(
    PROJECT_SUBFOLDERS.map((name) =>
      createFolder(drive, name, projectId),
    ),
  );

  return projectId;
}

/**
 * List all files (non-trashed) inside a folder.
 */
export async function listFolderFiles(
  folderId: string,
): Promise<DriveFile[]> {
  const drive = getDriveClient();
  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      q: `'${folderId}' in parents and trashed = false`,
      fields:
        "nextPageToken, files(id, name, mimeType, thumbnailLink, webViewLink, size, modifiedTime)",
      pageSize: 100,
      pageToken,
    });

    for (const f of res.data.files ?? []) {
      files.push({
        id: f.id!,
        name: f.name!,
        mimeType: f.mimeType!,
        thumbnailLink: f.thumbnailLink ?? null,
        webViewLink: f.webViewLink ?? null,
        size: f.size ?? null,
        modifiedTime: f.modifiedTime ?? null,
      });
    }

    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}

/**
 * Find a subfolder by name inside a parent, or create it if missing.
 * Returns the folder ID.
 */
export async function getOrCreateSubfolder(
  parentId: string,
  folderName: string,
): Promise<string> {
  const drive = getDriveClient();

  // Search for existing folder
  const res = await drive.files.list({
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    q: `'${parentId}' in parents and name = '${folderName.replace(/'/g, "\\'")}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
  });

  if (res.data.files && res.data.files.length > 0 && res.data.files[0].id) {
    return res.data.files[0].id;
  }

  return createFolder(drive, folderName, parentId);
}

/**
 * Get a thumbnail/preview URL for a file.
 */
export async function getFilePreviewUrl(
  fileId: string,
): Promise<string | null> {
  const drive = getDriveClient();
  const res = await drive.files.get({
    fileId,
    supportsAllDrives: true,
    fields: "thumbnailLink, webContentLink",
  });

  return res.data.thumbnailLink ?? res.data.webContentLink ?? null;
}
