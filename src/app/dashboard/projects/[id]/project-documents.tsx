"use client";

import { useEffect, useState } from "react";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink: string | null;
  webViewLink: string | null;
  size: string | null;
  modifiedTime: string | null;
}

interface ProjectDocumentsProps {
  folderId: string | null;
  projectId: string;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

function formatBytes(bytes: string | null): string {
  if (!bytes) return "";
  const n = parseInt(bytes, 10);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === FOLDER_MIME) {
    return (
      <svg className="h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
      </svg>
    );
  }
  if (mimeType.startsWith("image/")) {
    return (
      <svg className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
      </svg>
    );
  }
  if (mimeType === "application/pdf") {
    return (
      <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    );
  }
  // Generic file
  return (
    <svg className="h-8 w-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function FileCard({ file }: { file: DriveFile }) {
  const isImage = file.mimeType.startsWith("image/");
  const hasThumbnail = isImage && file.thumbnailLink;

  return (
    <a
      href={file.webViewLink ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50/50 transition-colors hover:border-zinc-300 hover:bg-zinc-100/50 dark:border-zinc-800 dark:bg-zinc-800/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
    >
      {/* Thumbnail / Icon area */}
      <div className="flex h-28 items-center justify-center bg-zinc-100 dark:bg-zinc-800">
        {hasThumbnail ? (
          <img
            src={file.thumbnailLink!}
            alt={file.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <FileIcon mimeType={file.mimeType} />
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-0.5 p-2.5">
        <span className="truncate text-sm font-medium text-zinc-900 group-hover:text-green-600 dark:text-white dark:group-hover:text-green-400">
          {file.name}
        </span>
        <div className="flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
          {file.size && file.mimeType !== FOLDER_MIME && (
            <span>{formatBytes(file.size)}</span>
          )}
          {file.mimeType === FOLDER_MIME && <span>Folder</span>}
          {file.modifiedTime && (
            <span>{new Date(file.modifiedTime).toLocaleDateString()}</span>
          )}
        </div>
      </div>
    </a>
  );
}

export function ProjectDocuments({ folderId, projectId }: ProjectDocumentsProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!folderId) return;

    setLoading(true);
    setError(null);

    fetch(`/api/drive/files?folderId=${encodeURIComponent(folderId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch files");
        return res.json();
      })
      .then((data) => setFiles(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [folderId]);

  async function handleCreateFolder() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/drive/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) {
        const data = await res.json();
        const detail = data.details ? ` (${JSON.stringify(data.details)})` : "";
        throw new Error((data.error ?? "Failed to create folder") + detail);
      }
      // Reload the page to pick up the new folder ID
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setCreating(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
          Documents
        </h2>
        {folderId && (
          <a
            href={`https://drive.google.com/drive/folders/${folderId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            Open in Drive
          </a>
        )}
      </div>

      {!folderId && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <svg className="h-10 w-10 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            No Drive folder linked to this project.
          </p>
          <button
            type="button"
            onClick={handleCreateFolder}
            disabled={creating}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Drive folder"}
          </button>
        </div>
      )}

      {folderId && loading && (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-green-500" />
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      )}

      {folderId && !loading && !error && files.length === 0 && (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          No files yet. Upload files to the Drive folder and they will appear here.
        </p>
      )}

      {files.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {files.map((file) => (
            <FileCard key={file.id} file={file} />
          ))}
        </div>
      )}
    </div>
  );
}
