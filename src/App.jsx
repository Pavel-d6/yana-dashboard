import { useEffect, useState } from "react";
import { loadIndex, scenarioTitle } from "./model.js";
import ScenarioPicker from "./components/ScenarioPicker.jsx";
import Compare from "./screens/Compare.jsx";
import Schedule from "./screens/Schedule.jsx";
import Scenarios from "./screens/Scenarios.jsx";
import Overview from "./screens/Overview.jsx";

const TABS = [
  ["compare", "Сравнение стратегий"],
  ["schedule", "Расписание"],
  ["scenarios", "Сценарии"],
  ["overview", "Обзор и ограничения"],
];
const DEFAULT_SCENARIO = "r1_baseline";

function readHash() {
  const [tab, id] = window.location.hash.replace(/^#\/?/, "").split("/");
  return { tab: TABS.some(([t]) => t === tab) ? tab : "compare", id: id || null };
}

export default function App() {
  const [scenarios, setScenarios] = useState(null);
  const [error, setError] = useState(null);
  const [{ tab, id }, setRoute] = useState(readHash);

  useEffect(() => { loadIndex().then(setScenarios).catch((e) => setError(e.message)); }, []);
  useEffect(() => {
    const on = () => setRoute(readHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const go = (nextTab, nextId = id) => { window.location.hash = `/${nextTab}${nextId ? `/${nextId}` : ""}`; };

  const current = scenarios && (scenarios.find((s) => s.scenario_id === id) || scenarios.find((s) => s.scenario_id === DEFAULT_SCENARIO) || scenarios[0]);
  const withScenario = tab === "compare" || tab === "schedule";

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <b>Северный завоз по Яне</b>
          <span className="muted">планирование речных перевозок, кейс А3</span>
        </div>
        <nav aria-label="Экраны">
          {TABS.map(([t, label]) => (
            <a key={t} href={`#/${t}${id ? `/${id}` : ""}`} aria-current={tab === t ? "page" : undefined}>{label}</a>
          ))}
        </nav>
      </header>

      <main>
        {error && tab !== "overview" && <p className="error">{error}</p>}
        {!error && !scenarios && tab !== "overview" && <p className="muted">Загружаем результаты…</p>}
        {current && withScenario && (
          <>
            <ScenarioPicker scenarios={scenarios} current={current} onSelect={(sid) => go(tab, sid)} />
            <p className="scenario-title">{scenarioTitle(current)}</p>
          </>
        )}
        {current && tab === "compare" && <Compare scenarios={scenarios} current={current} onSelect={(sid) => go("compare", sid)} />}
        {current && tab === "schedule" && <Schedule current={current} />}
        {current && tab === "scenarios" && <Scenarios scenarios={scenarios} current={current} onOpen={(sid) => go("compare", sid)} />}
        {tab === "overview" && <Overview />}
      </main>

      <footer className="muted small">
        Результаты — расчёты оптимизатора 2.1.0 на синтетических входных данных: математический эксперимент, не прогноз
        фактического завоза. Данные лежат в public/data.
      </footer>
    </div>
  );
}
