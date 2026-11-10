import { date } from "../data.js";

export default function Sources({ sources }) {
  return (
    <ul className="sources">
      {sources.map((s) => (
        <li key={s.source_id}>
          <div className="src-title">
            {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : s.title}
          </div>
          <div className="muted small">
            {s.publisher}, {s.date.includes("-") ? date(s.date) : s.date}
            {!s.url && ", ссылка не указана"}
          </div>
          <div className="small">{s.used_for}</div>
        </li>
      ))}
    </ul>
  );
}
