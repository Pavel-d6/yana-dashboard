import { Fragment } from "react";
import { pct, t } from "../data.js";

const GAP_TEXT = {
  "Отгружено": "не отгружено",
  "Прошло бар": "отгружено, но не прошло бар",
  "Доставлено": "прошло бар, но не доставлено",
};

export default function StageLadder({ stages }) {
  return (
    <ol className="ladder">
      {stages.map((s) => (
        <Fragment key={s.stage}>
          {s.gapFromPrev != null && (
            <li className="gap" aria-label={`Разрыв ${t(s.gapFromPrev)} тонн`}>
              <span className="gap-value">−{t(s.gapFromPrev)} т</span>
              <span>{GAP_TEXT[s.stage] ?? "разрыв с предыдущим этапом"}</span>
              <span className="muted">{pct(s.shareOfPrev)} от предыдущего этапа</span>
            </li>
          )}
          <li className="stage">
            <span className="stage-name">{s.stage}</span>
            <span className="track">
              <span className="fill" style={{ width: `${s.shareOfPlan * 100}%` }} />
            </span>
            <span className="stage-value">{t(s.tonnes)} т</span>
            <span className="stage-share">{pct(s.shareOfPlan)}</span>
          </li>
        </Fragment>
      ))}
    </ol>
  );
}
