import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getQuizByCode } from "../api/quizzes";

export default function JoinQuiz() {
  const { code: pathCode } = useParams();
  const [searchParams] = useSearchParams();
  const queryCode = searchParams.get("code") ?? "";
  const initialCode = pathCode ?? queryCode;
  const navigate = useNavigate();
  const [inputCode, setInputCode] = useState(initialCode);
  const [loading, setLoading] = useState(Boolean(initialCode));
  const [error, setError] = useState<string | null>(null);

  async function openByCode(rawCode: string) {
    const cleanCode = rawCode.trim().toUpperCase();
    if (!cleanCode) {
      setError("Введите код доступа.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const quiz = await getQuizByCode(cleanCode);
      const quizPath = quiz.kind === "trivia" ? "trivia" : "quizzes";
      navigate(`/${quizPath}/${quiz.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Квиз или викторина с таким кодом не найдены или недоступны.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!initialCode) return;
    setInputCode(initialCode.toUpperCase());
    void openByCode(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void openByCode(inputCode);
  }

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", display: "grid", gap: 16 }}>
      <div>
        <h2 style={{ margin: "0 0 8px", fontSize: 34 }}>Войти по коду</h2>
        <p style={{ margin: 0, color: "#64748B" }}>Введите код квиза или викторины, который выдал преподаватель.</p>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA", borderRadius: 10, padding: 12 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ background: "white", border: "1px solid #E6EEF6", borderRadius: 14, padding: 18, display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
          Код доступа
          <input
            value={inputCode}
            onChange={(event) => setInputCode(event.target.value.toUpperCase())}
            placeholder="Например: A1B2C3"
            autoFocus
          />
        </label>
        <button type="submit" disabled={loading} style={{ background: "#2563EB", color: "white" }}>
          {loading ? "Открываем..." : "Открыть"}
        </button>
      </form>
    </div>
  );
}
