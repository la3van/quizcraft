import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAttempt } from "../api/attempts";
import type { AttemptDetail } from "../api/types";

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

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

export default function QuizResult() {
  const { attemptId } = useParams();
  const [attempt, setAttempt] = useState<AttemptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchAttempt() {
      try {
        setLoading(true);
        setError(null);
        const data = await getAttempt(Number(attemptId));
        if (!cancelled) setAttempt(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Не удалось загрузить результат.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (attemptId) fetchAttempt();

    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  const isHidden = attempt?.feedback_policy === "hidden";
  const canShowScore = attempt?.feedback_policy !== "hidden";
  const canShowReview = attempt?.feedback_policy === "after_submit";
  const correctCount = useMemo(() => attempt?.answers.filter((answer) => answer.is_correct).length ?? 0, [attempt]);

  if (loading) return <div>Загрузка...</div>;
  if (error) return <div style={{ color: "#B91C1C" }}>Ошибка: {error}</div>;
  if (!attempt) return <div>Попытка не найдена.</div>;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 8px", fontSize: 34 }}>Результат попытки</h2>
          <p style={{ margin: 0, color: "#64748B" }}>{attempt.quiz_title}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link to={`/quizzes/${attempt.quiz}`} style={{ background: "#2563EB", color: "white", padding: "9px 12px", borderRadius: 8 }}>
            Пройти ещё раз
          </Link>
          <Link to="/attempts" style={{ background: "white", color: "#0F172A", border: "1px solid #E6EEF6", padding: "9px 12px", borderRadius: 8 }}>
            Мои попытки
          </Link>
        </div>
      </div>

      {!attempt.is_submitted && (
        <div style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A", borderRadius: 10, padding: 12 }}>
          Эта попытка ещё не завершена, поэтому итоговый результат пока не рассчитан.
        </div>
      )}

      {isHidden && (
        <div style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A", borderRadius: 10, padding: 12 }}>
          Преподаватель скрыл результат этой попытки. Видны только факт отправки и дата завершения.
        </div>
      )}

      <section
        style={{
          background: "white",
          border: "1px solid #E6EEF6",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 6px 22px rgba(15,23,42,0.06)",
          display: "grid",
          gap: 16,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
          {canShowScore && (
            <>
              <div style={{ border: "1px solid #E6EEF6", borderRadius: 12, padding: 14 }}>
                <strong style={{ fontSize: 32 }}>{attempt.percent}%</strong>
                <div style={{ color: "#64748B" }}>итоговый процент</div>
              </div>
              <div style={{ border: "1px solid #E6EEF6", borderRadius: 12, padding: 14 }}>
                <strong style={{ fontSize: 32 }}>{formatNumber(attempt.score)} / {formatNumber(attempt.max_score)}</strong>
                <div style={{ color: "#64748B" }}>баллы</div>
              </div>
            </>
          )}

          {canShowReview && attempt.answers.length > 0 && (
            <div style={{ border: "1px solid #E6EEF6", borderRadius: 12, padding: 14 }}>
              <strong style={{ fontSize: 32 }}>{correctCount} / {attempt.answers.length}</strong>
              <div style={{ color: "#64748B" }}>правильные ответы</div>
            </div>
          )}

          <div style={{ border: "1px solid #E6EEF6", borderRadius: 12, padding: 14 }}>
            <strong style={{ fontSize: 18 }}>{formatDate(attempt.finished_at)}</strong>
            <div style={{ color: "#64748B" }}>завершение</div>
          </div>
        </div>
      </section>

      {attempt.feedback_policy === "score_only" && (
        <div style={{ background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", borderRadius: 10, padding: 12 }}>
          Преподаватель разрешил показать только итоговый балл без разбора ответов.
        </div>
      )}

      {canShowReview && attempt.answers.length === 0 && (
        <div style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A", borderRadius: 10, padding: 12 }}>
          Для этой попытки нет сохранённых ответов, поэтому разбор показать нельзя. Создай новую попытку после установки этого патча — выбранные и правильные варианты будут сохранены и показаны.
        </div>
      )}

      {canShowReview && attempt.answers.length > 0 && (
        <section style={{ display: "grid", gap: 12 }}>
          <h3 style={{ margin: 0 }}>Разбор ответов</h3>
          {attempt.answers.map((answer, index) => (
            <article
              key={answer.id}
              style={{
                background: "white",
                border: answer.is_correct ? "1px solid #86EFAC" : "1px solid #FECACA",
                borderRadius: 14,
                padding: 16,
                boxShadow: "0 6px 18px rgba(15,23,42,0.04)",
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: "#64748B", fontSize: 13 }}>Вопрос {index + 1}</div>
                  <strong style={{ fontSize: 18, overflowWrap: "anywhere" }}>{answer.question_text}</strong>
                </div>
                <div style={{ whiteSpace: "nowrap", color: answer.is_correct ? "#15803D" : "#B91C1C", fontWeight: 700 }}>
                  {answer.is_correct ? "Верно" : "Неверно"} · {formatNumber(answer.earned_points)} / {formatNumber(answer.points)}
                </div>
              </div>

              {answer.options.length > 0 ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {answer.options.map((option) => {
                    const border = option.is_correct ? "1px solid #86EFAC" : option.is_selected ? "1px solid #FCA5A5" : "1px solid #E6EEF6";
                    const background = option.is_correct ? "#F0FDF4" : option.is_selected ? "#FEF2F2" : "white";
                    return (
                      <div key={option.id} style={{ border, background, borderRadius: 10, padding: "9px 10px", display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <span style={{ overflowWrap: "anywhere" }}>{option.text}</span>
                        <span style={{ color: "#64748B", whiteSpace: "nowrap" }}>
                          {option.is_selected ? "выбрано" : ""}{option.is_selected && option.is_correct ? " · " : ""}{option.is_correct ? "правильный" : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                  <div style={{ border: "1px solid #E6EEF6", borderRadius: 10, padding: 10 }}>
                    <strong>Ответ участника</strong>
                    <div style={{ color: "#475569", marginTop: 4 }}>
                      {answer.question_type === "input_number" ? answer.number_answer ?? "—" : answer.text_answer || "—"}
                    </div>
                  </div>
                  <div style={{ border: "1px solid #86EFAC", background: "#F0FDF4", borderRadius: 10, padding: 10 }}>
                    <strong>Правильный ответ</strong>
                    <div style={{ color: "#475569", marginTop: 4 }}>
                      {answer.question_type === "input_number"
                        ? `${answer.correct_number ?? "—"}${answer.numeric_tolerance ? ` ± ${answer.numeric_tolerance}` : ""}`
                        : answer.correct_text || "—"}
                    </div>
                  </div>
                </div>
              )}

              {answer.question_explanation && (
                <div style={{ background: "#F8FAFC", border: "1px solid #E6EEF6", borderRadius: 10, padding: 10 }}>
                  <strong>Объяснение:</strong>
                  <div style={{ color: "#475569", marginTop: 4, whiteSpace: "pre-wrap" }}>{answer.question_explanation}</div>
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
