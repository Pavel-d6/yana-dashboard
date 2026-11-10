// Загрузка CSV из public/data и расчёт производных показателей.
// CSV правятся без пересборки: достаточно обновить страницу.

export const KINDS = ["Реальный", "Синтетический", "Допущение"];

export function parseCSV(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v !== "")) rows.push(row);
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, j) => [h.trim(), (r[j] ?? "").trim()])));
}

export function deriveStages(rows) {
  const stages = rows
    .map((r) => ({ ...r, stage_order: Number(r.stage_order), tonnes: Number(r.tonnes) }))
    .sort((a, b) => a.stage_order - b.stage_order);
  if (stages.some((s) => !Number.isFinite(s.tonnes) || s.tonnes < 0))
    throw new Error("official_yana_2026.csv: тоннаж должен быть числом ≥ 0");
  for (let i = 1; i < stages.length; i++)
    if (stages[i].tonnes > stages[i - 1].tonnes)
      throw new Error("official_yana_2026.csv: этапы должны идти по убыванию тоннажа");
  const plan = stages[0].tonnes;
  return stages.map((s, i) => ({
    ...s,
    shareOfPlan: s.tonnes / plan,
    shareOfPrev: i ? s.tonnes / stages[i - 1].tonnes : null,
    gapFromPrev: i ? stages[i - 1].tonnes - s.tonnes : null,
  }));
}

export function checkParameters(rows) {
  const bad = rows.filter((r) => !KINDS.includes(r.kind));
  if (bad.length)
    throw new Error(`parameters.csv: неизвестный тип «${bad[0].kind}». Допустимо: ${KINDS.join(", ")}`);
  return rows;
}

const base = (import.meta.env && import.meta.env.BASE_URL) || "/";

async function fetchCSV(name) {
  const res = await fetch(`${base}data/${name}`);
  if (!res.ok) throw new Error(`Не удалось загрузить data/${name} (HTTP ${res.status})`);
  return parseCSV(await res.text());
}

export async function loadAll() {
  const [official, parameters, sources, later] = await Promise.all([
    fetchCSV("official_yana_2026.csv"),
    fetchCSV("parameters.csv"),
    fetchCSV("sources.csv"),
    fetchCSV("later_reports.csv"),
  ]);
  return {
    stages: deriveStages(official),
    parameters: checkParameters(parameters),
    sources,
    later,
  };
}

const nf = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
export const t = (x) => nf.format(x);
export const pct = (x) => `${(x * 100).toFixed(1).replace(".", ",")}%`;
export const m = (x) => `${x.toFixed(2).replace(".", ",")} м`;
export const date = (iso) => iso.split("-").reverse().join(".");
