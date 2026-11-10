import { useMemo, useState } from "react";
import { KINDS, t } from "../data.js";

export const KIND_INFO = {
  "Реальный": { cls: "real", text: "опубликованные значения из официальных и отраслевых источников" },
  "Синтетический": { cls: "synth", text: "генерируются моделью или задаются в сценарии; это не факты о Яне" },
  "Допущение": { cls: "assume", text: "приняты командой и требуют уточнения" },
};

// Целые числа — с разделителем тысяч; единицу ставим только к значениям с цифрами.
function formatValue({ value, unit }) {
  const v = /^\d+$/.test(value) ? t(Number(value)) : value;
  return /\d/.test(value) && unit && unit !== "—" ? `${v} ${unit}` : v;
}

export function KindTag({ kind }) {
  return <span className={`kind ${KIND_INFO[kind].cls}`}>{kind}</span>;
}

export default function ParamsTable({ parameters, sources }) {
  const [filter, setFilter] = useState("all");
  const publisher = useMemo(() => Object.fromEntries(sources.map((s) => [s.source_id, s.publisher])), [sources]);
  const counts = useMemo(
    () => Object.fromEntries(KINDS.map((k) => [k, parameters.filter((p) => p.kind === k).length])),
    [parameters]
  );
  const rows = filter === "all" ? parameters : parameters.filter((p) => p.kind === filter);

  return (
    <>
      <ul className="kind-legend">
        {KINDS.map((k) => (
          <li key={k}>
            <KindTag kind={k} /> <b>{counts[k]}</b> — {KIND_INFO[k].text}
          </li>
        ))}
      </ul>

      <div className="filters" role="group" aria-label="Фильтр по типу">
        {["all", ...KINDS].map((k) => (
          <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {k === "all" ? `Все (${parameters.length})` : `${k} (${counts[k]})`}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Тип</th><th>Параметр</th><th>Значение</th><th>Источник</th><th>Комментарий</th></tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.parameter}>
                <td><KindTag kind={p.kind} /></td>
                <td><span className="muted small">{p.group}</span><br />{p.parameter}</td>
                <td className="num">{formatValue(p)}</td>
                <td>{publisher[p.source_id] || <span className="muted">—</span>}</td>
                <td className="muted">{p.comment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
