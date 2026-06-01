import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { downloadQuizResultsCsv, getQuizAnalytics } from "../api/quizzes";
import type { QuizAnalytics as QuizAnalyticsData, QuizAnalyticsAttempt } from "../api/types";

const panel = {
  background: "white",
  border: "1px solid #E6EEF6",
  borderRadius: 14,
  padding: 16,
  boxShadow: "0 6px 22px rgba(15,23,42,0.06)",
} as const;

const inputStyle = {
  minHeight: 38,
} as const;

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function getAttemptCode(id: number) {
  return `ATT-${String(id).padStart(4, "0")}`;
}

function getLocalDateKey(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isAttemptVisible(
  attempt: QuizAnalyticsAttempt,
  search: string,
  minPercent: number,
  maxPercent: number,
  dateFrom: string,
  dateTo: string,
) {
  const cleanSearch = search.trim().toLowerCase();
  const userText = `${attempt.user} ${attempt.username}`.toLowerCase();
  const attemptDate = getLocalDateKey(attempt.finished_at);

  if (cleanSearch && !userText.includes(cleanSearch)) {
    return false;
  }

  if (attempt.percent < minPercent || attempt.percent > maxPercent) {
    return false;
  }

  if (dateFrom && (!attemptDate || attemptDate < dateFrom)) {
    return false;
  }

  if (dateTo && (!attemptDate || attemptDate > dateTo)) {
    return false;
  }

  return true;
}

export default function QuizAnalytics() {
  const { id } = useParams();
  const quizId = Number(id);
  const [data, setData] = useState<QuizAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptSearch, setAttemptSearch] = useState("");
  const [minPercent, setMinPercent] = useState(0);
  const [maxPercent, setMaxPercent] = useState(100);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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

  const filteredAttempts = useMemo(
    () =>
      (data?.attempts ?? []).filter((attempt) =>
        isAttemptVisible(attempt, attemptSearch, minPercent, maxPercent, dateFrom, dateTo),
      ),
    [attemptSearch, data?.attempts, dateFrom, dateTo, maxPercent, minPercent],
  );

  function resetAttemptFilters() {
    setAttemptSearch("");
    setMinPercent(0);
    setMaxPercent(100);
    setDateFrom("");
    setDateTo("");
  }

  if (loading) return <div>Загрузка аналитики...</div>;
  if (error) return <div style={{ color: "#B91C1C" }}>Ошибка: {error}</div>;
  if (!data) return <div>Аналитика не найдена.</div>;

  const isTrivia = data.quiz.kind === "trivia";
  const itemPath = isTrivia ? "trivia" : "quizzes";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: 34 }}>Аналитика {isTrivia ? "викторины" : "квиза"}</h2>
          <p style={{ margin: 0, color: "#64748B" }}>{data.quiz.title}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => void downloadQuizResultsCsv(quizId)} style={{ background: "#06B6D4", color: "white" }}>
            Экспорт CSV
          </button>
          <Link to={`/${itemPath}/${quizId}`} style={{ background: "white", color: "#0F172A", border: "1px solid #E6EEF6", borderRadius: 8, padding: "9px 12px" }}>
            Открыть {isTrivia ? "викторину" : "квиз"}
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

      <section style={{ ...panel, display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: "0 0 6px" }}>Попытки участников</h3>
            <p style={{ margin: 0, color: "#64748B" }}>
              Показано {filteredAttempts.length} из {data.attempts.length} завершённых попыток.
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 1fr) repeat(2, minmax(150px, 190px)) auto", gap: 12, alignItems: "end" }}>
            <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
              Поиск по ученику
              <input
                value={attemptSearch}
                onChange={(event) => setAttemptSearch(event.target.value)}
                placeholder="Имя или username"
                style={inputStyle}
              />
            </label>

            <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
              Дата от
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} style={inputStyle} />
            </label>

            <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
              Дата до
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} style={inputStyle} />
            </label>

            <button
              type="button"
              onClick={resetAttemptFilters}
              style={{ background: "white", color: "#0F172A", border: "1px solid #E6EEF6", minHeight: 38 }}
            >
              Сбросить
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
              Результат от: {minPercent}%
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={minPercent}
                onChange={(event) => setMinPercent(Math.min(Number(event.target.value), maxPercent))}
              />
            </label>

            <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
              Результат до: {maxPercent}%
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={maxPercent}
                onChange={(event) => setMaxPercent(Math.max(Number(event.target.value), minPercent))}
              />
            </label>
          </div>
        </div>

        {filteredAttempts.length === 0 ? <p style={{ color: "#64748B" }}>Подходящих попыток нет.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#64748B" }}>
                  <th style={{ padding: 8, borderBottom: "1px solid #E6EEF6" }}>ID попытки</th>
                  <th style={{ padding: 8, borderBottom: "1px solid #E6EEF6" }}>Пользователь</th>
                  <th style={{ padding: 8, borderBottom: "1px solid #E6EEF6" }}>Баллы</th>
                  <th style={{ padding: 8, borderBottom: "1px solid #E6EEF6" }}>Процент</th>
                  <th style={{ padding: 8, borderBottom: "1px solid #E6EEF6" }}>Завершение</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttempts.map((attempt) => (
                  <tr key={attempt.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid #E6EEF6" }}>{getAttemptCode(attempt.id)}</td>
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
