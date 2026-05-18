import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyAttempts } from "../api/attempts";
import type { AttemptItem } from "../api/types";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AttemptsPage() {
  const [items, setItems] = useState<AttemptItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      setErr(null);
      const data = await getMyAttempts();
      setItems(data.results);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось загрузить попытки.");
      setItems([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: 34 }}>Мои попытки</h2>
          <p style={{ margin: 0, color: "#64748B" }}>История прохождений квизов и результаты.</p>
        </div>
        <button onClick={load} style={{ background: "white", color: "#0F172A", border: "1px solid #E6EEF6" }}>
          Обновить
        </button>
      </div>

      {err && <div style={{ color: "#B91C1C" }}>Ошибка: {err}</div>}
      {items === null && <div>Загрузка...</div>}
      {items && items.length === 0 && (
        <div style={{ background: "white", border: "1px solid #E6EEF6", borderRadius: 14, padding: 18, color: "#64748B" }}>
          Пока нет попыток. Открой каталог квизов и нажми «Начать».
        </div>
      )}

      {items && items.length > 0 && (
        <div style={{ background: "white", border: "1px solid #E6EEF6", borderRadius: 14, overflow: "hidden", boxShadow: "0 6px 22px rgba(15,23,42,0.06)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                <th style={{ textAlign: "left", borderBottom: "1px solid #E6EEF6", padding: 12 }}>Попытка</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #E6EEF6", padding: 12 }}>Квиз</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #E6EEF6", padding: 12 }}>Результат</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #E6EEF6", padding: 12 }}>Статус</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #E6EEF6", padding: 12 }}>Дата</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #E6EEF6", padding: 12 }}>Действие</th>
              </tr>
            </thead>
            <tbody>
              {items.map((attempt) => (
                <tr key={attempt.id}>
                  <td style={{ borderBottom: "1px solid #EEF2F7", padding: 12 }}>#{attempt.id}</td>
                  <td style={{ borderBottom: "1px solid #EEF2F7", padding: 12 }}>
                    <Link to={`/quizzes/${attempt.quiz}`}>{attempt.quiz_title || `Квиз #${attempt.quiz}`}</Link>
                  </td>
                  <td style={{ borderBottom: "1px solid #EEF2F7", padding: 12 }}>
                    {attempt.is_submitted ? `${attempt.score} / ${attempt.max_score} · ${attempt.percent}%` : "—"}
                  </td>
                  <td style={{ borderBottom: "1px solid #EEF2F7", padding: 12 }}>
                    {attempt.is_submitted ? "Завершена" : "В процессе"}
                  </td>
                  <td style={{ borderBottom: "1px solid #EEF2F7", padding: 12 }}>
                    {formatDate(attempt.finished_at || attempt.started_at)}
                  </td>
                  <td style={{ borderBottom: "1px solid #EEF2F7", padding: 12, textAlign: "right" }}>
                    {attempt.is_submitted ? (
                      <Link to={`/attempts/${attempt.id}/result`} style={{ background: "#2563EB", color: "white", padding: "7px 10px", borderRadius: 8 }}>
                        Результат
                      </Link>
                    ) : (
                      <Link to={`/quizzes/${attempt.quiz}`} style={{ background: "white", color: "#0F172A", border: "1px solid #E6EEF6", padding: "7px 10px", borderRadius: 8 }}>
                        Открыть квиз
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
