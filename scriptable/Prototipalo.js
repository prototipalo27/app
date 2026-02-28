// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: green; icon-glyph: cube;

// ─── CONFIG ───────────────────────────────────────────
const API_URL = "https://theapp-lemon.vercel.app/api/widget";
const API_KEY = "9d768456f21ec21a1b1e83a9e5033bca682e1236bee080085b0e4a6064e295ee";
// ──────────────────────────────────────────────────────

const req = new Request(API_URL);
req.headers = { "x-api-key": API_KEY };
const data = await req.loadJSON();

const widget = new ListWidget();
widget.backgroundColor = new Color("#18181b"); // zinc-900
widget.setPadding(12, 14, 12, 14);

// ─── HEADER ──────────────────────────────────────────
const header = widget.addStack();
header.centerAlignContent();
const title = header.addText("Prototipalo");
title.font = Font.boldSystemFont(15);
title.textColor = new Color("#22c55e"); // green-500
header.addSpacer();
const time = header.addText(
  new Date(data.updated_at).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  })
);
time.font = Font.mediumSystemFont(11);
time.textColor = new Color("#71717a"); // zinc-500

widget.addSpacer(6);

// ─── PROJECTS ────────────────────────────────────────
const projRow = widget.addStack();
projRow.centerAlignContent();
addBadge(projRow, `${data.projects.confirmed}`, "Proyectos", "#3b82f6");
projRow.addSpacer(8);
addBadge(projRow, `${data.projects.upcoming}`, "Upcoming", "#a855f7");
projRow.addSpacer();

// Deadlines
if (data.deadlines.overdue > 0) {
  addPill(projRow, `${data.deadlines.overdue} late`, "#ef4444");
} else if (data.deadlines.urgent > 0) {
  addPill(projRow, `${data.deadlines.urgent} urgente`, "#f97316");
}

widget.addSpacer(6);

// ─── STATUS BREAKDOWN ────────────────────────────────
const statusRow = widget.addStack();
statusRow.centerAlignContent();

const statusMap = [
  ["pending", "Nuevo", "#a1a1aa"],
  ["design", "Design", "#a855f7"],
  ["printing", "Print", "#3b82f6"],
  ["post_processing", "Post", "#eab308"],
  ["qc", "QC", "#f97316"],
  ["shipping", "Ship", "#06b6d4"],
];

for (const [key, label, color] of statusMap) {
  const count = data.projects.by_status[key] ?? 0;
  if (count > 0) {
    addMiniStat(statusRow, `${count}`, label, color);
    statusRow.addSpacer(6);
  }
}

widget.addSpacer(6);

// ─── PRINTERS ────────────────────────────────────────
const sep = widget.addStack();
const line = sep.addText("─".repeat(30));
line.font = Font.systemFont(6);
line.textColor = new Color("#3f3f46");

widget.addSpacer(4);

const printRow = widget.addStack();
printRow.centerAlignContent();

const printerIcon = printRow.addText("🖨");
printerIcon.font = Font.systemFont(13);
printRow.addSpacer(6);

addMiniStat(
  printRow,
  `${data.printers.printing}`,
  "imprim.",
  "#22c55e"
);
printRow.addSpacer(6);
addMiniStat(printRow, `${data.printers.idle}`, "idle", "#71717a");

if (data.printers.error > 0) {
  printRow.addSpacer(6);
  addMiniStat(printRow, `${data.printers.error}`, "error", "#ef4444");
}

printRow.addSpacer();

// Queue
const queueTotal = data.queue.queued + data.queue.printing;
if (queueTotal > 0) {
  addPill(printRow, `${queueTotal} en cola`, "#3b82f6");
}

widget.addSpacer();

// ─── FOOTER ──────────────────────────────────────────
const footer = widget.addStack();
footer.centerAlignContent();
const onlineText = footer.addText(
  `${data.printers.online}/${data.printers.total} online`
);
onlineText.font = Font.mediumSystemFont(10);
onlineText.textColor = new Color("#52525b");

// ─── HELPERS ─────────────────────────────────────────
function addBadge(stack, num, label, color) {
  const s = stack.addStack();
  s.centerAlignContent();
  s.spacing = 3;
  const n = s.addText(num);
  n.font = Font.boldSystemFont(18);
  n.textColor = new Color(color);
  const l = s.addText(label);
  l.font = Font.mediumSystemFont(10);
  l.textColor = new Color("#a1a1aa");
}

function addMiniStat(stack, num, label, color) {
  const s = stack.addStack();
  s.centerAlignContent();
  s.spacing = 2;
  const n = s.addText(num);
  n.font = Font.boldSystemFont(13);
  n.textColor = new Color(color);
  const l = s.addText(label);
  l.font = Font.systemFont(9);
  l.textColor = new Color("#71717a");
}

function addPill(stack, text, color) {
  const pill = stack.addStack();
  pill.backgroundColor = new Color(color, 0.2);
  pill.cornerRadius = 6;
  pill.setPadding(2, 6, 2, 6);
  const t = pill.addText(text);
  t.font = Font.boldSystemFont(10);
  t.textColor = new Color(color);
}

// ─── PRESENT ─────────────────────────────────────────
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  widget.presentMedium();
}
Script.complete();
