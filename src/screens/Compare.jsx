import { useMemo, useState } from "react";
import { CARGO, SOCIAL, STRATEGIES, n0, n1, relPct, signed } from "../model.js";

const pctText = (p) => (p == null ? "—" : `${signed(p, n1)}%`);

function OutcomeBars({ s }) {
  const demand = s.metrics.FCFS.delivered_total_t + s.metrics.FCFS.undelivered_t;
  return (
    <div className="outcome">
      {STRATEGIES.map((k) => {
        const m = s.metrics[k];
        const late = m.delivered_total_t - m.delivered_on_time_t;
        const w = (v) => `${(v / demand) * 100}%`;
        return (
          <div className="outcome-row" key={k}>
            <div className="outcome-name">{k}</div>
            <div className={`outcome-bar ${k.toLowerCase()}`} role="img"
              aria-label={`${k}: в срок ${n0(m.delivered_on_time_t)} т, с опозданием ${n0(late)} т, не доставлено ${n0(m.undelivered_t)} т`}>
              <span className="seg-on" style={{ width: w(m.delivered_on_time_t) }} />
              <span className="seg-late" style={{ width: w(late) }} />
            </div>
            <div className="outcome-nums">
              <b>{n0(m.delivered_on_time_t)} т</b> в срок
              <span className="muted"> · {n0(late)} т с опозданием · {n0(m.undelivered_t)} т не доставлено</span>
            </div>
          </div>
        );
      })}
      <p className="muted small">
        Полная ширина полосы — весь спрос сценария, {n0(demand)} т. Насыщенный цвет — доставлено в срок, светлый —
        с опозданием, пустая часть — не доставлено.
      </p>
    </div>
  );
}

function MetricsTable({ s }) {
  const f = s.metrics.FCFS, o = s.metrics.OPTIMIZED;
  const rows = [
    ["Доставлено в срок, т", f.delivered_on_time_t, o.delivered_on_time_t, n0, 1],
    ["Доставлено всего, т", f.delivered_total_t, o.delivered_total_t, n0, 1],
    ["Не доставлено, т", f.undelivered_t, o.undelivered_t, n0, -1],
    ["Рейсов", f.completed_trips, o.completed_trips, n0, 0],
    ["Среднее время доставки, сут.", f.average_delivery_days, o.average_delivery_days, n1, -1],
    ["Доля в срок от доставленного, %", (f.delivered_on_time_t / f.delivered_total_t) * 100, (o.delivered_on_time_t / o.delivered_total_t) * 100, n1, 1, "п.п."],
  ];
  return (
    <div className="table-wrap">
      <table className="metrics">
        <thead>
          <tr><th>Показатель</th><th className="r">FCFS</th><th className="r">OPTIMIZED</th><th className="r">Разница</th><th className="r">Разница, %</th></tr>
        </thead>
        <tbody>
          {rows.map(([name, a, b, fmt, good, unit]) => {
            const d = b - a;
            const cls = good === 0 || Math.abs(d) < 1e-9 ? "" : d * good > 0 ? "better" : "worse";
            return (
              <tr key={name}>
                <td>{name}</td>
                <td className="r">{fmt(a)}</td>
                <td className="r"><b>{fmt(b)}</b></td>
                <td className={`r ${cls}`}>{signed(d, fmt)}{unit ? ` ${unit}` : ""}{cls && <small> {cls === "better" ? "лучше" : "хуже"}</small>}</td>
                <td className="r muted">{unit ? "—" : pctText(relPct(b, a))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CargoTable({ s }) {
  return (
    <div className="table-wrap">
      <table className="metrics">
        <thead>
          <tr>
            <th>Груз</th><th className="r">Спрос, т</th>
            <th className="r">FCFS: в срок / всего</th><th className="r">OPTIMIZED: в срок / всего</th>
            <th className="r">Разница всего, т</th><th>Доставлено от спроса</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(CARGO).filter((c) => s.by_type[c]).map((c) => {
            const t = s.by_type[c], f = t.FCFS, o = t.OPTIMIZED;
            const d = o.delivered_t - f.delivered_t;
            const worse = d < -1e-6;
            return (
              <tr key={c} className={SOCIAL.includes(c) ? "social" : ""}>
                <td>{CARGO[c]}{worse && <span className="flag">хуже, чем FCFS</span>}</td>
                <td className="r">{n0(t.demand_t)}</td>
                <td className="r">{n0(f.on_time_t)} / {n0(f.delivered_t)}</td>
                <td className="r"><b>{n0(o.on_time_t)} / {n0(o.delivered_t)}</b></td>
                <td className={`r ${worse ? "worse" : d > 1e-6 ? "better" : ""}`}>{signed(d)}</td>
                <td>
                  <div className="mini">
                    <span className="mini-bar fcfs" style={{ width: `${(f.delivered_t / t.demand_t) * 100}%` }} />
                  </div>
                  <div className="mini">
                    <span className="mini-bar optimized" style={{ width: `${(o.delivered_t / t.demand_t) * 100}%` }} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GainStrip({ scenarios, current, onSelect }) {
  const [hover, setHover] = useState(null);
  const pts = useMemo(
    () => scenarios.map((s) => ({ s, g: s.metrics.OPTIMIZED.delivered_on_time_t - s.metrics.FCFS.delivered_on_time_t })).sort((a, b) => a.g - b.g),
    [scenarios]
  );
  const max = Math.ceil(Math.max(...pts.map((p) => p.g)) / 2000) * 2000;
  const mean = pts.reduce((a, p) => a + p.g, 0) / pts.length;
  const W = 1000, L = 10, R = 34, x = (g) => L + (g / max) * (W - L - R);
  // Точки не накладываются: каждая встаёт на первый свободный ярус.
  const placed = [];
  for (const p of pts) {
    let level = 0;
    while (placed.some((q) => q.level === level && Math.abs(x(q.g) - x(p.g)) < 11)) level++;
    placed.push({ ...p, level });
  }
  const levels = Math.max(...placed.map((p) => p.level)) + 1;
  const base = 14 + levels * 11, H = base + 30;
  const shown = hover || pts.find((p) => p.s.scenario_id === current.scenario_id);
  return (
    <div className="strip">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Прирост доставки в срок по всем сценариям">
        <line className="axis" x1={L} x2={W - R} y1={base} y2={base} />
        {Array.from({ length: max / 2000 + 1 }, (_, i) => i * 2000).map((v) => (
          <g key={v}>
            <line className="tick" x1={x(v)} x2={x(v)} y1={base} y2={base + 6} />
            <text className="tick-label" x={x(v)} y={base + 22} textAnchor="middle">{n0(v)}</text>
          </g>
        ))}
        <line className="mean" x1={x(mean)} x2={x(mean)} y1="4" y2={base} />
        <text className="mean-label" x={x(mean) + 6} y="12">среднее {n0(mean)} т</text>
        {placed.map((p) => {
          const on = p.s.scenario_id === current.scenario_id;
          return (
            <circle key={p.s.scenario_id} className={on ? "dot on" : "dot"} cx={x(p.g)} cy={base - 8 - p.level * 11} r={on ? 7 : 4.5}
              onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)} onClick={() => onSelect(p.s.scenario_id)}>
              <title>{`${p.s.scenario_id}: ${signed(p.g)} т`}</title>
            </circle>
          );
        })}
      </svg>
      <p className="small">
        <b>{shown.s.scenario_id}</b>: {signed(shown.g)} т в срок{hover ? ". Нажмите, чтобы открыть сценарий" : " (выбранный сценарий)"}
      </p>
    </div>
  );
}

export default function Compare({ scenarios, current, onSelect }) {
  const f = current.metrics.FCFS, o = current.metrics.OPTIMIZED;
  const gain = o.delivered_on_time_t - f.delivered_on_time_t;
  const ratio = f.delivered_on_time_t > 0 ? o.delivered_on_time_t / f.delivered_on_time_t : null;
  const foodWorse = useMemo(
    () => scenarios.filter((s) => SOCIAL.some((c) => s.by_type[c] && s.by_type[c].OPTIMIZED.delivered_t < s.by_type[c].FCFS.delivered_t - 1e-6)).length,
    [scenarios]
  );
  const wins = scenarios.filter((s) => s.metrics.OPTIMIZED.delivered_on_time_t > s.metrics.FCFS.delivered_on_time_t).length;

  return (
    <>
      <section className="first">
        <h1 className="verdict">
          OPTIMIZED доставляет в срок {n0(o.delivered_on_time_t)} т, FCFS — {n0(f.delivered_on_time_t)} т
        </h1>
        <p className="verdict-sub">
          {signed(gain)} т при тех же судах, грузах и глубинах{ratio ? `, в ${n1(ratio)} раза больше` : ""}.
          Всего доставлено {signed(o.delivered_total_t - f.delivered_total_t)} т, рейсов {signed(o.completed_trips - f.completed_trips)}.
        </p>
        <OutcomeBars s={current} />
      </section>

      <section>
        <h2>Показатели сценария</h2>
        <MetricsTable s={current} />
        <p className="muted small">
          Откуда выигрыш: FCFS берёт партии в порядке готовности и часто привозит их после срока. OPTIMIZED сначала
          максимизирует тоннаж в срок, затем весь доставленный тоннаж, затем сокращает число рейсов. Суда, грузы и
          допустимые осадки у обеих стратегий одинаковые.
        </p>
      </section>

      <section>
        <h2>По видам груза</h2>
        <CargoTable s={current} />
        <aside className="callout">
          <h3>Продовольствие оптимизатор пока не защищает</h3>
          <p>
            Минимальные нормативы по социально значимым грузам в цель оптимизации не включены. В {foodWorse} из{" "}
            {scenarios.length} сценариев OPTIMIZED доставляет продовольствия меньше, чем FCFS. Общий выигрыш в тоннах
            не означает, что лучше стало по каждому грузу.
          </p>
        </aside>
      </section>

      <section>
        <h2>Прирост доставки в срок во всех {scenarios.length} сценариях, т</h2>
        <p className="lead">
          OPTIMIZED лучше FCFS в {wins} из {scenarios.length}. Каждая точка — один сценарий.
        </p>
        <GainStrip scenarios={scenarios} current={current} onSelect={onSelect} />
        <p className="muted small">
          Сценарии — вариации заданных условий (спрос, флот, окно навигации, глубины, сроки готовности), а не случайные
          повторения. Разброс не является оценкой вероятности. Это математический эксперимент на синтетических данных,
          а не прогноз фактического улучшения северного завоза.
        </p>
      </section>
    </>
  );
}
