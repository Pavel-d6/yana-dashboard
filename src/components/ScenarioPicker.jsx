import { DEPTH, FAMILY, TIMING } from "../model.js";

function Select({ label, value, options, onChange, disabled }) {
  return (
    <label className="pick">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>{text}</option>
        ))}
      </select>
    </label>
  );
}

// Выбор готового сценария по его факторам. Пересчёта нет: загружается сохранённый результат.
export default function ScenarioPicker({ scenarios, current, onSelect }) {
  const find = (f) =>
    scenarios.find((s) => s.family === f.family && s.depth === f.depth && s.timing === f.timing && s.replicate === f.replicate);
  const change = (patch) => {
    let next = { family: current.family, depth: current.depth, timing: current.timing, replicate: current.replicate, ...patch };
    let hit = find(next) || find({ ...next, depth: "central", timing: "central" });
    if (hit) onSelect(hit.scenario_id);
  };
  const fixed = current.family.endsWith("_fleet");

  return (
    <div className="picker" role="group" aria-label="Выбор сценария">
      <Select label="Условия" value={current.family} options={Object.entries(FAMILY)} onChange={(v) => change({ family: v })} />
      <Select label="Глубины" value={current.depth} options={Object.entries(DEPTH)} onChange={(v) => change({ depth: v })} disabled={fixed} />
      <Select label="Готовность грузов" value={current.timing} options={Object.entries(TIMING)} onChange={(v) => change({ timing: v })} disabled={fixed} />
      <Select
        label="Набор грузов"
        value={String(current.replicate)}
        options={[1, 2, 3].map((r) => [String(r), `Набор ${r}`])}
        onChange={(v) => change({ replicate: Number(v) })}
      />
      <p className="picker-note">
        Готовый расчёт <code>{current.scenario_id}</code>, синтетические входные данные
      </p>
    </div>
  );
}
