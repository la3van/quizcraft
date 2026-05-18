import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { downloadQuizResultsCsv, getQuizAnalytics } from "../api/quizzes";
import type { QuizAnalytics as QuizAnalyticsData } from "../api/types";

const panel = {
  background: "white",
  border: "1px solid #E6EEF6",
  borderRadius: 14,
  padding: 16,
  boxShadow: "0 6px 22px rgba(15,23,42,0.06)",
} as const;

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

export default function QuizAnalytics() {
  const { id } = useParams();
  const quizId = Number(id);
  const [data, setData] = useState<QuizAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const result = await getQuizAnalytics(quizId);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Не удалось загрузить аналитику.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (Number.isFinite(quizId)) void load();
    return () => {
      cancelled = true;
    };
  }, [quizId]);

  const hardestQuestions = useMemo(
    () => [...(data?.questions ?? [])].sort((a, b) => a.accuracy_percent - b.accuracy_percent).slice(0, 5),
    [data],
  );

  if (loading) return <div>Загрузка аналитики...</div>;
  if (error) return <div style={{ color: "#B91C1C" }}>Ошибка: {error}</div>;
  if (!data) return <div>Аналитика не найдена.</div>;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: 34 }}>Аналитика квиза</h2>
          <p style={{ margin: 0, color: "#64748B" }}>{data.quiz.title}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => void downloadQuizResultsCsv(quizId)} style={{ background: "#06B6D4", color: "white" }}>
            Экспорт CSV
          </button>
          <Link to={`/quizzes/${quizId}`} style={{ background: "white", color: "#0F172A", border: "1px solid #E6EEF6", borderRadius: 8, padding: "9px 12px" }}>
            Открыть квиз
          </Link>
        </div>
      </div>

      <section style={{ ...panel, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <div><strong style={{ fontSize: 30 }}>{data.summary.attempts_count}</strong><div style={{ color: "#64748B" }}>завершённых попыток</div></div>
        <div><strong style={{ fontSize: 30 }}>{data.summary.average_percent}%</strong><div style={{ color: "#64748B" }}>средний результат</div></div>
        <div><strong style={{ fontSize: 30 }}>{formatNumber(data.summary.average_score)}</strong><div style={{ color: "#64748B" }}>средний балл</div></div>
        <div><strong style={{ fontSize: 30 }}>{data.summary.min_percent}% / {data.summary.max_percent}%</strong><div style={{ color: "#64748B" }}>мин / макс</div></div>
      </section>

      <section style={panel}>
        <h3 style={{ marginTop: 0 }}>Сложные вопросы</h3>
        {hardestQuestions.length === 0 ? <p style={{ color: "#64748B" }}>Попыток пока нет.</p> : (
          <div style={{ display: "grid", gap: 10 }}>
            {hardestQuestions.map((question) => (
              <div key={question.question_id} style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <strong style={{ overflowWrap: "anywhere" }}>{question.text}</strong>
                  <span style={{ whiteSpace: "nowrap" }}>{question.accuracy_percent}% верных</span>
                </div>
                <div style={{ height: 10, background: "#E2E8F0", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: `${question.accuracy_percent}%`, height: "100%", background: "#2563EB" }} />
                </div>
                <div style={{ color: "#64748B", fontSize: 13 }}>
                  {question.answers_count} ответ(ов) · средний балл {formatNumber(question.average_points)} / {formatNumber(question.max_points)}
                  {question.learning_goal ? ` · цель: ${question.learning_goal}` : ""}
                  {question.tags ? ` · теги: ${question.tags}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={panel}>
        <h3 style={{ marginTop: 0 }}>Попытки участников</h3>
        {data.attempts.length === 0 ? <p style={{ color: "#64748B" }}>Завершённых попыток пока нет.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#64748B" }}>
                  <th style={{ padding: 8, borderBottom: "1px solid #E6EEF6" }}>Пользователь</th>
                  <th style={{ padding: 8, borderBottom: "1px solid #E6EEF6" }}>Баллы</th>
                  <th style={{ padding: 8, borderBottom: "1px solid #E6EEF6" }}>Процент</th>
                  <th style={{ padding: 8, borderBottom: "1px solid #E6EEF6" }}>Завершение</th>
                </tr>
              </thead>
              <tbody>
                {data.attempts.map((attempt) => (
                  <tr key={attempt.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid #E6EEF6" }}>{attempt.user} <span style={{ color: "#64748B" }}>@{attempt.username}</span></td>
                    <td style={{ padding: 8, borderBottom: "1px solid #E6EEF6" }}>{formatNumber(attempt.score)} / {formatNumber(attempt.max_score)}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #E6EEF6" }}>{attempt.percent}%</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #E6EEF6" }}>{formatDate(attempt.finished_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
