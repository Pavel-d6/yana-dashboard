"""Готовит данные дашборда из результатов оптимизатора Case A3.

Запуск:  python tools/export_data.py <папка Case_a3> [<папка вывода>]

Скрипт ничего не пересчитывает за оптимизатор: метрики берутся из comparison_final.csv,
разбивка по грузам — из ml_scenario_results.csv, рейсы — из final_results/*/{fcfs,optimized}.json.
Единственные производные: срок партии присоединяется к рейсу по cargo_id из cargo.csv
(признак «в срок» = разгрузка не позже срока, как в RESULT_CONTRACT.md) и сверяется с метрикой.
"""
import csv
import json
import re
import sys
from pathlib import Path

LEGACY = {  # старое имя результата -> каталог входных данных с тем же составом
    "baseline": "baseline_central_central",
    "shallow": "baseline_shallow_central",
    "high_demand": "demand_plus30_central_central",
    "short_navigation": "navigation_minus10_central_central",
    "scarce_fleet": None,
    "excess_fleet": None,
}
STRATS = {"FCFS": "fcfs", "OPTIMIZED": "optimized"}
METRICS = ["delivered_on_time_t", "delivered_total_t", "undelivered_t", "completed_trips",
           "vessel_idle_days", "fleet_utilization", "average_delivery_days", "violations"]


def rows(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def factors(variant):
    m = re.fullmatch(r"(baseline|demand_plus30|fleet_minus20|navigation_minus10)_(shallow|central|deep)_(early|central|late)", variant)
    if m:
        return {"family": m[1], "depth": m[2], "timing": m[3]}
    return {
        "baseline": {"family": "baseline", "depth": "central", "timing": "central"},
        "shallow": {"family": "baseline", "depth": "shallow", "timing": "central"},
        "high_demand": {"family": "demand_plus30", "depth": "central", "timing": "central"},
        "short_navigation": {"family": "navigation_minus10", "depth": "central", "timing": "central"},
        "scarce_fleet": {"family": "scarce_fleet", "depth": "central", "timing": "central"},
        "excess_fleet": {"family": "excess_fleet", "depth": "central", "timing": "central"},
    }[variant]


def input_summary(sdir):
    cargo, units, cond = rows(sdir / "cargo.csv"), rows(sdir / "units.csv"), rows(sdir / "conditions.csv")
    draft = [float(c["max_allowed_draft_m"]) for c in cond]
    return {
        "cargo_batches": len(cargo),
        "demand_t": round(sum(float(c["volume_t"]) for c in cargo), 3),
        "units": len(units),
        "capacity_t": sum(float(u["capacity_t"]) for u in units),
        "available_from": min(u["available_from"][:10] for u in units),
        "available_to": max(u["available_to"][:10] for u in units),
        "ready_from": min(c["ready_date"][:10] for c in cargo),
        "ready_to": max(c["ready_date"][:10] for c in cargo),
        "closed_segment_days": sum(int(c["is_closed"]) for c in cond),
        "allowed_draft_min_m": min(draft),
        "allowed_draft_mean_m": round(sum(draft) / len(draft), 3),
        "allowed_draft_max_m": max(draft),
    }


def daily_draft(sdir):
    """Минимальная по участкам допустимая осадка на каждую дату (входные данные сценария)."""
    by = {}
    for c in rows(sdir / "conditions.csv"):
        d = c["date"][:10]
        v = 0.0 if c["is_closed"] == "1" else float(c["max_allowed_draft_m"])
        by[d] = min(by.get(d, 99), v)
    return [[d, by[d]] for d in sorted(by)]


def main(src, out):
    src, out = Path(src), Path(out)
    (out / "scenarios").mkdir(parents=True, exist_ok=True)
    metrics, by_type = {}, {}
    for r in rows(src / "comparison_final.csv"):
        m = {k: (int(r[k]) if k in ("completed_trips", "violations") else float(r[k])) for k in METRICS}
        metrics.setdefault(r["scenario_id"], {"replicate": int(r["replicate"]), "variant": r["variant"]})[r["strategy"]] = m
    for r in rows(src / "ml_scenario_results.csv"):
        t = by_type.setdefault(r["scenario_id"], {}).setdefault(r["cargo_type"], {"demand_t": float(r["demand_t"])})
        t[r["strategy"]] = {"delivered_t": float(r["delivered_t"]), "on_time_t": float(r["on_time_t"])}

    index, problems = [], []
    for sid in sorted(metrics):
        meta = metrics[sid]
        variant, rep = meta["variant"], meta["replicate"]
        own = src / "data" / "scenarios" / sid
        if own.is_dir():
            sdir, input_note = own, "own"
        else:
            mapped = LEGACY.get(variant)
            sdir = src / "data" / "scenarios" / f"r{rep}_{mapped}" if mapped else None
            input_note = "matched" if sdir else "missing"
        # сроки партий: свой каталог, сопоставленный или базовый той же реплики (для флота)
        cargo_dir = sdir or src / "data" / "scenarios" / f"r{rep}_baseline_central_central"
        cargo = {c["cargo_id"]: c for c in rows(cargo_dir / "cargo.csv")}

        detail = {"scenario_id": sid, "strategies": {}}
        on_time_ok = True
        for strat, fname in STRATS.items():
            res = json.loads((src / "final_results" / sid / f"{fname}.json").read_text(encoding="utf-8"))
            if any(abs(res["metrics"][k] - meta[strat][k]) > 1e-6 for k in METRICS):
                problems.append(f"{sid}/{strat}: метрики JSON и comparison_final.csv расходятся")
            vols = {k: res["delivered_by_cargo_t"][k] + res["remaining_by_cargo_t"][k] for k in res["delivered_by_cargo_t"]}
            cargo_ok = set(vols) == set(cargo) and all(abs(vols[k] - float(cargo[k]["volume_t"])) < 1e-3 for k in vols)
            trips, on_time_sum = [], 0.0
            for t in res["trips"]:
                due = cargo[t["cargo_id"]]["due_date"] if cargo_ok else None
                on_time = (t["unloading_end"] <= due) if due else None
                if on_time:
                    on_time_sum += t["volume_t"]
                trips.append({k: t[k] for k in ("trip_id", "unit_id", "cargo_id", "cargo_type", "origin", "destination",
                                                "volume_t", "loading_start", "departure", "arrival", "unloading_end",
                                                "released_at", "loaded_draft_m")} | {"due_date": due, "on_time": on_time})
            if not cargo_ok or abs(on_time_sum - meta[strat]["delivered_on_time_t"]) > 0.01:
                on_time_ok = False
                problems.append(f"{sid}/{strat}: признак «в срок» по рейсам не сошёлся с метрикой — не показываем")
                for t in trips:
                    t["due_date"] = t["on_time"] = None
            detail["strategies"][strat] = {"trips": trips}
        detail["daily_allowed_draft_m"] = daily_draft(sdir) if sdir else None
        detail["units"] = [{"unit_id": u["unit_id"], "capacity_t": float(u["capacity_t"]), "cargo_types": u["cargo_type_allowed"].split("|"),
                            "draft_full_m": float(u["draft_full_m"])} for u in rows(sdir / "units.csv")] if sdir else None
        (out / "scenarios" / f"{sid}.json").write_text(json.dumps(detail, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

        index.append({
            "scenario_id": sid, "replicate": rep, "variant": variant, **factors(variant),
            "metrics": {s: meta[s] for s in STRATS}, "by_type": by_type.get(sid, {}),
            "input": input_summary(sdir) if sdir else None,
            "input_source": {"own": sid, "matched": sdir.name if sdir else None, "missing": None}[input_note],
            "input_note": input_note, "trip_on_time_available": on_time_ok,
        })
    (out / "index.json").write_text(json.dumps({"schema": 1, "scenarios": index}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Сценариев: {len(index)}; замечаний: {len(problems)}")
    for p in problems:
        print(" -", p)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else Path(__file__).parent.parent / "public" / "data" / "model")
