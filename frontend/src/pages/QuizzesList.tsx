import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getQuizzes } from "../api/quizzes";
import QRCodeSvg from "../components/QRCodeSvg";
import { pluralizeQuestions } from "../utils/pluralize";
import type { QuizDifficulty, QuizKind, QuizListItem, QuizPublishStatus, QuizVisibility } from "../api/types";

type Props = {
  kind?: QuizKind;
};

const inputStyle = { minHeight: 38 };

function getKindLabels(kind: QuizKind) {
  if (kind === "trivia") {
    return {
      singular: "викторина",
      singularCapitalized: "Викторина",
      plural: "викторины",
      pluralCapitalized: "Викторины",
      availableTitle: "Каталог викторин",
      mineTitle: "Мои викторины",
      empty: "Викторин пока нет.",
      create: "Создать викторину",
      availableButton: "Доступные викторины",
      mineButton: "Мои викторины",
      path: "trivia",
    };
  }
  return {
    singular: "квиз",
    singularCapitalized: "Квиз",
    plural: "квизы",
    pluralCapitalized: "Квизы",
    availableTitle: "Каталог квизов",
    mineTitle: "Мои квизы",
    empty: "Квизов пока нет.",
    create: "Создать квиз",
    availableButton: "Доступные квизы",
    mineButton: "Мои квизы",
    path: "quizzes",
  };
}

function getShareLink(quiz: QuizListItem) {
  const joinPath = `/join/${encodeURIComponent(quiz.access_code)}`;
  if (typeof window === "undefined") return joinPath;
  return new URL(joinPath, window.location.origin).toString();
}

function getAttemptCode(id: number) {
  return `ATT-${String(id).padStart(4, "0")}`;
}

function isActiveAttemptAvailable(quiz: QuizListItem, nowMs: number) {
  if (!quiz.active_attempt_id) return false;
  if (!quiz.active_attempt_deadline_at) return true;

  const deadlineMs = new Date(quiz.active_attempt_deadline_at).getTime();
  return Number.isFinite(deadlineMs) && deadlineMs > nowMs;
}

export default function QuizzesList({ kind = "quiz" }: Props) {
  const labels = getKindLabels(kind);
  const [searchParams, setSearchParams] = useSearchParams();
  const owner = searchParams.get("owner");
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [publishStatus, setPublishStatus] = useState<"" | QuizPublishStatus>("");
  const [difficulty, setDifficulty] = useState<"" | QuizDifficulty>("");
  const [visibility, setVisibility] = useState<"" | QuizVisibility>("");
  const [pageSize, setPageSize] = useState("10");
  const [sharedQuiz, setSharedQuiz] = useState<QuizListItem | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        setLoading(true);
        setError(null);
        const params: Record<string, string> = {
          page: currentPage.toString(),
          page_size: pageSize,
          kind,
        };

        if (owner === "me") {
          params.scope = "mine";
        } else {
          params.scope = "available";
        }
        if (search.trim()) params.search = search.trim();
        if (publishStatus) params.publish_status = publishStatus;
        if (difficulty) params.difficulty = difficulty;
        if (visibility) params.visibility = visibility;

        const data = await getQuizzes(params);
        setQuizzes(data.results);
        setTotalPages(Math.max(1, Math.ceil(data.count / Number(pageSize || 10))));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    fetchQuizzes();
  }, [currentPage, owner, kind, search, publishStatus, difficulty, visibility, pageSize]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  function setMineMode(nextMine: boolean) {
    setCurrentPage(1);
    setSearchParams(nextMine ? { owner: "me" } : {});
  }

  function resetFilters() {
    setSearch("");
    setPublishStatus("");
    setDifficulty("");
    setVisibility("");
    setPageSize("10");
    setCurrentPage(1);
  }

  async function copyShareLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopyMessage("Ссылка скопирована.");
    } catch {
      setCopyMessage("Не удалось скопировать автоматически. Скопируйте ссылку из поля ниже.");
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ marginBottom: 8 }}>{owner === "me" ? labels.mineTitle : labels.availableTitle}</h2>
          <p style={{ margin: "0 0 12px", color: "#64748B" }}>
            {kind === "quiz"
              ? "Квизы — учебные и проверочные материалы, например «Математика 5 класс» или «Основы Python»."
              : "Викторины — более развлекательные подборки вопросов, например про кино, музыку или общую эрудицию."}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => setMineMode(false)} style={{ background: owner === "me" ? "white" : "#2563EB", color: owner === "me" ? "#0F172A" : "white", border: "1px solid #E6EEF6" }}>
              {labels.availableButton}
            </button>
            <button onClick={() => setMineMode(true)} style={{ background: owner === "me" ? "#2563EB" : "white", color: owner === "me" ? "white" : "#0F172A", border: "1px solid #E6EEF6" }}>
              {labels.mineButton}
            </button>
          </div>
        </div>
        <Link to={`/${labels.path}/create`} style={{ background: "#06B6D4", color: "white", padding: "8px 12px", borderRadius: 8 }}>
          {labels.create}
        </Link>
      </div>

      <section style={{ background: "white", borderRadius: 12, padding: 14, boxShadow: "0 1px 6px rgba(2,6,23,0.06)", marginBottom: 16, display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) repeat(4, minmax(140px, 180px)) auto", gap: 10, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
            Поиск по названию/описанию
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setCurrentPage(1); }}
              placeholder={kind === "quiz" ? "Например: матем 5 клас" : "Например: кино музка"}
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
            Статус
            <select value={publishStatus} onChange={(event) => { setPublishStatus(event.target.value as "" | QuizPublishStatus); setCurrentPage(1); }} style={inputStyle}>
              <option value="">Любой</option>
              <option value="published">Опубликован</option>
              <option value="draft">Черновик</option>
              <option value="archived">Архив</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
            Сложность
            <select value={difficulty} onChange={(event) => { setDifficulty(event.target.value as "" | QuizDifficulty); setCurrentPage(1); }} style={inputStyle}>
              <option value="">Любая</option>
              <option value="easy">Лёгкий</option>
              <option value="medium">Средний</option>
              <option value="hard">Сложный</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
            Доступ
            <select value={visibility} onChange={(event) => { setVisibility(event.target.value as "" | QuizVisibility); setCurrentPage(1); }} style={inputStyle}>
              <option value="">Любой</option>
              <option value="public">Публичный</option>
              <option value="private">Приватный</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
            На странице
            <select value={pageSize} onChange={(event) => { setPageSize(event.target.value); setCurrentPage(1); }} style={inputStyle}>
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
            </select>
          </label>
          <button type="button" onClick={resetFilters} style={{ background: "white", color: "#0F172A", border: "1px solid #E6EEF6", height: 38 }}>
            Сбросить
          </button>
        </div>
      </section>

      {loading && <div>Загрузка...</div>}
      {error && <div>Ошибка: {error}</div>}
      {!loading && !error && quizzes.length === 0 && <div style={{ color: "#64748B" }}>{labels.empty}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {!loading && !error && quizzes.map((q) => {
          const itemPath = q.kind === "trivia" ? "trivia" : "quizzes";
          const hasActiveAttempt = isActiveAttemptAvailable(q, nowMs);
          const primaryActionLink = hasActiveAttempt
            ? `/${itemPath}/${q.id}?attempt=${q.active_attempt_id}`
            : `/${itemPath}/${q.id}`;
          const primaryActionLabel = q.publish_status !== "published"
            ? "Просмотр"
            : hasActiveAttempt
              ? "Продолжить"
              : "Начать";

          return (
            <div
              key={q.id}
              style={{
                background: "white",
                padding: 16,
                borderRadius: 8,
                boxShadow: "0 1px 6px rgba(2,6,23,0.06)",
                display: "grid",
                gap: 8,
                minWidth: 0,
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start", minWidth: 0 }}>
                <h3 style={{ margin: 0, minWidth: 0, overflowWrap: "anywhere" }}>{q.title}</h3>
                <span
                  style={{
                    color: "#2563EB",
                    fontSize: 12,
                    fontWeight: 700,
                    background: "#EFF6FF",
                    padding: "4px 8px",
                    borderRadius: 999,
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  {q.kind_label}
                </span>
              </div>
              <p style={{ margin: 0, color: "#64748B" }}>{q.description}</p>
              <p style={{ margin: 0, color: "#64748B" }}>{q.status} · {q.difficulty_label}</p>
              <p style={{ margin: 0, color: "#64748B" }}>{q.question_count} {pluralizeQuestions(q.question_count)}</p>
              <p style={{ margin: 0, color: "#64748B" }}>Код: <strong style={{ color: "#0F172A" }}>{q.access_code}</strong></p>
              <p style={{ margin: 0, color: "#64748B" }}>Таймер: {q.time_limit_minutes ? `${q.time_limit_minutes} мин` : "без ограничения"} · Попытки: {q.max_attempts || "∞"}</p>
              {hasActiveAttempt && q.active_attempt_id && (
                <p style={{ margin: 0, color: "#15803D", fontWeight: 600 }}>
                  Есть активная попытка: {getAttemptCode(q.active_attempt_id)}
                </p>
              )}
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link
                  to={primaryActionLink}
                  style={{
                    background: q.publish_status === "published" ? "#2563EB" : "#94A3B8",
                    color: "white",
                    padding: "8px 10px",
                    borderRadius: 8,
                  }}
                >
                  {primaryActionLabel}
                </Link>
                <button
                  type="button"
                  onClick={() => { setSharedQuiz(q); setCopyMessage(null); }}
                  style={{ background: "white", color: "#0F172A", padding: "8px 10px", borderRadius: 8, border: "1px solid #E6EEF6" }}
                >
                  QR-код
                </button>
                {q.is_owner && (
                  <>
                    <Link to={`/${itemPath}/${q.id}/edit`} style={{ background: "white", color: "#0F172A", padding: "8px 10px", borderRadius: 8, border: "1px solid #E6EEF6" }}>
                      Редактировать
                    </Link>
                    <Link to={`/${itemPath}/${q.id}/analytics`} style={{ background: "white", color: "#0F172A", padding: "8px 10px", borderRadius: 8, border: "1px solid #E6EEF6" }}>
                      Аналитика
                    </Link>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && !loading && !error && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 20, gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
            style={{ padding: "8px 12px", borderRadius: 4, border: "1px solid #ccc" }}
          >
            Предыдущая
          </button>
          <span>Страница {currentPage} из {totalPages}</span>
          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            style={{ padding: "8px 12px", borderRadius: 4, border: "1px solid #ccc" }}
          >
            Следующая
          </button>
        </div>
      )}

      {sharedQuiz && (() => {
        const shareLink = getShareLink(sharedQuiz);
        const sharedKindLabel = sharedQuiz.kind === "trivia" ? "викторине" : "квизу";
        return (
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setSharedQuiz(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.45)",
              zIndex: 1000,
              display: "grid",
              placeItems: "center",
              padding: 16,
            }}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              style={{
                width: "min(520px, 100%)",
                background: "white",
                borderRadius: 18,
                padding: 20,
                boxShadow: "0 24px 80px rgba(15, 23, 42, 0.25)",
                display: "grid",
                gap: 14,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                <div>
                  <h3 style={{ margin: "0 0 6px", fontSize: 26 }}>Поделиться</h3>
                  <p style={{ margin: 0, color: "#64748B" }}>
                    Покажи QR-код ученикам или отправь ссылку для быстрого входа по коду.
                  </p>
                </div>
                <button type="button" onClick={() => setSharedQuiz(null)} style={{ background: "white", color: "#0F172A", border: "1px solid #E6EEF6" }}>
                  ×
                </button>
              </div>

              <div style={{ display: "grid", justifyItems: "center", gap: 10, padding: 12, border: "1px solid #E6EEF6", borderRadius: 14 }}>
                <QRCodeSvg value={shareLink} size={220} />
                <strong style={{ fontSize: 18, textAlign: "center" }}>{sharedQuiz.title}</strong>
                <span style={{ color: "#64748B" }}>Код доступа: <strong style={{ color: "#0F172A" }}>{sharedQuiz.access_code}</strong></span>
              </div>

              <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
                Ссылка на вход к {sharedKindLabel}
                <input value={shareLink} readOnly onFocus={(event) => event.target.select()} />
              </label>

              {copyMessage && <div style={{ color: copyMessage.startsWith("Ссылка") ? "#15803D" : "#B45309" }}>{copyMessage}</div>}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => void copyShareLink(shareLink)} style={{ background: "#2563EB", color: "white" }}>
                  Скопировать ссылку
                </button>
                <Link to={`/join/${encodeURIComponent(sharedQuiz.access_code)}`} style={{ background: "white", color: "#0F172A", padding: "8px 10px", borderRadius: 8, border: "1px solid #E6EEF6" }}>
                  Открыть вход
                </Link>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
