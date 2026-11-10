import { useMemo, useState } from "react";
import { DEPTH, FAMILY, TIMING, n0, n1, relPct, signed } from "../model.js";

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const GRID = ["baseline", "demand_plus30", "fleet_minus20", "navigation_minus10"];

function FactorChart({ title, note, groups, max }) {
  return (
    <div className="factor">
      <h3>{title}</h3>
      {groups.map((g) => (
        <div className="factor-row" key={g.label}>
          <div className="factor-name">{g.label}<span className="muted small"> · {g.n} сц.</span></div>
          <div className="factor-bars">
            {[["fcfs", g.fcfs], ["optimized", g.opt]].map(([k, v]) => (
              <div className="factor-bar" key={k}>
                <span className={`mini-bar ${k}`} style={{ width: `${(v / max) * 100}%` }} />
                <span className="factor-value">{n0(v)}</span>
              </div>
            ))}
          </div>
          <div className="factor-gain">{signed(g.opt - g.fcfs)} т</div>
        </div>
      ))}
      {note && <p className="muted small">{note}</p>}
    </div>
  );
}

export default function Scenarios({ scenarios, current, onOpen }) {
  const [family, setFamily] = useState("all");
  const [sort, setSort] = useState("gain");

  const stats = useMemo(() => {
    const on = (s, k) => s.metrics[k].delivered_on_time_t;
    const group = (list, key, labels) =>
      Object.keys(labels)
        .map((v) => [v, list.filter((s) => s[key] === v)])
        .filter(([, l]) => l.length)
        .map(([v, l]) => ({ label: labels[v], n: l.length, fcfs: mean(l.map((s) => on(s, "FCFS"))), opt: mean(l.map((s) => on(s, "OPTIMIZED"))) }));
    const grid = scenarios.filter((s) => GRID.includes(s.family));
    const f = group(scenarios, "family", FAMILY), d = group(grid, "depth", DEPTH), t = group(grid, "timing", TIMING);
    return { f, d, t, max: Math.max(...[...f, ...d, ...t].map((g) => g.opt)) * 1.02 };
  }, [scenarios]);

  const rows = useMemo(() => {
    const list = scenarios
      .filter((s) => family === "all" || s.family === family)
      .map((s) => ({ s, f: s.metrics.FCFS, o: s.metrics.OPTIMIZED, gain: s.metrics.OPTIMIZED.delivered_on_time_t - s.metrics.FCFS.delivered_on_time_t }));
    const key = { gain: (r) => -r.gain, opt: (r) => -r.o.delivered_on_time_t, undelivered: (r) => -r.o.undelivered_t, id: null }[sort];
    return key ? list.sort((a, b) => key(a) - key(b)) : list;
  }, [scenarios, family, sort]);

  return (
    <>
      <section className="first">
        <h2>Как условия меняют доставку в срок</h2>
        <p className="lead">Среднее по сценариям группы, т. Верхняя полоса — FCFS, нижняя — OPTIMIZED, справа — разница.</p>
        <ul className="legend">
          <li><span className="sw fcfs" /> FCFS</li>
          <li><span className="sw optimized" /> OPTIMIZED</li>
        </ul>
        <div className="factors">
          <FactorChart title="Флот, спрос, окно навигации" groups={stats.f} max={stats.max}
            note="Дефицит и избыток флота — по 3 сценария; их входные каталоги в переданный архив не входят." />
          <FactorChart title="Глубины" groups={stats.d} max={stats.max} />
          <FactorChart title="Сроки готовности грузов" groups={stats.t} max={stats.max} />
        </div>
        <p className="muted small">
          Это сравнение заранее рассчитанных сценариев. Значения нельзя пропорционально пересчитывать под другие
          параметры: для новых условий нужен новый расчёт оптимизатора. Группы — вариации заданных условий, а не
          оценка вероятностей.
        </p>
      </section>

      <section>
        <h2>Все сценарии</h2>
        <p className="lead">Нажмите на название, чтобы открыть сравнение по сценарию.</p>
        <div className="table-tools">
          <label className="pick"><span>Условия</span>
            <select value={family} onChange={(e) => setFamily(e.target.value)}>
              <option value="all">Все ({scenarios.length})</option>
              {Object.entries(FAMILY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="pick"><span>Сортировка</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="gain">По приросту в срок</option>
              <option value="opt">По доставке в срок, OPTIMIZED</option>
              <option value="undelivered">По недоставленному, OPTIMIZED</option>
              <option value="id">По названию</option>
            </select>
          </label>
        </div>
        <div className="table-wrap scroll">
          <table className="metrics dense">
            <thead>
              <tr>
                <th>Сценарий</th><th>Условия</th><th>Глубины</th><th>Готовность</th>
                <th className="r">FCFS в срок</th><th className="r">OPTIMIZED в срок</th>
                <th className="r">Прирост, т</th><th className="r">Прирост, %</th><th className="r">Не доставлено, OPT</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ s, f, o, gain }) => (
                <tr key={s.scenario_id} className={s.scenario_id === current.scenario_id ? "selected" : ""}>
                  <td><button type="button" className="link" onClick={() => onOpen(s.scenario_id)}><code>{s.scenario_id}</code></button></td>
                  <td>{FAMILY[s.family]}</td><td>{DEPTH[s.depth]}</td><td>{TIMING[s.timing]}</td>
                  <td className="r">{n0(f.delivered_on_time_t)}</td>
                  <td className="r"><b>{n0(o.delivered_on_time_t)}</b></td>
                  <td className="r">{signed(gain)}</td>
                  <td className="r muted">{signed(relPct(o.delivered_on_time_t, f.delivered_on_time_t), n1)}%</td>
                  <td className="r">{n0(o.undelivered_t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
