"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { isStlFile as isStlFileCheck, isObjFile, is3DFile } from "@/components/stl-viewer";

const ModelViewer = dynamic(
  () => import("@/components/stl-viewer").then((m) => m.ModelViewer),
  { ssr: false },
);

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink: string | null;
  webViewLink: string | null;
  webContentLink: string | null;
  size: string | null;
  modifiedTime: string | null;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface ProjectDocumentsProps {
  folderId: string | null;
  projectId: string;
}

interface UploadItem {
  name: string;
  status: "uploading" | "done" | "error";
  error?: string;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

function isStlFile(file: DriveFile): boolean {
  return isStlFileCheck(file.mimeType) || isStlFileCheck(file.name);
}

function isPreviewable(file: DriveFile): boolean {
  return (
    file.mimeType.startsWith("image/") ||
    file.mimeType === "application/pdf" ||
    is3DFile(file.mimeType) ||
    is3DFile(file.name)
  );
}

function formatBytes(bytes: string | null): string {
  if (!bytes) return "";
  const n = parseInt(bytes, 10);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Icons ──────────────────────────────────────────────

function FolderIcon() {
  return (
    <svg className="h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  );
}

function StlFileIcon() {
  return (
    <svg className="h-8 w-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
  );
}

function FileIcon({ mimeType, fileName }: { mimeType: string; fileName?: string }) {
  if (mimeType === FOLDER_MIME) return <FolderIcon />;
  if (
    is3DFile(mimeType) ||
    (fileName && is3DFile(fileName))
  ) {
    return <StlFileIcon />;
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
  return (
    <svg className="h-8 w-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

// ── Breadcrumbs ────────────────────────────────────────

function Breadcrumbs({
  items,
  onNavigate,
}: {
  items: BreadcrumbItem[];
  onNavigate: (index: number) => void;
}) {
  return (
    <nav className="flex items-center gap-1 text-sm">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={item.id} className="flex items-center gap-1">
            {i > 0 && (
              <svg className="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            )}
            {isLast ? (
              <span className="font-medium text-zinc-900 dark:text-white">{item.name}</span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(i)}
                className="text-zinc-500 hover:text-green-600 dark:text-zinc-400 dark:hover:text-green-400"
              >
                {item.name}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

// ── File Preview Modal ─────────────────────────────────

function FilePreviewModal({
  file,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  file: DriveFile;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onPrev();
      if (e.key === "ArrowRight" && hasNext) onNext();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  const isImage = file.mimeType.startsWith("image/");
  const isPdf = file.mimeType === "application/pdf";
  const is3D = is3DFile(file.mimeType) || is3DFile(file.name);

  // For images: use a high-res thumbnail (replace s220 with s1600) or webContentLink
  const imageUrl = file.thumbnailLink
    ? file.thumbnailLink.replace(/=s\d+/, "=s1600")
    : file.webContentLink;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 rounded-full bg-zinc-800/80 p-2 text-white hover:bg-zinc-700"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* File name */}
      <div className="absolute top-4 left-4 z-10 max-w-[60%] truncate rounded-lg bg-zinc-800/80 px-3 py-1.5 text-sm font-medium text-white">
        {file.name}
      </div>

      {/* Prev/Next buttons */}
      {hasPrev && (
        <button
          type="button"
          onClick={onPrev}
          className="absolute left-4 z-10 rounded-full bg-zinc-800/80 p-2 text-white hover:bg-zinc-700"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
      )}
      {hasNext && (
        <button
          type="button"
          onClick={onNext}
          className="absolute right-4 z-10 rounded-full bg-zinc-800/80 p-2 text-white hover:bg-zinc-700"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      )}

      {/* Content */}
      <div className="flex max-h-[90vh] max-w-[90vw] items-center justify-center">
        {isImage && imageUrl && (
          <img
            src={imageUrl}
            alt={file.name}
            className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
          />
        )}
        {isPdf && (
          <iframe
            src={`https://drive.google.com/file/d/${file.id}/preview`}
            className="h-[85vh] w-[85vw] max-w-4xl rounded-lg"
            allow="autoplay"
          />
        )}
        {is3D && <ModelViewer url={`/api/drive/download/${file.id}`} fileName={file.name} />}
      </div>
    </div>
  );
}

// ── File Card ──────────────────────────────────────────

function FileCard({
  file,
  onClick,
}: {
  file: DriveFile;
  onClick: () => void;
}) {
  const isImage = file.mimeType.startsWith("image/");
  const hasThumbnail = isImage && file.thumbnailLink;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full cursor-pointer flex-col overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50/50 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-100/50 dark:border-zinc-800 dark:bg-zinc-800/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
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
          <FileIcon mimeType={file.mimeType} fileName={file.name} />
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
          {file.mimeType === FOLDER_MIME && <span>Carpeta</span>}
          {file.modifiedTime && (
            <span>{new Date(file.modifiedTime).toLocaleDateString()}</span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Upload Progress Panel ──────────────────────────────

function UploadProgress({
  uploads,
  onDismiss,
}: {
  uploads: UploadItem[];
  onDismiss: () => void;
}) {
  const allDone = uploads.every((u) => u.status !== "uploading");

  return (
    <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
          {allDone
            ? `${uploads.filter((u) => u.status === "done").length}/${uploads.length} subidos`
            : `Subiendo ${uploads.filter((u) => u.status === "uploading").length} archivo(s)...`}
        </span>
        {allDone && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            Cerrar
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {uploads.map((upload, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            {upload.status === "uploading" && (
              <div className="h-3 w-3 animate-spin rounded-full border border-zinc-300 border-t-green-500" />
            )}
            {upload.status === "done" && (
              <svg className="h-3 w-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            )}
            {upload.status === "error" && (
              <svg className="h-3 w-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span
              className={`truncate ${
                upload.status === "error"
                  ? "text-red-500"
                  : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              {upload.name}
              {upload.error && ` — ${upload.error}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────

export function ProjectDocuments({ folderId, projectId }: ProjectDocumentsProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Navigation state
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const currentFolderId = breadcrumbs.length > 0
    ? breadcrumbs[breadcrumbs.length - 1].id
    : folderId;

  // Preview state
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewableFiles = files.filter((f) => isPreviewable(f));

  // Initialize breadcrumbs when folderId is set
  useEffect(() => {
    if (folderId) {
      setBreadcrumbs([{ id: folderId, name: "Proyecto" }]);
    }
  }, [folderId]);

  // Fetch files when current folder changes
  const fetchFiles = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/drive/files?folderId=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error("Failed to fetch files");
      const data = await res.json();
      setFiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentFolderId) {
      fetchFiles(currentFolderId);
    }
  }, [currentFolderId, fetchFiles]);

  function navigateToFolder(file: DriveFile) {
    setBreadcrumbs((prev) => [...prev, { id: file.id, name: file.name }]);
  }

  function navigateToBreadcrumb(index: number) {
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
  }

  function handleFileClick(file: DriveFile) {
    if (file.mimeType === FOLDER_MIME) {
      navigateToFolder(file);
      return;
    }

    if (isPreviewable(file)) {
      const idx = previewableFiles.findIndex((f) => f.id === file.id);
      setPreviewIndex(idx >= 0 ? idx : null);
      return;
    }

    // Non-previewable: open in Drive
    if (file.webViewLink) {
      window.open(file.webViewLink, "_blank", "noopener,noreferrer");
    }
  }

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
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setCreating(false);
    }
  }

  // ── Upload logic ───────────────────────────────────

  async function uploadFiles(fileList: File[]) {
    if (!currentFolderId || fileList.length === 0) return;

    const newUploads: UploadItem[] = fileList.map((f) => ({
      name: f.name,
      status: "uploading" as const,
    }));
    setUploads(newUploads);

    const results = await Promise.allSettled(
      fileList.map(async (file, i) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folderId", currentFolderId);

        const res = await fetch("/api/drive/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Error al subir");
        }

        setUploads((prev) =>
          prev.map((u, idx) => (idx === i ? { ...u, status: "done" } : u)),
        );
      }),
    );

    // Mark failed uploads
    setUploads((prev) =>
      prev.map((u, i) => {
        if (results[i].status === "rejected") {
          const reason = results[i] as PromiseRejectedResult;
          return {
            ...u,
            status: "error",
            error: reason.reason?.message ?? "Error desconocido",
          };
        }
        return u;
      }),
    );

    // Refresh the file list
    if (currentFolderId) {
      fetchFiles(currentFolderId);
    }
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      uploadFiles(droppedFiles);
    }
  }

  function handleManualUpload() {
    fileInputRef.current?.click();
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files ?? []);
    if (selectedFiles.length > 0) {
      uploadFiles(selectedFiles);
    }
    // Reset so the same file(s) can be selected again
    e.target.value = "";
  }

  // Sort: folders first, then by name
  const sortedFiles = [...files].sort((a, b) => {
    const aFolder = a.mimeType === FOLDER_MIME ? 0 : 1;
    const bFolder = b.mimeType === FOLDER_MIME ? 0 : 1;
    if (aFolder !== bFolder) return aFolder - bFolder;
    return a.name.localeCompare(b.name);
  });

  return (
    <div
      className={`relative rounded-xl border bg-white p-5 transition-colors dark:bg-zinc-900 ${
        isDragging
          ? "border-green-500 bg-green-50/50 dark:border-green-500 dark:bg-green-950/20"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
      onDragEnter={folderId ? handleDragEnter : undefined}
      onDragLeave={folderId ? handleDragLeave : undefined}
      onDragOver={folderId ? handleDragOver : undefined}
      onDrop={folderId ? handleDrop : undefined}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-green-500 bg-green-50/80 dark:bg-green-950/40">
          <div className="flex flex-col items-center gap-2">
            <svg className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              Soltar archivos para subir
            </span>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
          Documentos
        </h2>
        {folderId && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleManualUpload}
              className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-green-600 dark:text-zinc-400 dark:hover:text-green-400"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Subir archivos
            </button>
            <a
              href={`https://drive.google.com/drive/folders/${currentFolderId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-dark dark:text-brand dark:hover:text-brand-dark"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Abrir en Drive
            </a>
          </div>
        )}
      </div>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 1 && (
        <div className="mb-3">
          <Breadcrumbs items={breadcrumbs} onNavigate={navigateToBreadcrumb} />
        </div>
      )}

      {!folderId && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <svg className="h-10 w-10 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            No hay carpeta de Drive vinculada a este proyecto.
          </p>
          <button
            type="button"
            onClick={handleCreateFolder}
            disabled={creating}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {creating ? "Creando..." : "Crear carpeta en Drive"}
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
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <svg className="h-8 w-8 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            Arrastra archivos aquí o usa el botón &quot;Subir archivos&quot;
          </p>
        </div>
      )}

      {sortedFiles.length > 0 && !loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {sortedFiles.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              onClick={() => handleFileClick(file)}
            />
          ))}
        </div>
      )}

      {/* Upload Progress */}
      {uploads.length > 0 && (
        <UploadProgress
          uploads={uploads}
          onDismiss={() => setUploads([])}
        />
      )}

      {/* Preview Modal */}
      {previewIndex !== null && previewableFiles[previewIndex] && (
        <FilePreviewModal
          file={previewableFiles[previewIndex]}
          onClose={() => setPreviewIndex(null)}
          onPrev={() => setPreviewIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() =>
            setPreviewIndex((i) =>
              i !== null && i < previewableFiles.length - 1 ? i + 1 : i,
            )
          }
          hasPrev={previewIndex > 0}
          hasNext={previewIndex < previewableFiles.length - 1}
        />
      )}
    </div>
  );
}
