import { useId, useState } from "react";
import { m } from "../data.js";

// Опубликованные значения (см. parameters.csv): гарантированная глубина и осадка.
const PERIODS = [
  { id: "before", label: "До 1 сентября", depth: 2.2 },
  { id: "after", label: "С 1 сентября", depth: 3.0 },
];
const SHIPS = [
  { id: "ballast", label: "В балласте", draft: 2.5, note: "2,2–2,5 м, берём верхнюю границу" },
  { id: "loaded", label: "Гружёное", draft: 2.9, note: "до 2,9 м" },
];

const W = 640, H = 300, TOP = 2.0, BOTTOM = -6.2;
const k = (H - 24) / (TOP - BOTTOM);
const y = (e) => 12 + (TOP - e) * k;
const CREST_X = 430;

function Segmented({ label, options, value, onChange }) {
  return (
    <fieldset className="seg">
      <legend>{label}</legend>
      {options.map((o) => (
        <label key={o.id} className={o.id === value ? "on" : ""}>
          <input type="radio" name={label} checked={o.id === value} onChange={() => onChange(o.id)} />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

export default function BarProfile() {
  const [periodId, setPeriod] = useState("before");
  const [shipId, setShip] = useState("loaded");
  const [surge, setSurge] = useState(0);
  const sliderId = useId();

  const period = PERIODS.find((p) => p.id === periodId);
  const ship = SHIPS.find((s) => s.id === shipId);
  const G = period.depth;
  const depth = G + surge;
  const clearance = depth - ship.draft;
  const passes = clearance >= 0;

  const ys = y(surge);
  const keel = y(surge - ship.draft);
  const bed = `M0,${y(-5.8)} C160,${y(-5.8)} 300,${y(-G)} ${CREST_X},${y(-G)} C520,${y(-G)} 560,${y(-4.2)} ${W},${y(-4.2)} L${W},${H} L0,${H} Z`;
  const hx0 = 150, hx1 = 330;
  const hull = `M${hx0},${y(surge + 0.9)} L${hx1},${y(surge + 0.9)} L${hx1 - 22},${keel} L${hx0 + 14},${keel} Z`;

  return (
    <figure className="bar-profile">
      <div className="controls">
        <Segmented label="Гарантированная глубина" options={PERIODS} value={periodId} onChange={setPeriod} />
        <Segmented label="Судно" options={SHIPS} value={shipId} onChange={setShip} />
        <div className="slider">
          <label htmlFor={sliderId}>
            Сгон / нагон: <b>{surge > 0 ? "+" : ""}{surge.toFixed(2).replace(".", ",")} м</b>
          </label>
          <input
            id={sliderId}
            type="range"
            min={-0.8}
            max={1.5}
            step={0.05}
            value={surge}
            onChange={(e) => setSurge(Number(e.target.value))}
          />
          <div className="slider-ends"><span>сгон −0,8</span><span>нагон +1,5</span></div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Разрез бара: глубина ${m(depth)}, осадка ${m(ship.draft)}`}>
        <rect className="water" x="0" y={ys} width={W} height={H - ys} />
        {surge !== 0 && (
          <g className="ref">
            <line x1="0" x2={W} y1={y(0)} y2={y(0)} />
            <text x={W - 6} y={surge > 0 ? y(0) + 15 : y(0) - 6} textAnchor="end">проектный уровень</text>
          </g>
        )}
        <line className="surface" x1="0" x2={W} y1={ys} y2={ys} />
        <path className="bed" d={bed} />
        <text className="bed-label" x={CREST_X} y={y(-G) + 40} textAnchor="middle">бар Яны</text>

        <line className={`keel-line ${passes ? "ok" : "bad"}`} x1={hx1 - 22} x2={W} y1={keel} y2={keel} />
        <path className="hull" d={hull} />
        <rect className="cabin" x={hx0 + 12} y={y(surge + 1.7)} width="46" height={y(surge + 0.9) - y(surge + 1.7)} />

        <g className="dim">
          <line x1={CREST_X} x2={CREST_X} y1={ys} y2={y(-G)} />
          <line x1={CREST_X - 6} x2={CREST_X + 6} y1={ys} y2={ys} />
          <line x1={CREST_X - 6} x2={CREST_X + 6} y1={y(-G)} y2={y(-G)} />
          <text x={CREST_X + 10} y={(ys + y(-G)) / 2 + 4}>{m(depth)}</text>
        </g>
        <g className="dim">
          <line x1={hx0 - 14} x2={hx0 - 14} y1={ys} y2={keel} />
          <text x={hx0 - 20} y={(ys + keel) / 2 + 4} textAnchor="end">осадка {m(ship.draft)}</text>
        </g>

        <text className="side" x="10" y={H - 12}>море Лаптевых</text>
        <text className="side" x={W - 10} y={H - 12} textAnchor="end">к Нижнеянску</text>
      </svg>

      <dl className="readout">
        <div><dt>Глубина над баром</dt><dd>{m(depth)}</dd></div>
        <div><dt>Осадка судна</dt><dd>{m(ship.draft)}</dd></div>
        <div className={passes ? "ok" : "bad"}>
          <dt>Запас под килем</dt>
          <dd>
            <span aria-hidden="true">{passes ? "✓" : "✕"}</span> {clearance > 0 ? "+" : ""}{m(clearance)}
            <small>{passes ? "проходит" : "не проходит"}</small>
          </dd>
        </div>
      </dl>
      <figcaption>
        Иллюстрация опубликованных глубин на баре и осадок морских судов ({ship.note}), не результат модели:
        бар в расчёт не входит. Ползунок условный, требуемый запас под килем не учтён.
      </figcaption>
    </figure>
  );
}
