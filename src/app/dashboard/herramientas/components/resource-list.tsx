"use client";

import { useState, useTransition, useRef } from "react";
import { createResource, updateResource, deleteResource, uploadResourceFile } from "../actions";

type Resource = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  content: string | null;
  category: string | null;
  position: number | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  tutorial: "Tutorial",
  video: "Vídeo",
  parametros: "Parámetros",
  imagen: "Imagen",
  archivo: "Archivo",
};

const TYPE_COLORS: Record<string, string> = {
  tutorial: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  video: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  parametros: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  imagen: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  archivo: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

function getYouTubeEmbedUrl(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/
  );
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

function getVimeoEmbedUrl(url: string): string | null {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? `https://player.vimeo.com/video/${match[1]}` : null;
}

function getEmbedUrl(url: string): string | null {
  return getYouTubeEmbedUrl(url) || getVimeoEmbedUrl(url);
}

export default function ResourceList({
  resources,
  isManager,
}: {
  resources: Resource[];
  isManager: boolean;
}) {
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = resources.filter((r) => {
    if (filter !== "all" && r.type !== filter) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const categories = [...new Set(resources.map((r) => r.category).filter(Boolean))];

  // Get types that exist in resources
  const activeTypes = new Set(resources.map((r) => r.type));
  const allTypes = ["tutorial", "video", "parametros", "imagen", "archivo"];
  const filterTypes = allTypes.filter((t) => activeTypes.has(t));

  function handleSave(formData: FormData) {
    startTransition(async () => {
      const result = editing
        ? await updateResource(formData)
        : await createResource(formData);
      if (result.success) {
        setShowModal(false);
        setEditing(null);
      }
    });
  }

  function handleUpload(formData: FormData) {
    startTransition(async () => {
      const result = await uploadResourceFile(formData);
      if (result.success) {
        setShowUpload(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar este recurso?")) return;
    startTransition(async () => {
      await deleteResource(id);
    });
  }

  async function copyUrl(url: string, id: string) {
    await navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  function copyHtmlImg(url: string, title: string, id: string) {
    const html = `<img src="${url}" alt="${title}" style="max-width:100%;height:auto;" />`;
    navigator.clipboard.writeText(html);
    setCopied(id + "-html");
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-md px-3 py-1 text-sm font-medium transition ${
              filter === "all"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            Todos
          </button>
          {filterTypes.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                filter === t
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar..."
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
        />
        {isManager && (
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setShowUpload(true)}
              className="rounded-lg border border-green-600 px-4 py-1.5 text-sm font-medium text-green-600 hover:bg-green-50 dark:border-green-500 dark:text-green-400 dark:hover:bg-green-900/20"
            >
              Subir archivo
            </button>
            <button
              onClick={() => {
                setEditing(null);
                setShowModal(true);
              }}
              className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700"
            >
              + Añadir recurso
            </button>
          </div>
        )}
      </div>

      {/* Resource list */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          No hay recursos
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((resource) => (
            <div
              key={resource.id}
              className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            >
              <button
                onClick={() =>
                  setExpandedId(expandedId === resource.id ? null : resource.id)
                }
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[resource.type] || TYPE_COLORS.archivo}`}
                >
                  {TYPE_LABELS[resource.type] || resource.type}
                </span>
                <span className="flex-1 font-medium text-zinc-900 dark:text-white">
                  {resource.title}
                </span>
                {resource.category && (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {resource.category}
                  </span>
                )}
                <svg
                  className={`h-4 w-4 text-zinc-400 transition ${expandedId === resource.id ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expandedId === resource.id && (
                <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
                  {resource.description && (
                    <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {resource.description}
                    </p>
                  )}

                  {/* Image preview */}
                  {resource.type === "imagen" && resource.content && (
                    <div className="mb-3">
                      <img
                        src={resource.content}
                        alt={resource.title}
                        className="max-h-64 rounded-lg border border-zinc-200 object-contain dark:border-zinc-700"
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          onClick={() => copyUrl(resource.content!, resource.id)}
                          className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          {copied === resource.id ? "Copiado!" : "Copiar URL"}
                        </button>
                        <button
                          onClick={() => copyHtmlImg(resource.content!, resource.title, resource.id)}
                          className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          {copied === resource.id + "-html" ? "Copiado!" : "Copiar HTML (email)"}
                        </button>
                        <a
                          href={resource.content}
                          download
                          className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          Descargar
                        </a>
                      </div>
                    </div>
                  )}

                  {/* File (non-image) */}
                  {resource.type === "archivo" && resource.content && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => copyUrl(resource.content!, resource.id)}
                        className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        {copied === resource.id ? "Copiado!" : "Copiar URL"}
                      </button>
                      <a
                        href={resource.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        Abrir
                      </a>
                      <a
                        href={resource.content}
                        download
                        className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        Descargar
                      </a>
                    </div>
                  )}

                  {/* Video */}
                  {resource.type === "video" && resource.content && (() => {
                    const embedUrl = getEmbedUrl(resource.content);
                    return embedUrl ? (
                      <div className="aspect-video w-full overflow-hidden rounded-lg">
                        <iframe
                          src={embedUrl}
                          className="h-full w-full"
                          allowFullScreen
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        />
                      </div>
                    ) : (
                      <a
                        href={resource.content!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-green-600 underline hover:text-green-700 dark:text-green-400"
                      >
                        Ver vídeo
                      </a>
                    );
                  })()}

                  {/* Tutorial */}
                  {resource.type === "tutorial" && resource.content && (
                    <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                      {resource.content}
                    </div>
                  )}

                  {/* Parametros */}
                  {resource.type === "parametros" && resource.content && (
                    <div className="whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 font-mono text-sm dark:bg-zinc-800 dark:text-zinc-300">
                      {resource.content}
                    </div>
                  )}

                  {isManager && (
                    <div className="mt-4 flex gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                      <button
                        onClick={() => {
                          setEditing(resource);
                          setShowModal(true);
                        }}
                        className="rounded-lg px-3 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(resource.id)}
                        disabled={isPending}
                        className="rounded-lg px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload File Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
              Subir archivo
            </h3>
            <form action={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Archivo *
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  name="file"
                  required
                  accept="image/*,.pdf,.zip,.ai,.eps,.svg"
                  className="mt-1 w-full text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-green-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-green-700 hover:file:bg-green-100 dark:text-zinc-300 dark:file:bg-green-900/30 dark:file:text-green-400"
                />
                <p className="mt-1 text-xs text-zinc-500">Logos, portfolio, PDFs, vectores...</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Título *
                </label>
                <input
                  name="title"
                  required
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  placeholder="ej: Logo Prototipalo PNG"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Descripción
                </label>
                <input
                  name="description"
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Categoría
                </label>
                <input
                  name="category"
                  list="upload-categories"
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  placeholder="ej: Logos, Portfolio, Branding"
                />
                {categories.length > 0 && (
                  <datalist id="upload-categories">
                    {categories.map((c) => (
                      <option key={c} value={c!} />
                    ))}
                  </datalist>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUpload(false)}
                  className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {isPending ? "Subiendo..." : "Subir"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
              {editing ? "Editar recurso" : "Nuevo recurso"}
            </h3>
            <form action={handleSave} className="space-y-4">
              {editing && <input type="hidden" name="id" value={editing.id} />}

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Tipo
                </label>
                <select
                  name="type"
                  defaultValue={editing?.type || "tutorial"}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="tutorial">Tutorial</option>
                  <option value="video">Vídeo</option>
                  <option value="parametros">Parámetros</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Título
                </label>
                <input
                  name="title"
                  required
                  defaultValue={editing?.title || ""}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Descripción
                </label>
                <input
                  name="description"
                  defaultValue={editing?.description || ""}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Categoría
                </label>
                <input
                  name="category"
                  defaultValue={editing?.category || ""}
                  list="categories"
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  placeholder="ej: Impresoras, Corte, Procesos"
                />
                {categories.length > 0 && (
                  <datalist id="categories">
                    {categories.map((c) => (
                      <option key={c} value={c!} />
                    ))}
                  </datalist>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Contenido
                </label>
                <textarea
                  name="content"
                  rows={5}
                  defaultValue={editing?.content || ""}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  placeholder="Texto/markdown para tutoriales, URL para vídeos"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditing(null);
                  }}
                  className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {isPending ? "Guardando..." : editing ? "Guardar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
