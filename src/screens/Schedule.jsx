import { useEffect, useMemo, useRef, useState } from "react";
import { CARGO, STRATEGIES, cumulative, dateTime, dayMonth, days, loadScenario, n0, n1, ts } from "../model.js";

const W = 1000, L = 118, R = 14;

function useTimeScale(detail) {
  return useMemo(() => {
    const all = STRATEGIES.flatMap((k) => detail.strategies[k].trips);
    const t0 = Math.min(...all.map((t) => ts(t.loading_start)));
    const t1 = Math.max(...all.map((t) => ts(t.released_at)));
    const x = (ms) => L + ((ms - t0) / (t1 - t0)) * (W - L - R);
    const ticks = [];
    const d = new Date(t0);
    d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0);
    for (;;) {
      for (const day of [1, 15]) {
        const ms = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), day);
        if (ms >= t0 && ms <= t1) ticks.push(ms);
      }
      d.setUTCMonth(d.getUTCMonth() + 1);
      if (d.getTime() > t1) break;
    }
    return { t0, t1, x, ticks };
  }, [detail]);
}

function Tooltip({ tip }) {
  if (!tip) return null;
  return (
    <div className="tooltip" style={{ left: tip.x, top: tip.y }} role="status">
      {tip.lines.map((l, i) => (i === 0 ? <b key={i}>{l}</b> : <div key={i}>{l}</div>))}
    </div>
  );
}

function Gantt({ detail, scale, capacity }) {
  const box = useRef(null);
  const [tip, setTip] = useState(null);
  const units = useMemo(
    () => [...new Set(STRATEGIES.flatMap((k) => detail.strategies[k].trips.map((t) => t.unit_id)))].sort(),
    [detail]
  );
  const lane = 20, unitH = lane * 2 + 16, top = 26;
  const H = top + units.length * unitH + 6;
  const { x, ticks } = scale;

  const show = (e, t, k) => {
    const r = box.current.getBoundingClientRect();
    const cap = capacity[t.unit_id];
    setTip({
      x: Math.min(e.clientX - r.left + 12, r.width - 250),
      y: e.clientY - r.top + 14,
      lines: [
        `${k} · рейс ${t.trip_id} · ${t.unit_id}`,
        `${CARGO[t.cargo_type]}, ${n0(t.volume_t)} т${cap ? ` (загрузка ${n0((t.volume_t / cap) * 100)}%)` : ""}`,
        `Погрузка ${dateTime(t.loading_start)} → разгрузка ${dateTime(t.unloading_end)}`,
        `Возврат ${dateTime(t.released_at)}, всего ${n1(days(t.loading_start, t.released_at))} сут.`,
        t.on_time == null ? "Срок партии неизвестен" : `Срок ${dayMonth(ts(t.due_date))}: ${t.on_time ? "в срок" : "с опозданием"}`,
      ],
    });
  };

  return (
    <div className="chart-box" ref={box} onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Диаграмма Ганта рейсов по составам">
        {ticks.map((ms) => (
          <g key={ms}>
            <line className="grid" x1={x(ms)} x2={x(ms)} y1={top - 6} y2={H} />
            <text className="tick-label" x={x(ms)} y="12" textAnchor="middle">{dayMonth(ms)}</text>
          </g>
        ))}
        {units.map((u, i) => (
          <g key={u} transform={`translate(0 ${top + i * unitH})`}>
            <text className="unit-label" x="0" y={lane + 4}>{u}</text>
            {STRATEGIES.map((k, j) => (
              <g key={k} transform={`translate(0 ${j * lane})`}>
                <text className="lane-label" x={L - 8} y={lane / 2 + 3} textAnchor="end">{k === "FCFS" ? "FCFS" : "OPT"}</text>
                {detail.strategies[k].trips.filter((t) => t.unit_id === u).map((t) => {
                  const a = x(ts(t.loading_start)), b = x(ts(t.unloading_end)), c = x(ts(t.released_at));
                  const cls = `trip ${k.toLowerCase()} ${t.on_time === false ? "late" : ""}`;
                  return (
                    <g key={t.trip_id} className={cls} onMouseMove={(e) => show(e, t, k)}>
                      <rect className="work" x={a + 1} y="2" width={Math.max(b - a - 1, 1)} height={lane - 5} rx="2" />
                      <rect className="back" x={b} y={lane / 2 - 2} width={Math.max(c - b - 1, 0.5)} height="3" />
                    </g>
                  );
                })}
              </g>
            ))}
          </g>
        ))}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

function DraftStrip({ detail, scale }) {
  const rows = detail.daily_allowed_draft_m;
  if (!rows) return <p className="muted small">Входной каталог этого сценария в архив не входит, поэтому допустимые осадки не показаны.</p>;
  const H = 96, top = 8, bottom = 72;
  const max = Math.max(...rows.map((r) => r[1]), 1.2) * 1.08;
  const y = (v) => bottom - (v / max) * (bottom - top);
  const inRange = rows.filter(([d]) => ts(d) >= scale.t0 - 864e5 && ts(d) <= scale.t1);
  const path = inRange.map(([d, v], i) => `${i ? "L" : "M"}${scale.x(Math.max(ts(d), scale.t0))},${y(v)} L${scale.x(Math.min(ts(d) + 864e5, scale.t1))},${y(v)}`).join(" ");
  const full = Math.max(...(detail.units || []).map((u) => u.draft_full_m), 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Допустимая осадка по дням">
      {[0, 0.5, 1, 1.5].filter((v) => v < max).map((v) => (
        <g key={v}>
          <line className="grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
          <text className="tick-label" x={L - 8} y={y(v) + 4} textAnchor="end">{n1(v)} м</text>
        </g>
      ))}
      {full > 0 && (
        <g>
          <line className="ref-line" x1={L} x2={W - R} y1={y(full)} y2={y(full)} />
          <text className="tick-label" x={W - R} y={y(full) - 4} textAnchor="end">осадка баржи в полном грузу {n1(full)} м</text>
        </g>
      )}
      <path className="draft-line" d={path} />
      {scale.ticks.map((ms) => (
        <text key={ms} className="tick-label" x={scale.x(ms)} y={H - 6} textAnchor="middle">{dayMonth(ms)}</text>
      ))}
    </svg>
  );
}

function Cumulative({ detail, scale, onlyOnTime }) {
  const box = useRef(null);
  const [cursor, setCursor] = useState(null);
  const series = useMemo(
    () => Object.fromEntries(STRATEGIES.map((k) => [k, cumulative(detail.strategies[k].trips, onlyOnTime)])),
    [detail, onlyOnTime]
  );
  const H = 300, top = 16, bottom = 262;
  const maxV = Math.max(...STRATEGIES.map((k) => series[k].at(-1)?.[1] ?? 0), 1);
  const step = maxV > 8000 ? 4000 : maxV > 3000 ? 2000 : 1000;
  const yMax = Math.ceil(maxV / step) * step;
  const y = (v) => bottom - (v / yMax) * (bottom - top);
  const { x, t0, t1, ticks } = scale;
  const path = (pts) => {
    let d = `M${x(t0)},${y(0)}`, prev = 0;
    for (const [ms, v] of pts) { d += ` L${x(ms)},${y(prev)} L${x(ms)},${y(v)}`; prev = v; }
    return `${d} L${x(t1)},${y(prev)}`;
  };
  const at = (pts, ms) => { let v = 0; for (const p of pts) { if (p[0] <= ms) v = p[1]; else break; } return v; };
  const move = (e) => {
    const r = box.current.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    if (sx < L || sx > W - R) return setCursor(null);
    const ms = t0 + ((sx - L) / (W - L - R)) * (t1 - t0);
    setCursor({ ms, px: e.clientX - r.left, width: r.width });
  };

  return (
    <div className="chart-box" ref={box} onMouseMove={move} onMouseLeave={() => setCursor(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Накопленная доставка по дням">
        {Array.from({ length: yMax / step + 1 }, (_, i) => i * step).map((v) => (
          <g key={v}>
            <line className="grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
            <text className="tick-label" x={L - 8} y={y(v) + 4} textAnchor="end">{n0(v)}</text>
          </g>
        ))}
        {ticks.map((ms) => (
          <text key={ms} className="tick-label" x={x(ms)} y={H - 16} textAnchor="middle">{dayMonth(ms)}</text>
        ))}
        {STRATEGIES.map((k) => {
          const last = series[k].at(-1)?.[1] ?? 0;
          return (
            <g key={k}>
              <path className={`cum ${k.toLowerCase()}`} d={path(series[k])} />
              <text className="end-label" x={W - R - 4} y={y(last) - 7} textAnchor="end">{k} {n0(last)} т</text>
            </g>
          );
        })}
        {cursor && <line className="cross" x1={x(cursor.ms)} x2={x(cursor.ms)} y1={top} y2={bottom} />}
        {cursor && STRATEGIES.map((k) => (
          <circle key={k} className={`cum-dot ${k.toLowerCase()}`} cx={x(cursor.ms)} cy={y(at(series[k], cursor.ms))} r="4.5" />
        ))}
      </svg>
      {cursor && (
        <Tooltip tip={{
          x: Math.min(cursor.px + 14, cursor.width - 210), y: 20,
          lines: [`На ${dayMonth(cursor.ms)}`, ...STRATEGIES.map((k) => `${k}: ${n0(at(series[k], cursor.ms))} т`)],
        }} />
      )}
    </div>
  );
}

function TripsTable({ trips, capacity }) {
  return (
    <div className="table-wrap scroll">
      <table className="metrics">
        <thead>
          <tr>
            <th>Рейс</th><th>Состав</th><th>Груз</th><th className="r">Тонн</th><th className="r">Загрузка</th>
            <th>Погрузка</th><th>Разгрузка</th><th>Возврат</th><th className="r">Сутки</th><th>Срок</th>
          </tr>
        </thead>
        <tbody>
          {trips.map((t) => (
            <tr key={t.trip_id}>
              <td>{t.trip_id}</td><td>{t.unit_id}</td><td>{CARGO[t.cargo_type]}</td>
              <td className="r">{n0(t.volume_t)}</td>
              <td className="r">{capacity[t.unit_id] ? `${n0((t.volume_t / capacity[t.unit_id]) * 100)}%` : "—"}</td>
              <td>{dateTime(t.loading_start)}</td><td>{dateTime(t.unloading_end)}</td><td>{dateTime(t.released_at)}</td>
              <td className="r">{n1(days(t.loading_start, t.released_at))}</td>
              <td className={t.on_time === false ? "worse" : ""}>
                {t.on_time == null ? "—" : `${dayMonth(ts(t.due_date))}, ${t.on_time ? "в срок" : "опоздание"}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Toggle({ value, onChange, options, label }) {
  return (
    <div className="filters" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  );
}

export default function Schedule({ current }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("on_time");
  const [tableStrategy, setTableStrategy] = useState("OPTIMIZED");

  useEffect(() => {
    let live = true;
    setDetail(null); setError(null);
    loadScenario(current.scenario_id).then((d) => live && setDetail(d)).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [current.scenario_id]);

  if (error) return <p className="error">{error}</p>;
  if (!detail) return <p className="muted">Загружаем расписание…</p>;
  return <ScheduleBody detail={detail} mode={mode} setMode={setMode} tableStrategy={tableStrategy} setTableStrategy={setTableStrategy} />;
}

function ScheduleBody({ detail, mode, setMode, tableStrategy, setTableStrategy }) {
  const scale = useTimeScale(detail);
  const capacity = useMemo(() => Object.fromEntries((detail.units || []).map((u) => [u.unit_id, u.capacity_t])), [detail]);
  const trips = detail.strategies[tableStrategy].trips;
  return (
    <>
      <section className="first">
        <h2>Рейсы по составам</h2>
        <ul className="legend">
          <li><span className="sw fcfs" /> FCFS</li>
          <li><span className="sw optimized" /> OPTIMIZED</li>
          <li><span className="sw late" /> рейс с опозданием (светлая заливка)</li>
          <li><span className="sw back" /> возврат порожнём</li>
        </ul>
        <Gantt detail={detail} scale={scale} capacity={capacity} />
        <h3 className="sub">Допустимая осадка по сценарию, минимум по участкам</h3>
        <DraftStrip detail={detail} scale={scale} />
        <p className="muted small">Сценарные глубины, заданные на входе модели. Это не измеренная гидрология и не прогноз.</p>
      </section>

      <section>
        <h2>Накопленная доставка, т</h2>
        <Toggle label="Что считать" value={mode} onChange={setMode} options={[["on_time", "Доставлено в срок"], ["total", "Доставлено всего"]]} />
        <Cumulative detail={detail} scale={scale} onlyOnTime={mode === "on_time"} />
        <p className="muted small">Ступенька — окончание разгрузки рейса. Считается по сохранённым рейсам расписания.</p>
      </section>

      <section>
        <h2>Список рейсов</h2>
        <Toggle label="Стратегия" value={tableStrategy} onChange={setTableStrategy} options={STRATEGIES.map((k) => [k, `${k} (${detail.strategies[k].trips.length})`])} />
        <TripsTable trips={trips} capacity={capacity} />
      </section>
    </>
  );
}
