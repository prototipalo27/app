"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import {
  parseBBVAStatement,
  groupByVendor,
  type BankTransaction,
  type VendorGroup,
} from "@/lib/bbva-parser";
import {
  saveVendorMappingsBatch,
  sendClaimEmail,
  saveStatement,
  getStatement,
  deleteStatement,
  getOrCreateMonthFolder,
  toggleCheckedVendor,
} from "./actions";

interface Supplier {
  id: string;
  name: string;
  email: string | null;
}

interface VendorMapping {
  id: string;
  bank_vendor_name: string;
  supplier_id: string | null;
  category: string | null;
  notes: string | null;
  url: string | null;
}

const CATEGORIES: { value: string; label: string }[] = [
  { value: "materials", label: "Material" },
  { value: "shipping", label: "Envios" },
  { value: "software", label: "Software/SaaS" },
  { value: "payroll", label: "Nominas" },
  { value: "financing", label: "Financiaciones" },
  { value: "banking", label: "Bancos" },
  { value: "taxes", label: "Impuestos" },
  { value: "rent", label: "Alquiler" },
  { value: "utilities", label: "Suministros" },
  { value: "telecom", label: "Telecomunicaciones" },
  { value: "insurance", label: "Seguros" },
  { value: "fuel", label: "Gasolinas" },
  { value: "meals", label: "Comidas" },
  { value: "travel", label: "Viajes" },
  { value: "marketing", label: "Marketing" },
  { value: "professional", label: "Serv. profesionales" },
  { value: "income", label: "Ingresos" },
  { value: "other", label: "Otros" },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label])
);

const CATEGORY_COLORS: Record<string, string> = {
  payroll: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  rent: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  utilities: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  insurance: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  software: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  telecom: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  taxes: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  materials: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  travel: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  meals: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  fuel: "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400",
  shipping: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  banking: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400",
  financing: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  marketing: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  professional: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  income: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  other: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
};

interface ClaimHistoryItem {
  id: string;
  supplier_id: string | null;
  claim_date: string | null;
  email_sent_to: string;
  total_amount: number;
  status: string | null;
  created_at: string | null;
  suppliers: { name: string } | null;
}

export interface StatementSummary {
  id: string;
  month: number;
  year: number;
  file_name: string | null;
  total_count: number;
  pending_count: number;
  drive_folder_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface Props {
  suppliers: Supplier[];
  vendorMappings: VendorMapping[];
  claimHistory: ClaimHistoryItem[];
  statements: StatementSummary[];
}

type View = "index" | "review" | "claims";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function StatementProcessor({
  suppliers,
  vendorMappings,
  claimHistory,
  statements: initialStatements,
}: Props) {
  const [view, setView] = useState<View>("index");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeMonth, setActiveMonth] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [filterPending, setFilterPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statements, setStatements] = useState<StatementSummary[]>(initialStatements);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);

  // Vendor mapping state
  const [mappings, setMappings] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    vendorMappings.forEach((vm) => {
      if (vm.supplier_id) m[vm.bank_vendor_name] = vm.supplier_id;
    });
    return m;
  });

  // Category mapping state
  const [categoryMappings, setCategoryMappings] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    vendorMappings.forEach((vm) => {
      if (vm.category) m[vm.bank_vendor_name] = vm.category;
    });
    return m;
  });

  // Notes state
  const [notesMappings, setNotesMappings] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    vendorMappings.forEach((vm) => {
      if (vm.notes) m[vm.bank_vendor_name] = vm.notes;
    });
    return m;
  });

  // URL state
  const [urlMappings, setUrlMappings] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    vendorMappings.forEach((vm) => {
      if (vm.url) m[vm.bank_vendor_name] = vm.url;
    });
    return m;
  });

  // Sort state for vendor groups
  const [sortBy, setSortBy] = useState<"amount" | "name" | "category">("amount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Checked vendors (invoice filed in Drive)
  const [checkedVendors, setCheckedVendors] = useState<Set<string>>(new Set());

  // Claims state
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
  const [sendingClaim, setSendingClaim] = useState<string | null>(null);
  const [sentClaims, setSentClaims] = useState<Set<string>>(new Set());
  const [claimErrors, setClaimErrors] = useState<Record<string, string>>({});

  // Filtered and grouped
  const displayedTransactions = useMemo(() => {
    if (!filterPending) return transactions;
    return transactions.filter(
      (t) => t.status.toLowerCase().includes("pendiente") || t.status === ""
    );
  }, [transactions, filterPending]);

  const vendorGroups = useMemo(() => {
    const groups = groupByVendor(displayedTransactions);
    const sorted = [...groups].sort((a, b) => {
      if (sortBy === "name") {
        const cmp = a.vendorName.localeCompare(b.vendorName, "es");
        return sortDir === "asc" ? cmp : -cmp;
      }
      if (sortBy === "category") {
        const catA = categoryMappings[a.vendorName] || "zzz";
        const catB = categoryMappings[b.vendorName] || "zzz";
        const cmp = catA.localeCompare(catB);
        return sortDir === "asc" ? cmp : -cmp;
      }
      // amount: default asc = most negative first (biggest expense)
      const cmp = a.totalAmount - b.totalAmount;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [displayedTransactions, sortBy, sortDir, categoryMappings]);

  const totalTransactions = transactions.length;
  const pendingCount = transactions.filter(
    (t) => t.status.toLowerCase().includes("pendiente") || t.status === ""
  ).length;

  // Get statement summary for a given month in the selected year
  const getMonthStatement = useCallback(
    (month: number) => statements.find((s) => s.month === month && s.year === selectedYear),
    [statements, selectedYear]
  );

  // Auto-detect month/year from parsed transactions
  const detectMonthYear = useCallback((txs: BankTransaction[]): { month: number; year: number } => {
    const now = new Date();
    if (txs.length === 0) return { month: now.getMonth() + 1, year: now.getFullYear() };

    // Parse dates (dd/mm/yyyy format)
    const dates = txs
      .map((t) => {
        const parts = t.date.split("/");
        if (parts.length >= 2) {
          const m = parseInt(parts[1], 10);
          const y = parts.length === 3 ? parseInt(parts[2], 10) : now.getFullYear();
          return { month: m, year: y < 100 ? 2000 + y : y };
        }
        return null;
      })
      .filter(Boolean) as { month: number; year: number }[];

    if (dates.length === 0) return { month: now.getMonth() + 1, year: now.getFullYear() };

    // Most common month
    const counts = new Map<string, number>();
    for (const d of dates) {
      const key = `${d.year}-${d.month}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    let bestKey = "";
    let bestCount = 0;
    for (const [key, count] of counts) {
      if (count > bestCount) {
        bestKey = key;
        bestCount = count;
      }
    }
    const [yearStr, monthStr] = bestKey.split("-");
    return { month: parseInt(monthStr, 10), year: parseInt(yearStr, 10) };
  }, []);

  // Handle file upload and save to DB
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>, targetMonth?: number) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError(null);
      setLoading(true);

      try {
        const buffer = await file.arrayBuffer();
        const parsed = parseBBVAStatement(buffer);

        const detected = targetMonth != null
          ? { month: targetMonth, year: selectedYear }
          : detectMonthYear(parsed);

        const total = parsed.length;
        const pending = parsed.filter(
          (t) => t.status.toLowerCase().includes("pendiente") || t.status === ""
        ).length;

        // Save to DB
        await saveStatement(detected.month, detected.year, file.name, parsed, total, pending);

        // Update local state
        setTransactions(parsed);
        setActiveMonth(detected.month);
        setSelectedYear(detected.year);
        setActiveFileName(file.name);

        // Update statements list
        setStatements((prev) => {
          const filtered = prev.filter(
            (s) => !(s.month === detected.month && s.year === detected.year)
          );
          return [
            ...filtered,
            {
              id: crypto.randomUUID(),
              month: detected.month,
              year: detected.year,
              file_name: file.name,
              total_count: total,
              pending_count: pending,
              drive_folder_id: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ];
        });

        setView("review");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al procesar el archivo");
      } finally {
        setLoading(false);
      }
    },
    [selectedYear, detectMonthYear]
  );

  // Load a month from DB
  const handleLoadMonth = useCallback(
    async (month: number) => {
      setError(null);
      setLoading(true);
      try {
        const stmt = await getStatement(month, selectedYear);
        if (!stmt) {
          setError("No se encontro el extracto");
          return;
        }
        setTransactions(stmt.transactions as unknown as BankTransaction[]);
        setActiveMonth(month);
        setActiveFileName(stmt.file_name);
        setCheckedVendors(new Set((stmt.checked_vendors as string[]) || []));
        setView("review");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar extracto");
      } finally {
        setLoading(false);
      }
    },
    [selectedYear]
  );

  // Delete a month
  const handleDeleteMonth = useCallback(
    async (month: number) => {
      if (!confirm(`Eliminar el extracto de ${MONTH_NAMES[month - 1]} ${selectedYear}?`)) return;
      setError(null);
      try {
        await deleteStatement(month, selectedYear);
        setStatements((prev) =>
          prev.filter((s) => !(s.month === month && s.year === selectedYear))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al eliminar");
      }
    },
    [selectedYear]
  );

  // Open Drive folder for a month (create if needed)
  const handleOpenDriveFolder = useCallback(
    async (month: number) => {
      setError(null);
      const result = await getOrCreateMonthFolder(month, selectedYear);
      if (!result.success) {
        setError(result.error);
        return;
      }
      // Update local cache
      setStatements((prev) =>
        prev.map((s) =>
          s.month === month && s.year === selectedYear
            ? { ...s, drive_folder_id: result.folderId }
            : s
        )
      );
      window.open(`https://drive.google.com/drive/folders/${result.folderId}`, "_blank");
    },
    [selectedYear]
  );

  const handleMappingChange = useCallback(
    (vendorName: string, supplierId: string) => {
      setMappings((prev) => ({ ...prev, [vendorName]: supplierId }));
    },
    []
  );

  const handleCategoryChange = useCallback(
    (vendorName: string, category: string) => {
      setCategoryMappings((prev) => ({ ...prev, [vendorName]: category }));
    },
    []
  );

  const handleNotesChange = useCallback(
    (vendorName: string, notes: string) => {
      setNotesMappings((prev) => ({ ...prev, [vendorName]: notes }));
    },
    []
  );

  const handleUrlChange = useCallback(
    (vendorName: string, url: string) => {
      setUrlMappings((prev) => ({ ...prev, [vendorName]: url }));
    },
    []
  );

  const handleToggleChecked = useCallback(
    async (vendorName: string) => {
      if (!activeMonth) return;
      const newChecked = !checkedVendors.has(vendorName);
      // Optimistic update
      setCheckedVendors((prev) => {
        const next = new Set(prev);
        if (newChecked) next.add(vendorName);
        else next.delete(vendorName);
        return next;
      });
      try {
        await toggleCheckedVendor(activeMonth, selectedYear, vendorName, newChecked);
      } catch {
        // Rollback on error
        setCheckedVendors((prev) => {
          const next = new Set(prev);
          if (newChecked) next.delete(vendorName);
          else next.add(vendorName);
          return next;
        });
      }
    },
    [activeMonth, selectedYear, checkedVendors]
  );

  // Category summary for displayed transactions (expenses only)
  const categorySummary = useMemo(() => {
    const summary: Record<string, number> = {};
    let uncategorized = 0;
    let totalExpenses = 0;

    for (const group of vendorGroups) {
      // Only count expenses (negative amounts)
      const expenseAmount = group.transactions
        .filter((t) => t.amount < 0)
        .reduce((s, t) => s + t.amount, 0);
      if (expenseAmount >= 0) continue;

      totalExpenses += expenseAmount;
      const cat = categoryMappings[group.vendorName];
      if (cat) {
        summary[cat] = (summary[cat] || 0) + expenseAmount;
      } else {
        uncategorized += expenseAmount;
      }
    }

    const entries = Object.entries(summary)
      .map(([cat, amount]) => ({
        category: cat,
        label: CATEGORY_LABELS[cat] || cat,
        amount,
        pct: totalExpenses !== 0 ? (amount / totalExpenses) * 100 : 0,
      }))
      .sort((a, b) => a.amount - b.amount); // most negative first

    return { entries, uncategorized, totalExpenses };
  }, [vendorGroups, categoryMappings]);

  // Drive file upload (drag & drop)
  type DriveUpload = { name: string; status: "uploading" | "done" | "error"; error?: string };
  const [isDragging, setIsDragging] = useState(false);
  const [driveUploads, setDriveUploads] = useState<DriveUpload[]>([]);
  const dragCounter = useRef(0);
  const driveFileInputRef = useRef<HTMLInputElement>(null);

  const uploadFilesToDrive = useCallback(
    async (files: File[]) => {
      if (!activeMonth || files.length === 0) return;

      // Get or create Drive folder
      const folderResult = await getOrCreateMonthFolder(activeMonth, selectedYear);
      if (!folderResult.success) {
        setError(folderResult.error);
        return;
      }
      const folderId = folderResult.folderId;

      // Update local cache
      setStatements((prev) =>
        prev.map((s) =>
          s.month === activeMonth && s.year === selectedYear
            ? { ...s, drive_folder_id: folderId }
            : s
        )
      );

      const newUploads: DriveUpload[] = files.map((f) => ({ name: f.name, status: "uploading" as const }));
      setDriveUploads(newUploads);

      const results = await Promise.allSettled(
        files.map(async (file, i) => {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("folderId", folderId);

          const res = await fetch("/api/drive/upload", { method: "POST", body: formData });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error ?? "Error al subir");
          }
          setDriveUploads((prev) =>
            prev.map((u, idx) => (idx === i ? { ...u, status: "done" } : u))
          );
        })
      );

      setDriveUploads((prev) =>
        prev.map((u, i) => {
          if (results[i].status === "rejected") {
            const reason = results[i] as PromiseRejectedResult;
            return { ...u, status: "error", error: reason.reason?.message ?? "Error" };
          }
          return u;
        })
      );

      // Clear successful uploads after 3s
      setTimeout(() => {
        setDriveUploads((prev) => prev.filter((u) => u.status === "error"));
      }, 3000);
    },
    [activeMonth, selectedYear]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      dragCounter.current = 0;
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) uploadFilesToDrive(droppedFiles);
    },
    [uploadFilesToDrive]
  );

  const handleSaveMappings = useCallback(async () => {
    setLoading(true);
    try {
      // Build batch: include all vendors that have either a supplier or a category
      const allVendors = new Set([
        ...Object.keys(mappings),
        ...Object.keys(categoryMappings),
        ...Object.keys(notesMappings),
        ...Object.keys(urlMappings),
      ]);
      const batch = Array.from(allVendors)
        .filter((v) => mappings[v] || categoryMappings[v] || notesMappings[v] || urlMappings[v])
        .map((bankVendorName) => ({
          bankVendorName,
          supplierId: mappings[bankVendorName] || null,
          category: categoryMappings[bankVendorName] || null,
          notes: notesMappings[bankVendorName] || null,
          url: urlMappings[bankVendorName] || null,
        }));
      if (batch.length > 0) await saveVendorMappingsBatch(batch);
      setStep("claims");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar mapeos");
    } finally {
      setLoading(false);
    }
  }, [mappings, categoryMappings, notesMappings, urlMappings]);

  const setStep = useCallback((s: View) => {
    setView(s);
    setSelectedVendors(new Set());
    setSentClaims(new Set());
    setClaimErrors({});
  }, []);

  const goBackToIndex = useCallback(() => {
    setView("index");
    setActiveMonth(null);
    setTransactions([]);
    setActiveFileName(null);
  }, []);

  const toggleVendorSelection = useCallback((vendorName: string) => {
    setSelectedVendors((prev) => {
      const next = new Set(prev);
      if (next.has(vendorName)) next.delete(vendorName);
      else next.add(vendorName);
      return next;
    });
  }, []);

  const handleSendClaim = useCallback(
    async (group: VendorGroup) => {
      const supplierId = mappings[group.vendorName];
      if (!supplierId) return;

      const supplier = suppliers.find((s) => s.id === supplierId);
      if (!supplier?.email) {
        setClaimErrors((prev) => ({
          ...prev,
          [group.vendorName]: "El proveedor no tiene email configurado",
        }));
        return;
      }

      setSendingClaim(group.vendorName);
      setClaimErrors((prev) => {
        const next = { ...prev };
        delete next[group.vendorName];
        return next;
      });

      try {
        await sendClaimEmail(
          supplierId,
          supplier.email,
          supplier.name,
          group.transactions.map((t) => ({
            date: t.date,
            description: t.description,
            amount: t.amount,
          })),
          group.totalAmount
        );
        setSentClaims((prev) => new Set([...prev, group.vendorName]));
      } catch (err) {
        setClaimErrors((prev) => ({
          ...prev,
          [group.vendorName]: err instanceof Error ? err.message : "Error al enviar",
        }));
      } finally {
        setSendingClaim(null);
      }
    },
    [mappings, suppliers]
  );

  const getSupplierForVendor = useCallback(
    (vendorName: string) => {
      const sid = mappings[vendorName];
      if (!sid) return null;
      return suppliers.find((s) => s.id === sid) || null;
    },
    [mappings, suppliers]
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Cerrar
          </button>
        </div>
      )}

      {/* === INDEX VIEW === */}
      {view === "index" && (
        <>
          {/* Year selector */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedYear((y) => y - 1)}
                className="rounded-lg border border-zinc-300 p-2 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{selectedYear}</h2>
              <button
                onClick={() => setSelectedYear((y) => y + 1)}
                className="rounded-lg border border-zinc-300 p-2 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Upload for auto-detect */}
            <label className="cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
              {loading ? "Procesando..." : "Subir extracto"}
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleFileUpload(e)}
                className="hidden"
                disabled={loading}
              />
            </label>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {MONTH_NAMES.map((name, i) => {
              const month = i + 1;
              const stmt = getMonthStatement(month);

              return (
                <div
                  key={month}
                  className={`group relative rounded-xl border p-4 transition-colors ${
                    stmt
                      ? "border-green-200 bg-green-50/50 dark:border-green-800/50 dark:bg-green-900/10"
                      : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                  }`}
                >
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">{name}</p>

                  {stmt ? (
                    <>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {stmt.total_count} mov.
                      </p>
                      {stmt.pending_count > 0 && (
                        <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          {stmt.pending_count} pend.
                        </span>
                      )}
                      <div className="mt-3 flex flex-col gap-1.5">
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleLoadMonth(month)}
                            disabled={loading}
                            className="flex-1 rounded-lg bg-brand px-2 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
                          >
                            Abrir
                          </button>
                          <button
                            onClick={() => handleOpenDriveFolder(month)}
                            title="Abrir carpeta en Drive"
                            className="rounded-lg bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                          </button>
                        </div>
                        <div className="flex gap-1">
                          <label className="flex-1 cursor-pointer rounded-lg border border-zinc-300 px-2 py-1 text-center text-[10px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">
                            Reemplazar
                            <input
                              type="file"
                              accept=".xlsx,.xls"
                              onChange={(e) => handleFileUpload(e, month)}
                              className="hidden"
                              disabled={loading}
                            />
                          </label>
                          <button
                            onClick={() => handleDeleteMonth(month)}
                            className="rounded-lg border border-red-200 px-2 py-1 text-[10px] font-medium text-red-500 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                          >
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="mt-3">
                      <label className="block cursor-pointer rounded-lg border border-dashed border-zinc-300 px-2 py-3 text-center text-xs text-zinc-400 hover:border-green-400 hover:text-green-600 dark:border-zinc-700 dark:hover:border-green-600 dark:hover:text-green-400">
                        Subir
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={(e) => handleFileUpload(e, month)}
                          className="hidden"
                          disabled={loading}
                        />
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* === REVIEW VIEW === */}
      {view === "review" && (
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="relative space-y-6"
        >
          {/* Drag overlay */}
          {isDragging && (
            <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded-xl border-2 border-dashed border-blue-400 bg-blue-50/80 dark:border-blue-500 dark:bg-blue-900/30">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="mt-2 text-sm font-medium text-blue-600 dark:text-blue-400">Soltar para subir a Drive</p>
              </div>
            </div>
          )}

          {/* Upload status */}
          {driveUploads.length > 0 && (
            <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="space-y-1.5">
                {driveUploads.map((u, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {u.status === "uploading" && (
                      <svg className="h-3.5 w-3.5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    {u.status === "done" && (
                      <svg className="h-3.5 w-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {u.status === "error" && (
                      <svg className="h-3.5 w-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <span className={`truncate ${u.status === "error" ? "text-red-500" : "text-zinc-700 dark:text-zinc-300"}`}>
                      {u.name}
                    </span>
                    {u.error && <span className="text-red-400">— {u.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Header with back button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={goBackToIndex}
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  {activeMonth ? MONTH_NAMES[activeMonth - 1] : ""} {selectedYear}
                </h2>
                {activeFileName && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{activeFileName}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeMonth && (
                <button
                  onClick={() => handleOpenDriveFolder(activeMonth)}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  Facturas en Drive
                </button>
              )}
              <label className="cursor-pointer rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">
                Reemplazar extracto
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleFileUpload(e, activeMonth ?? undefined)}
                  className="hidden"
                  disabled={loading}
                />
              </label>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Movimientos totales" value={totalTransactions} />
            <StatCard label="Pendientes" value={pendingCount} accent />
            <StatCard label="Proveedores" value={vendorGroups.length} />
            <StatCard
              label="Facturas archivadas"
              value={checkedVendors.size}
              total={vendorGroups.length}
              success={checkedVendors.size === vendorGroups.length && vendorGroups.length > 0}
            />
          </div>

          {/* Filter toggle */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={filterPending}
                onChange={(e) => setFilterPending(e.target.checked)}
                className="rounded border-zinc-300 text-brand focus:ring-brand-blue dark:border-zinc-600"
              />
              Solo movimientos pendientes
            </label>
          </div>

          {/* Category summary */}
          {categorySummary.totalExpenses < 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">
                Desglose por categoria
              </h3>
              <div className="space-y-2">
                {categorySummary.entries.map((e) => (
                  <div key={e.category} className="flex items-center gap-3">
                    <span className={`inline-block w-28 rounded-full px-2.5 py-0.5 text-center text-xs font-medium ${CATEGORY_COLORS[e.category] || CATEGORY_COLORS.other}`}>
                      {e.label}
                    </span>
                    <div className="flex-1">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-zinc-500 dark:bg-zinc-400"
                          style={{ width: `${Math.abs(e.pct)}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-20 text-right text-sm font-medium text-zinc-900 dark:text-white">
                      {Math.abs(e.amount).toFixed(0)}€
                    </span>
                    <span className="w-12 text-right text-xs text-zinc-500">
                      {Math.abs(e.pct).toFixed(0)}%
                    </span>
                  </div>
                ))}
                {categorySummary.uncategorized < 0 && (
                  <div className="flex items-center gap-3">
                    <span className="inline-block w-28 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-center text-xs font-medium text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                      Sin categorizar
                    </span>
                    <div className="flex-1">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-amber-400 dark:bg-amber-500"
                          style={{ width: `${Math.abs((categorySummary.uncategorized / categorySummary.totalExpenses) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-20 text-right text-sm font-medium text-amber-600 dark:text-amber-400">
                      {Math.abs(categorySummary.uncategorized).toFixed(0)}€
                    </span>
                    <span className="w-12 text-right text-xs text-amber-500">
                      {Math.abs((categorySummary.uncategorized / categorySummary.totalExpenses) * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-3 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Total gastos</span>
                  <span className="font-bold text-zinc-900 dark:text-white">
                    {Math.abs(categorySummary.totalExpenses).toFixed(2)}€
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Sort controls */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-400 dark:text-zinc-500">Ordenar:</span>
            {([
              { key: "amount" as const, label: "Importe" },
              { key: "name" as const, label: "Nombre" },
              { key: "category" as const, label: "Categoria" },
            ]).map((opt) => (
              <button
                key={opt.key}
                onClick={() => {
                  if (sortBy === opt.key) {
                    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                  } else {
                    setSortBy(opt.key);
                    setSortDir("asc");
                  }
                }}
                className={`flex items-center gap-0.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  sortBy === opt.key
                    ? "bg-brand text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
              >
                {opt.label}
                {sortBy === opt.key && (
                  <svg className={`h-3 w-3 transition-transform ${sortDir === "desc" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Vendor groups */}
          <div className="space-y-4">
            {vendorGroups.map((group) => (
              <VendorGroupCard
                key={group.vendorName}
                group={group}
                suppliers={suppliers}
                currentMapping={mappings[group.vendorName] || ""}
                currentCategory={categoryMappings[group.vendorName] || ""}
                currentNotes={notesMappings[group.vendorName] || ""}
                currentUrl={urlMappings[group.vendorName] || ""}
                isChecked={checkedVendors.has(group.vendorName)}
                onMappingChange={(sid) => handleMappingChange(group.vendorName, sid)}
                onCategoryChange={(cat) => handleCategoryChange(group.vendorName, cat)}
                onNotesChange={(notes) => handleNotesChange(group.vendorName, notes)}
                onUrlChange={(url) => handleUrlChange(group.vendorName, url)}
                onToggleChecked={() => handleToggleChecked(group.vendorName)}
              />
            ))}
          </div>

          {/* Save & continue */}
          <div className="flex justify-between">
            <button
              onClick={() => driveFileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-blue-300 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Subir facturas a Drive
              <input
                ref={driveFileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length > 0) uploadFilesToDrive(files);
                  e.target.value = "";
                }}
              />
            </button>
            <button
              onClick={handleSaveMappings}
              disabled={loading}
              className="rounded-lg bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Guardar mapeos y continuar"}
            </button>
          </div>
        </div>
      )}

      {/* === CLAIMS VIEW === */}
      {view === "claims" && (
        <>
          {/* Header with back */}
          <div className="flex items-center gap-3">
            <button
              onClick={goBackToIndex}
              className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Reclamaciones — {activeMonth ? MONTH_NAMES[activeMonth - 1] : ""} {selectedYear}
            </h2>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
              Selecciona los proveedores a los que quieres enviar una reclamacion de facturas pendientes.
              Solo se muestran proveedores mapeados con email.
            </p>

            <div className="space-y-3">
              {vendorGroups
                .filter((g) => getSupplierForVendor(g.vendorName)?.email)
                .map((group) => {
                  const supplier = getSupplierForVendor(group.vendorName)!;
                  const isSent = sentClaims.has(group.vendorName);
                  const isSending = sendingClaim === group.vendorName;
                  const claimError = claimErrors[group.vendorName];

                  return (
                    <div
                      key={group.vendorName}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedVendors.has(group.vendorName)}
                          onChange={() => toggleVendorSelection(group.vendorName)}
                          disabled={isSent}
                          className="rounded border-zinc-300 text-brand focus:ring-brand-blue dark:border-zinc-600"
                        />
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-white">
                            {supplier.name}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {group.vendorName} — {group.transactions.length} movimiento(s) — {Math.abs(group.totalAmount).toFixed(2)}€
                          </p>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500">
                            {supplier.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSent ? (
                          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            Enviado
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSendClaim(group)}
                            disabled={isSending}
                            className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                          >
                            {isSending ? "Enviando..." : "Enviar"}
                          </button>
                        )}
                        {claimError && (
                          <span className="text-xs text-red-500">{claimError}</span>
                        )}
                      </div>
                    </div>
                  );
                })}

              {vendorGroups.filter((g) => getSupplierForVendor(g.vendorName)?.email).length === 0 && (
                <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  No hay proveedores mapeados con email. Vuelve al paso anterior para mapear proveedores.
                </p>
              )}
            </div>
          </div>

          {/* Unmapped vendors notice */}
          {vendorGroups.filter((g) => !getSupplierForVendor(g.vendorName)).length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Proveedores sin mapear ({vendorGroups.filter((g) => !getSupplierForVendor(g.vendorName)).length}):
              </p>
              <ul className="mt-2 space-y-1 text-xs text-amber-600 dark:text-amber-500">
                {vendorGroups
                  .filter((g) => !getSupplierForVendor(g.vendorName))
                  .map((g) => (
                    <li key={g.vendorName}>
                      {g.vendorName} — {Math.abs(g.totalAmount).toFixed(2)}€
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={() => setView("review")}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Volver a revisar
            </button>
          </div>

          {/* Claim history */}
          {claimHistory.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="mb-3 font-semibold text-zinc-900 dark:text-white">
                Historial de reclamaciones
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                    <tr>
                      <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">Fecha</th>
                      <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">Proveedor</th>
                      <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">Email</th>
                      <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">Importe</th>
                      <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {claimHistory.map((claim) => (
                      <tr key={claim.id}>
                        <td className="px-3 py-2 text-zinc-900 dark:text-white">
                          {claim.created_at ? new Date(claim.created_at).toLocaleDateString("es-ES") : "—"}
                        </td>
                        <td className="px-3 py-2 text-zinc-900 dark:text-white">
                          {claim.suppliers?.name || "—"}
                        </td>
                        <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                          {claim.email_sent_to}
                        </td>
                        <td className="px-3 py-2 font-medium text-zinc-900 dark:text-white">
                          {Number(claim.total_amount).toFixed(2)}€
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge status={claim.status || "sent"} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="rounded-xl bg-white px-6 py-4 shadow-lg dark:bg-zinc-800">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Cargando...</p>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function StatCard({
  label,
  value,
  accent,
  total,
  success,
}: {
  label: string;
  value: number;
  accent?: boolean;
  total?: number;
  success?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${
          success
            ? "text-green-600 dark:text-green-400"
            : accent
              ? "text-amber-600 dark:text-amber-400"
              : "text-zinc-900 dark:text-white"
        }`}
      >
        {value}{total != null && <span className="text-base font-normal text-zinc-400">/{total}</span>}
      </p>
    </div>
  );
}

function VendorGroupCard({
  group,
  suppliers,
  currentMapping,
  currentCategory,
  currentNotes,
  currentUrl,
  isChecked,
  onMappingChange,
  onCategoryChange,
  onNotesChange,
  onUrlChange,
  onToggleChecked,
}: {
  group: VendorGroup;
  suppliers: { id: string; name: string; email: string | null }[];
  currentMapping: string;
  currentCategory: string;
  currentNotes: string;
  currentUrl: string;
  isChecked: boolean;
  onMappingChange: (supplierId: string) => void;
  onCategoryChange: (category: string) => void;
  onNotesChange: (notes: string) => void;
  onUrlChange: (url: string) => void;
  onToggleChecked: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-xl border bg-white dark:bg-zinc-900 ${isChecked ? "border-green-300 dark:border-green-800/60" : "border-zinc-200 dark:border-zinc-800"}`}>
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleChecked}
            title={isChecked ? "Factura archivada" : "Marcar factura como archivada"}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
              isChecked
                ? "border-green-500 bg-green-500 text-white dark:border-green-600 dark:bg-green-600"
                : "border-zinc-300 text-transparent hover:border-green-400 dark:border-zinc-600"
            }`}
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            <svg
              className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <p className={`font-medium ${isChecked ? "text-green-700 dark:text-green-400" : "text-zinc-900 dark:text-white"}`}>{group.vendorName}</p>
              {currentUrl && (
                <a
                  href={currentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Abrir portal de facturas"
                  className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </a>
              )}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {group.transactions.length} movimiento(s)
              </p>
              {currentNotes && !expanded && (
                <span className="truncate max-w-48 text-xs text-amber-600 dark:text-amber-400">— {currentNotes}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-zinc-900 dark:text-white">
            {group.totalAmount.toFixed(2)}€
          </span>
          <select
            value={currentCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-36 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            <option value="">— Categoria —</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={currentMapping}
            onChange={(e) => onMappingChange(e.target.value)}
            className="w-48 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            <option value="">— Sin mapear —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-zinc-100 dark:border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">Fecha</th>
                <th className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">Descripcion</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">Importe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {group.transactions.map((t, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">{t.date}</td>
                  <td className="max-w-xs truncate px-4 py-2 text-zinc-500 dark:text-zinc-400">
                    {t.description}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-zinc-900 dark:text-white">
                    {t.amount.toFixed(2)}€
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-zinc-100 px-4 py-2 dark:border-zinc-800 space-y-1">
            <input
              type="text"
              value={currentNotes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Notas (ej: reclamada, pendiente de recibir...)"
              className="w-full rounded border-0 bg-transparent px-0 py-1 text-xs text-zinc-700 placeholder-zinc-400 focus:ring-0 dark:text-zinc-300 dark:placeholder-zinc-600"
            />
            <div className="flex items-center gap-1.5">
              <svg className="h-3 w-3 shrink-0 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <input
                type="url"
                value={currentUrl}
                onChange={(e) => onUrlChange(e.target.value)}
                placeholder="URL portal de facturas (ej: https://factura.proveedor.com)"
                className="w-full rounded border-0 bg-transparent px-0 py-1 text-xs text-zinc-700 placeholder-zinc-400 focus:ring-0 dark:text-zinc-300 dark:placeholder-zinc-600"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    responded: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    resolved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };
  const labels: Record<string, string> = {
    sent: "Enviado",
    responded: "Respondido",
    resolved: "Resuelto",
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || styles.sent}`}>
      {labels[status] || status}
    </span>
  );
}
