import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getMyAttempts } from "../api/attempts";
import type { AttemptItem, QuizKind } from "../api/types";

type Props = {
  kind?: QuizKind;
};

const panelStyle = {
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
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getAttemptCode(id: number) {
  return `ATT-${String(id).padStart(4, "0")}`;
}

function isAttemptExpiredLocally(attempt: AttemptItem, nowMs: number) {
  return Boolean(
    !attempt.is_submitted &&
      attempt.deadline_at &&
      new Date(attempt.deadline_at).getTime() <= nowMs,
  );
}

function getNextDeadlineDelay(items: AttemptItem[]) {
  const deadlines = items
    .filter((attempt) => !attempt.is_submitted && attempt.deadline_at)
    .map((attempt) => new Date(attempt.deadline_at as string).getTime())
    .filter((value) => Number.isFinite(value) && value > Date.now())
    .sort((a, b) => a - b);

  if (deadlines.length === 0) {
    return null;
  }

  return Math.max(0, deadlines[0] - Date.now() + 500);
}

function getPageLabels(kind?: QuizKind) {
  if (kind === "quiz") {
    return {
      title: "Мои попытки по квизам",
      description: "История прохождений учебных квизов и результаты.",
      empty: "Пока нет попыток по квизам. Открой каталог квизов и нажми «Начать».",
      tableTitle: "Квиз",
      searchPlaceholder: "Например: математика, информатика, Python",
    };
  }

  if (kind === "trivia") {
    return {
      title: "Мои попытки по викторинам",
      description: "История прохождений развлекательных викторин и результаты.",
      empty: "Пока нет попыток по викторинам. Открой каталог викторин и нажми «Начать».",
      tableTitle: "Викторина",
      searchPlaceholder: "Например: кино, музыка, эрудиция",
    };
  }

  return {
    title: "Мои попытки",
    description: "История прохождений квизов и викторин и результаты.",
    empty: "Пока нет попыток. Открой каталог квизов или викторин и нажми «Начать».",
    tableTitle: "Материал",
    searchPlaceholder: "Название квиза или викторины",
  };
}

export default function AttemptsPage({ kind }: Props) {
  const labels = getPageLabels(kind);
  const [items, setItems] = useState<AttemptItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [minPercent, setMinPercent] = useState(0);
  const [maxPercent, setMaxPercent] = useState(100);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [attemptStatus, setAttemptStatus] = useState<"" | "submitted" | "in_progress">("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  const filters = useMemo(
    () => ({ search, minPercent, maxPercent, dateFrom, dateTo, attemptStatus }),
    [attemptStatus, dateFrom, dateTo, maxPercent, minPercent, search],
  );

  async function load() {
    try {
      setErr(null);

      const params: Record<string, string> = {
        page_size: "50",
        min_percent: String(filters.minPercent),
        max_percent: String(filters.maxPercent),
      };

      if (kind) {
        params.kind = kind;
      }

      if (filters.search.trim()) {
        params.search = filters.search.trim();
      }

      if (filters.attemptStatus) {
        params.status = filters.attemptStatus;
      }

      if (filters.dateFrom) {
        params.date_from = filters.dateFrom;
      }

      if (filters.dateTo) {
        params.date_to = filters.dateTo;
      }

      const data = await getMyAttempts(params);
      setItems(data.results);
      setNowMs(Date.now());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось загрузить попытки.");
      setItems([]);
    }
  }

  function resetFilters() {
    setSearch("");
    setMinPercent(0);
    setMaxPercent(100);
    setDateFrom("");
    setDateTo("");
    setAttemptStatus("");
  }

  useEffect(() => {
    void load();
  }, [kind, filters]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!items || items.length === 0) {
      return;
    }

    const delay = getNextDeadlineDelay(items);
    if (delay === null) {
      return;
    }

    const timerId = window.setTimeout(() => {
      void load();
    }, delay);

    return () => window.clearTimeout(timerId);
  }, [items, filters, kind]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: 34 }}>{labels.title}</h2>
          <p style={{ margin: 0, color: "#64748B" }}>{labels.description}</p>
        </div>
        <button onClick={() => void load()} style={{ background: "white", color: "#0F172A", border: "1px solid #E6EEF6" }}>
          Обновить
        </button>
      </div>

      <section style={{ ...panelStyle, display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) minmax(150px, 190px) repeat(2, minmax(150px, 190px)) auto", gap: 12, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
            Поиск по названию
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={labels.searchPlaceholder}
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
            Статус попытки
            <select
              value={attemptStatus}
              onChange={(event) => setAttemptStatus(event.target.value as "" | "submitted" | "in_progress")}
              style={inputStyle}
            >
              <option value="">Любой</option>
              <option value="submitted">Завершена</option>
              <option value="in_progress">В процессе</option>
            </select>
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
            onClick={resetFilters}
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
      </section>

      {err && <div style={{ color: "#B91C1C" }}>Ошибка: {err}</div>}
      {items === null && <div>Загрузка...</div>}
      {items && items.length === 0 && (
        <div style={{ background: "white", border: "1px solid #E6EEF6", borderRadius: 14, padding: 18, color: "#64748B" }}>
          {labels.empty}
        </div>
      )}

      {items && items.length > 0 && (
        <div style={{ background: "white", border: "1px solid #E6EEF6", borderRadius: 14, overflow: "hidden", boxShadow: "0 6px 22px rgba(15,23,42,0.06)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                <th style={{ textAlign: "left", borderBottom: "1px solid #E6EEF6", padding: 12 }}>ID попытки</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #E6EEF6", padding: 12 }}>Тип</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #E6EEF6", padding: 12 }}>{labels.tableTitle}</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #E6EEF6", padding: 12 }}>Результат</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #E6EEF6", padding: 12 }}>Статус</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #E6EEF6", padding: 12 }}>Дата</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #E6EEF6", padding: 12 }}>Действие</th>
              </tr>
            </thead>
            <tbody>
              {items.map((attempt) => {
                const itemPath = attempt.quiz_kind === "trivia" ? "trivia" : "quizzes";
                const expiredLocally = isAttemptExpiredLocally(attempt, nowMs);
                const shouldOpenResult = attempt.is_submitted || expiredLocally;
                const attemptActionLink = shouldOpenResult
                  ? `/attempts/${attempt.id}/result`
                  : `/${itemPath}/${attempt.quiz}?attempt=${attempt.id}`;
                const actionLabel = shouldOpenResult ? "Результат" : "Продолжить";

                return (
                  <tr key={attempt.id}>
                    <td style={{ borderBottom: "1px solid #EEF2F7", padding: 12 }}>{getAttemptCode(attempt.id)}</td>
                    <td style={{ borderBottom: "1px solid #EEF2F7", padding: 12 }}>{attempt.quiz_kind_label}</td>
                    <td style={{ borderBottom: "1px solid #EEF2F7", padding: 12 }}>
                      <Link to={attemptActionLink}>
                        {attempt.quiz_title || `${attempt.quiz_kind_label} #${attempt.quiz}`}
                      </Link>
                    </td>
                    <td style={{ borderBottom: "1px solid #EEF2F7", padding: 12 }}>
                      {attempt.is_submitted ? `${attempt.score} / ${attempt.max_score} · ${attempt.percent}%` : expiredLocally ? "обновляется..." : "—"}
                    </td>
                    <td style={{ borderBottom: "1px solid #EEF2F7", padding: 12 }}>
                      {shouldOpenResult ? "Завершена" : "В процессе"}
                    </td>
                    <td style={{ borderBottom: "1px solid #EEF2F7", padding: 12 }}>
                      {formatDate(attempt.finished_at || attempt.deadline_at || attempt.started_at)}
                    </td>
                    <td style={{ borderBottom: "1px solid #EEF2F7", padding: 12, textAlign: "right" }}>
                      <Link
                        to={attemptActionLink}
                        style={{
                          background: shouldOpenResult ? "#2563EB" : "white",
                          color: shouldOpenResult ? "white" : "#0F172A",
                          border: shouldOpenResult ? "none" : "1px solid #E6EEF6",
                          padding: "7px 10px",
                          borderRadius: 8,
                        }}
                      >
                        {actionLabel}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
