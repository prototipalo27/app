"use client";

import { useState, useRef } from "react";
import {
  toggleChecklistItem,
  uploadNameList,
  toggleNameEntry,
  uploadQcPhoto,
  uploadEntryPhoto,
  removeEntryPhoto,
  type NameEntry,
} from "../checklist-actions";
import EntryCameraMode from "./entry-camera-mode";
import { parseNameListFile } from "@/lib/name-list-parser";

type ChecklistItemData = {
  entries?: NameEntry[];
  photo_path?: string;
  photo_uploaded_at?: string;
};

type ChecklistItem = {
  id: string;
  name: string;
  item_type: string;
  position: number;
  completed: boolean;
  data: ChecklistItemData | null;
};

export default function ProjectChecklist({
  projectId,
  items,
  templateName,
  trackingToken,
}: {
  projectId: string;
  items: ChecklistItem[];
  templateName: string | null;
  trackingToken?: string;
}) {
  const [localItems, setLocalItems] = useState(items);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const entryPhotoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [photoUploadingItemId, setPhotoUploadingItemId] = useState<string | null>(null);
  const [photoBusyItemId, setPhotoBusyItemId] = useState<string | null>(null);
  const [photoLightbox, setPhotoLightbox] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [csvPreview, setCsvPreview] = useState<{
    itemId: string;
    entries: NameEntry[];
  } | null>(null);

  // Foto por entry (cámara nativa por OS, fallback rápido del modo secuencial)
  const [pendingEntryPhoto, setPendingEntryPhoto] = useState<{
    itemId: string;
    entryIndex: number;
  } | null>(null);
  const [entryPhotoBusy, setEntryPhotoBusy] = useState<string | null>(null);
  const [entryLightbox, setEntryLightbox] = useState<{
    itemId: string;
    entryIndex: number;
  } | null>(null);

  // Modo cámara secuencial (estilo escáner facturas)
  const [cameraModeItemId, setCameraModeItemId] = useState<string | null>(null);

  const [linkCopied, setLinkCopied] = useState(false);
  const completedCount = localItems.filter((i) => i.completed).length;
  const hasClientReviewItems = localItems.some(
    (i) =>
      i.item_type === "name_list" ||
      (i.item_type === "photo_qc" && i.data?.photo_path),
  );

  async function handleToggle(itemId: string, completed: boolean) {
    setLocalItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, completed } : i))
    );
    const result = await toggleChecklistItem(itemId, completed);
    if (!result.success) {
      setLocalItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, completed: !completed } : i))
      );
    }
  }

  async function handleNameToggle(
    itemId: string,
    nameIndex: number,
    checked: boolean
  ) {
    // Optimistic update
    setLocalItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        const entries = [...(i.data?.entries ?? [])];
        entries[nameIndex] = { ...entries[nameIndex], checked };
        return { ...i, data: { entries } };
      })
    );
    const result = await toggleNameEntry(itemId, nameIndex, checked);
    if (!result.success) {
      setLocalItems((prev) =>
        prev.map((i) => {
          if (i.id !== itemId) return i;
          const entries = [...(i.data?.entries ?? [])];
          entries[nameIndex] = { ...entries[nameIndex], checked: !checked };
          return { ...i, data: { entries } };
        })
      );
    }
  }

  function handleFileSelect(itemId: string) {
    setUploadingItemId(itemId);
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const itemId = uploadingItemId;
    e.target.value = "";
    if (!file || !itemId) return;

    try {
      const parsed = await parseNameListFile(file);
      if (parsed.length === 0) {
        alert("No se ha detectado ningún nombre en el archivo");
        setUploadingItemId(null);
        return;
      }
      setCsvPreview({ itemId, entries: parsed });
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo leer el archivo");
      setUploadingItemId(null);
    }
  }

  async function confirmUpload() {
    if (!csvPreview) return;
    const result = await uploadNameList(csvPreview.itemId, csvPreview.entries);
    if (result.success) {
      setLocalItems((prev) =>
        prev.map((i) =>
          i.id === csvPreview.itemId
            ? { ...i, data: { ...(i.data ?? {}), entries: csvPreview.entries } }
            : i
        )
      );
    }
    setCsvPreview(null);
    setUploadingItemId(null);
  }

  function handlePhotoSelect(itemId: string) {
    setPhotoUploadingItemId(itemId);
    photoInputRef.current?.click();
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const itemId = photoUploadingItemId;
    e.target.value = "";
    if (!file || !itemId) {
      setPhotoUploadingItemId(null);
      return;
    }
    setPhotoBusyItemId(itemId);
    const fd = new FormData();
    fd.append("photo", file);
    const result = await uploadQcPhoto(itemId, projectId, fd);
    if (result.success && result.photo_path) {
      setLocalItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                data: {
                  ...(i.data ?? {}),
                  photo_path: result.photo_path,
                  photo_uploaded_at: new Date().toISOString(),
                },
              }
            : i,
        ),
      );
    } else if (!result.success) {
      alert(result.error ?? "Error al subir la foto");
    }
    setPhotoBusyItemId(null);
    setPhotoUploadingItemId(null);
  }

  function handleEntryPhotoSelect(itemId: string, entryIndex: number) {
    setPendingEntryPhoto({ itemId, entryIndex });
    entryPhotoInputRef.current?.click();
  }

  async function handleEntryPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const target = pendingEntryPhoto;
    e.target.value = "";
    if (!file || !target) {
      setPendingEntryPhoto(null);
      return;
    }
    const busyKey = `${target.itemId}-${target.entryIndex}`;
    setEntryPhotoBusy(busyKey);
    const fd = new FormData();
    fd.append("photo", file);
    const result = await uploadEntryPhoto(target.itemId, target.entryIndex, projectId, fd);
    if (result.success && result.photo_path) {
      applyEntryUpdate(target.itemId, target.entryIndex, (entry) => ({
        ...entry,
        photo_path: result.photo_path,
        photo_uploaded_at: new Date().toISOString(),
        client_status: "pending",
        client_comment: undefined,
        client_reviewed_at: undefined,
      }));
    } else if (!result.success) {
      alert(result.error ?? "Error al subir la foto");
    }
    setEntryPhotoBusy(null);
    setPendingEntryPhoto(null);
  }

  async function handleEntryPhotoRemove(itemId: string, entryIndex: number) {
    if (!window.confirm("¿Quitar la foto de este trofeo?")) return;
    const busyKey = `${itemId}-${entryIndex}`;
    setEntryPhotoBusy(busyKey);
    const result = await removeEntryPhoto(itemId, entryIndex, projectId);
    if (result.success) {
      applyEntryUpdate(itemId, entryIndex, (entry) => ({
        ...entry,
        photo_path: undefined,
        photo_uploaded_at: undefined,
        client_status: undefined,
        client_comment: undefined,
        client_reviewed_at: undefined,
      }));
    } else {
      alert(result.error ?? "Error al quitar la foto");
    }
    setEntryPhotoBusy(null);
  }

  function applyEntryUpdate(
    itemId: string,
    entryIndex: number,
    updater: (entry: NameEntry) => NameEntry,
  ) {
    setLocalItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        const entries = [...(i.data?.entries ?? [])];
        if (!entries[entryIndex]) return i;
        entries[entryIndex] = updater(entries[entryIndex]);
        return { ...i, data: { ...(i.data ?? {}), entries } };
      }),
    );
  }

  function handleCameraModePhoto(
    itemId: string,
    entryIndex: number,
    photoPath: string,
  ) {
    applyEntryUpdate(itemId, entryIndex, (entry) => ({
      ...entry,
      photo_path: photoPath,
      photo_uploaded_at: new Date().toISOString(),
      client_status: "pending",
      client_comment: undefined,
      client_reviewed_at: undefined,
    }));
  }

  const cameraModeItem =
    cameraModeItemId !== null
      ? localItems.find((i) => i.id === cameraModeItemId) ?? null
      : null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Checklist{templateName ? ` (${templateName})` : ""}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {hasClientReviewItems && trackingToken && (
            <button
              onClick={() => {
                const url = `${window.location.origin}/track/${trackingToken}/confirm`;
                navigator.clipboard.writeText(url);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              }}
              className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              {linkCopied ? "Copiado!" : "Link revisión cliente"}
            </button>
          )}
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {completedCount}/{localItems.length}
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {localItems.map((item) => {
          const entries = item.data?.entries;
          const isExpanded = expandedItem === item.id;
          const checkedNames = entries?.filter((e) => e.checked).length ?? 0;
          const totalNames = entries?.length ?? 0;

          return (
            <div key={item.id} className="px-5 py-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleToggle(item.id, !item.completed)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                    item.completed
                      ? "border-green-500 bg-green-500 text-white"
                      : "border-zinc-300 dark:border-zinc-600"
                  }`}
                >
                  {item.completed && (
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
                <span
                  className={`flex-1 text-sm ${
                    item.completed
                      ? "text-zinc-400 line-through dark:text-zinc-500"
                      : "text-zinc-900 dark:text-white"
                  }`}
                >
                  {item.name}
                </span>

                {/* QC photo controls */}
                {item.item_type === "photo_qc" && (
                  <div className="flex items-center gap-2">
                    {item.data?.photo_path && (
                      <button
                        onClick={() => setPhotoLightbox(item.id)}
                        className="h-8 w-8 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
                        title="Ver foto"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/qc-photos/${item.id}`}
                          alt="QC"
                          className="h-full w-full object-cover"
                        />
                      </button>
                    )}
                    <button
                      onClick={() => handlePhotoSelect(item.id)}
                      disabled={photoBusyItemId === item.id}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      {photoBusyItemId === item.id
                        ? "Subiendo…"
                        : item.data?.photo_path
                          ? "Reemplazar"
                          : "Hacer foto"}
                    </button>
                  </div>
                )}

                {/* Name list controls */}
                {item.item_type === "name_list" && (
                  <div className="flex items-center gap-2">
                    {totalNames > 0 && (
                      <button
                        onClick={() =>
                          setExpandedItem(isExpanded ? null : item.id)
                        }
                        className="flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:hover:bg-purple-900/30"
                      >
                        {checkedNames}/{totalNames}
                        <svg
                          className={`h-3 w-3 transition-transform ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                    )}
                    {totalNames > 0 && (() => {
                      const photoCount = entries!.filter((e) => e.photo_path).length;
                      const issueCount = entries!.filter(
                        (e) => e.client_status === "issue",
                      ).length;
                      return (
                        <>
                          <span
                            className={`rounded-md px-2 py-1 text-xs font-medium ${
                              photoCount === totalNames
                                ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}
                            title="Fotos hechas"
                          >
                            📷 {photoCount}/{totalNames}
                          </span>
                          {issueCount > 0 && (
                            <span
                              className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                              title="Trofeos con comentario del cliente"
                            >
                              ⚠ {issueCount}
                            </span>
                          )}
                          <button
                            onClick={() => setCameraModeItemId(item.id)}
                            className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                          >
                            Modo cámara
                          </button>
                        </>
                      );
                    })()}
                    <button
                      onClick={() => handleFileSelect(item.id)}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      Subir archivo
                    </button>
                    <a
                      href="/api/names-template"
                      download
                      className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-800"
                      title="Descargar plantilla Excel para enviar al cliente"
                    >
                      ↓ Plantilla
                    </a>
                  </div>
                )}
              </div>

              {/* Expanded checkable name list */}
              {item.item_type === "name_list" && isExpanded && entries && (
                <div className="mt-2 ml-8 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
                  <div className="space-y-2">
                    {entries.map((entry, idx) => {
                      const busyKey = `${item.id}-${idx}`;
                      const isBusy = entryPhotoBusy === busyKey;
                      const status = entry.client_status;
                      return (
                        <div
                          key={idx}
                          className="flex items-start gap-2 rounded-md border border-zinc-100 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          <label className="flex flex-1 items-start gap-2 cursor-pointer min-w-0">
                            <input
                              type="checkbox"
                              checked={entry.checked}
                              onChange={() =>
                                handleNameToggle(item.id, idx, !entry.checked)
                              }
                              className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-green-600 focus:ring-green-500 dark:border-zinc-600 dark:bg-zinc-700"
                            />
                            <div className="flex-1 min-w-0">
                              <span
                                className={`text-xs font-medium ${
                                  entry.checked
                                    ? "text-zinc-400 line-through dark:text-zinc-500"
                                    : "text-zinc-900 dark:text-white"
                                }`}
                              >
                                {entry.line1}
                              </span>
                              {entry.line2 && (
                                <span
                                  className={`block text-[11px] ${
                                    entry.checked
                                      ? "text-zinc-400 line-through dark:text-zinc-500"
                                      : "text-zinc-500 dark:text-zinc-400"
                                  }`}
                                >
                                  {entry.line2}
                                </span>
                              )}
                              {status === "issue" && entry.client_comment && (
                                <span className="mt-1 block rounded bg-amber-50 px-1.5 py-1 text-[11px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                                  💬 {entry.client_comment}
                                </span>
                              )}
                            </div>
                          </label>

                          {status === "approved" && (
                            <span
                              className="shrink-0 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              title="Aprobado por el cliente"
                            >
                              ✓
                            </span>
                          )}
                          {status === "pending" && entry.photo_path && (
                            <span
                              className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                              title="Pendiente de revisión cliente"
                            >
                              ⏳
                            </span>
                          )}

                          {entry.photo_path ? (
                            <button
                              onClick={() => setEntryLightbox({ itemId: item.id, entryIndex: idx })}
                              className="shrink-0 overflow-hidden rounded border border-zinc-200 dark:border-zinc-700"
                              title="Ver foto"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`/api/qc-photos/${item.id}/entry/${idx}`}
                                alt={entry.line1}
                                className="h-10 w-10 object-cover"
                              />
                            </button>
                          ) : null}

                          <div className="flex shrink-0 flex-col gap-1">
                            <button
                              onClick={() => handleEntryPhotoSelect(item.id, idx)}
                              disabled={isBusy}
                              className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                            >
                              {isBusy
                                ? "Subiendo…"
                                : entry.photo_path
                                  ? "Reemplazar"
                                  : "Foto"}
                            </button>
                            {entry.photo_path && (
                              <button
                                onClick={() => handleEntryPhotoRemove(item.id, idx)}
                                disabled={isBusy}
                                className="rounded-md border border-red-200 px-2 py-0.5 text-[10px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/10"
                              >
                                Quitar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.txt"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Hidden photo input — capture="environment" opens rear camera on mobile */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoChange}
      />

      {/* Hidden photo input para foto por entry */}
      <input
        ref={entryPhotoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleEntryPhotoChange}
      />

      {/* Photo lightbox */}
      {photoLightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPhotoLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/qc-photos/${photoLightbox}`}
            alt="QC"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setPhotoLightbox(null)}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Entry photo lightbox */}
      {entryLightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setEntryLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/qc-photos/${entryLightbox.itemId}/entry/${entryLightbox.entryIndex}`}
            alt="Trofeo"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setEntryLightbox(null)}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Modo cámara secuencial */}
      {cameraModeItem && cameraModeItem.data?.entries && (
        <EntryCameraMode
          itemId={cameraModeItem.id}
          itemName={cameraModeItem.name}
          projectId={projectId}
          entries={cameraModeItem.data.entries}
          onClose={() => setCameraModeItemId(null)}
          onPhotoUploaded={(idx, path) =>
            handleCameraModePhoto(cameraModeItem.id, idx, path)
          }
        />
      )}

      {/* CSV confirmation modal */}
      {csvPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 dark:bg-zinc-900">
            <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">
              Confirmar nombres
            </h3>
            <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
              Se encontraron {csvPreview.entries.length} entradas:
            </p>
            <div className="mb-4 max-h-60 overflow-y-auto rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
              <div className="space-y-1.5">
                {csvPreview.entries.map((entry, idx) => (
                  <div key={idx} className="text-xs">
                    <span className="font-medium text-zinc-900 dark:text-white">
                      {idx + 1}. {entry.line1}
                    </span>
                    {entry.line2 && (
                      <span className="ml-2 text-zinc-500 dark:text-zinc-400">
                        — {entry.line2}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setCsvPreview(null);
                  setUploadingItemId(null);
                }}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                onClick={confirmUpload}
                className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
