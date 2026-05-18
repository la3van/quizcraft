import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getQuizzes } from "../api/quizzes";
import { pluralizeQuestions } from "../utils/pluralize";
import type { QuizListItem } from "../api/types";

export default function QuizzesList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const owner = searchParams.get("owner");
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        const params: Record<string, string> = { page: currentPage.toString() };

        if (owner === "me") {
          params.scope = "mine";
        } else {
          params.scope = "available";
        }

        const data = await getQuizzes(params);
        setQuizzes(data.results);
        setTotalPages(Math.max(1, Math.ceil(data.count / 10)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    fetchQuizzes();
  }, [currentPage, owner]);

  function setMineMode(nextMine: boolean) {
    setCurrentPage(1);
    setSearchParams(nextMine ? { owner: "me" } : {});
  }

  if (loading) return <div>Загрузка...</div>;
  if (error) return <div>Ошибка: {error}</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ marginBottom: 8 }}>{owner === "me" ? "Мои викторины" : "Каталог викторин"}</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setMineMode(false)} style={{ background: owner === "me" ? "white" : "#2563EB", color: owner === "me" ? "#0F172A" : "white", border: "1px solid #E6EEF6" }}>
              Доступные квизы
            </button>
            <button onClick={() => setMineMode(true)} style={{ background: owner === "me" ? "#2563EB" : "white", color: owner === "me" ? "white" : "#0F172A", border: "1px solid #E6EEF6" }}>
              Мои квизы
            </button>
          </div>
        </div>
        <Link to="/quizzes/create" style={{ background: "#06B6D4", color: "white", padding: "8px 12px", borderRadius: 8 }}>
          Создать викторину
        </Link>
      </div>

      {quizzes.length === 0 && <div style={{ color: "#64748B" }}>Квизов пока нет.</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {quizzes.map((q) => (
          <div key={q.id} style={{ background: "white", padding: 16, borderRadius: 8, boxShadow: "0 1px 6px rgba(2,6,23,0.06)", display: "grid", gap: 8 }}>
            <h3 style={{ margin: 0 }}>{q.title}</h3>
            <p style={{ margin: 0, color: "#64748B" }}>{q.description}</p>
            <p style={{ margin: 0, color: "#64748B" }}>{q.status} · {q.difficulty_label}</p>
            <p style={{ margin: 0, color: "#64748B" }}>{q.question_count} {pluralizeQuestions(q.question_count)}</p>
            <p style={{ margin: 0, color: "#64748B" }}>Код: <strong style={{ color: "#0F172A" }}>{q.access_code}</strong></p>
            <p style={{ margin: 0, color: "#64748B" }}>Таймер: {q.time_limit_minutes ? `${q.time_limit_minutes} мин` : "без ограничения"} · Попытки: {q.max_attempts || "∞"}</p>
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link to={`/quizzes/${q.id}`} style={{ background: q.publish_status === "published" ? "#2563EB" : "#94A3B8", color: "white", padding: "8px 10px", borderRadius: 8 }}>
                {q.publish_status === "published" ? "Начать" : "Просмотр"}
              </Link>
              {q.is_owner && (
                <>
                  <Link to={`/quizzes/${q.id}/edit`} style={{ background: "white", color: "#0F172A", padding: "8px 10px", borderRadius: 8, border: "1px solid #E6EEF6" }}>
                    Редактировать
                  </Link>
                  <Link to={`/quizzes/${q.id}/analytics`} style={{ background: "white", color: "#0F172A", padding: "8px 10px", borderRadius: 8, border: "1px solid #E6EEF6" }}>
                    Аналитика
                  </Link>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 20, gap: 8 }}>
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
    </div>
  );
}
