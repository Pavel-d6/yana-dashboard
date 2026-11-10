// Чтение подготовленных результатов оптимизатора (public/data/model, см. tools/export_data.py).
const base = (import.meta.env && import.meta.env.BASE_URL) || "/";

export const STRATEGIES = ["FCFS", "OPTIMIZED"];
export const CARGO = {
  coal: "Уголь",
  crude_oil: "Сырая нефть (топливо)",
  food: "Продовольствие",
  food_extended: "Продовольствие, доп. перечень",
};
export const SOCIAL = ["food", "food_extended"];
export const FAMILY = {
  baseline: "Базовые условия",
  demand_plus30: "Спрос +30%",
  fleet_minus20: "Грузоподъёмность флота −20%",
  navigation_minus10: "Навигация короче на 10 дней",
  scarce_fleet: "Дефицит флота",
  excess_fleet: "Избыток флота",
};
export const DEPTH = { shallow: "Мелкая вода", central: "Средние глубины", deep: "Глубокая вода" };
export const TIMING = { early: "Ранняя", central: "Средняя", late: "Поздняя" };

export async function loadIndex() {
  const res = await fetch(`${base}data/model/index.json`);
  if (!res.ok) throw new Error("Не найден data/model/index.json. Запустите tools/export_data.py");
  return (await res.json()).scenarios;
}

const cache = new Map();
export function loadScenario(id) {
  if (!cache.has(id))
    cache.set(
      id,
      fetch(`${base}data/model/scenarios/${id}.json`).then((r) => {
        if (!r.ok) throw new Error(`Не найден файл сценария ${id}`);
        return r.json();
      })
    );
  return cache.get(id);
}

export const ts = (iso) => Date.parse(iso.length <= 10 ? `${iso}T00:00:00Z` : `${iso}Z`);
export const dayMonth = (ms) => {
  const d = new Date(ms);
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
export const dateTime = (iso) => `${dayMonth(ts(iso))} ${iso.slice(11, 16)}`;
export const days = (a, b) => (ts(b) - ts(a)) / 864e5;

const nf0 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const n0 = (x) => nf0.format(x);
export const n1 = (x) => nf1.format(x);
export const signed = (x, f = n0) => (x > 0 ? "+" : x < 0 ? "−" : "") + f(Math.abs(x));
export const relPct = (a, b) => (b === 0 ? null : (a / b - 1) * 100);

export function scenarioTitle(s) {
  const parts = [FAMILY[s.family]];
  if (!s.family.endsWith("_fleet")) parts.push(DEPTH[s.depth].toLowerCase(), `${TIMING[s.timing].toLowerCase()} готовность грузов`);
  return `${parts.join(", ")}; набор грузов ${s.replicate}`;
}

// Накопленная доставка: ступеньки по моментам окончания разгрузки рейсов.
export function cumulative(trips, onlyOnTime) {
  let sum = 0;
  return trips
    .filter((t) => !onlyOnTime || t.on_time)
    .map((t) => [ts(t.unloading_end), t.volume_t])
    .sort((a, b) => a[0] - b[0])
    .map(([x, v]) => [x, (sum += v)]);
}
