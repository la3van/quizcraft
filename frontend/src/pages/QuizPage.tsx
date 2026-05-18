import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getQuiz } from "../api/quizzes";
import { createAttempt, submitAttempt } from "../api/attempts";
import type { QuizDetail, QuizQuestion, SubmitAnswer } from "../api/types";
import QuestionCard from "../components/QuestionCard";
import type { AnswerDraft } from "../components/QuestionCard";
import { pluralizeQuestions } from "../utils/pluralize";

type AnswersMap = Record<number, AnswerDraft>;
type OptionOrderMap = Record<string, number[]>;

const panel = {
  background: "white",
  border: "1px solid #E6EEF6",
  borderRadius: 14,
  padding: 18,
  boxShadow: "0 6px 22px rgba(15,23,42,0.06)",
} as const;

function formatTime(totalSeconds: number | null) {
  if (totalSeconds === null) return "Без ограничения";
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function reorderQuestions(questions: QuizQuestion[], order: number[] | null, optionOrder: OptionOrderMap): QuizQuestion[] {
  const byId = new Map(questions.map((question) => [question.id, question]));
  const base = order && order.length > 0
    ? order.map((id) => byId.get(id)).filter((item): item is QuizQuestion => Boolean(item))
    : [...questions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return base.map((question) => {
    const ids = optionOrder[String(question.id)] ?? [];
    if (ids.length === 0) return question;

    const optionsById = new Map(question.options.map((option) => [option.id, option]));
    const orderedOptions = ids.map((id) => optionsById.get(id)).filter((item): item is QuizQuestion["options"][number] => Boolean(item));
    const missingOptions = question.options.filter((option) => !ids.includes(option.id));
    return { ...question, options: [...orderedOptions, ...missingOptions] };
  });
}

export default function QuizPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const quizId = Number(id);

  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<AnswersMap>({});
  const [questionOrder, setQuestionOrder] = useState<number[] | null>(null);
  const [optionOrder, setOptionOrder] = useState<OptionOrderMap>({});
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadQuiz() {
      try {
        setErr(null);
        setQuiz(null);
        setAttemptId(null);
        setAnswers({});
        setQuestionOrder(null);
        setOptionOrder({});
        setDeadlineAt(null);
        setRemainingSeconds(null);
        setAutoSubmitted(false);

        const data = await getQuiz(quizId);
        if (cancelled) return;

        setQuiz(data);
        const init: AnswersMap = {};
        for (const question of data.questions) init[question.id] = { selected_options: [], text_answer: "", number_answer: "" };
        setAnswers(init);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Не удалось загрузить квиз.");
      }
    }

    if (Number.isFinite(quizId)) loadQuiz();

    return () => {
      cancelled = true;
    };
  }, [quizId]);

  const displayQuestions = useMemo(() => {
    if (!quiz) return [];
    return reorderQuestions(quiz.questions, questionOrder, optionOrder);
  }, [quiz, questionOrder, optionOrder]);

  const answeredCount = useMemo(
    () => displayQuestions.filter((question) => {
      const value = answers[question.id];
      if (!value) return false;
      if (question.type === "input_text") return value.text_answer.trim().length > 0;
      if (question.type === "input_number") return value.number_answer.trim().length > 0;
      return value.selected_options.length > 0;
    }).length,
    [answers, displayQuestions],
  );

  useEffect(() => {
    if (!deadlineAt || !attemptId) {
      setRemainingSeconds(null);
      return;
    }

    const deadline = deadlineAt;

    function tick() {
      const diff = Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000));
      setRemainingSeconds(diff);
    }

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [deadlineAt, attemptId]);

  useEffect(() => {
    if (!attemptId || autoSubmitted || busy || remainingSeconds !== 0) return;
    setAutoSubmitted(true);
    void onSubmit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, autoSubmitted, busy, remainingSeconds]);

  async function onStartAttempt() {
    try {
      setBusy(true);
      setErr(null);
      const created = await createAttempt(quizId);
      setAttemptId(created.id);
      setQuestionOrder(created.question_order ?? null);
      setOptionOrder(created.option_order ?? {});
      setDeadlineAt(created.deadline_at);
      setAutoSubmitted(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось начать попытку.");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(auto = false) {
    if (!attemptId || !quiz) return;

    if (!auto) {
      const confirmed = window.confirm(
        answeredCount < displayQuestions.length
          ? `Ты ответил на ${answeredCount} из ${displayQuestions.length} вопросов. Всё равно завершить попытку?`
          : "Завершить попытку и отправить ответы?",
      );
      if (!confirmed) return;
    }

    try {
      setBusy(true);
      setErr(null);

      const payload: SubmitAnswer[] = displayQuestions.map((question) => {
        const value = answers[question.id] ?? { selected_options: [], text_answer: "", number_answer: "" };
        return {
          question: question.id,
          selected_options: value.selected_options,
          text_answer: value.text_answer || null,
          number_answer: value.number_answer.trim() === "" ? null : Number(value.number_answer),
        };
      });

      const result = await submitAttempt(attemptId, { answers: payload });
      navigate(`/attempts/${result.id}/result`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось отправить ответы.");
    } finally {
      setBusy(false);
    }
  }

  if (!quiz && !err) return <div>Загрузка...</div>;
  if (err && !quiz) return <div style={{ color: "#B91C1C" }}>Ошибка: {err}</div>;
  if (!quiz) return <div>Квиз не найден.</div>;

  const canStart = quiz.publish_status === "published" && displayQuestions.length > 0;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 8px", fontSize: 34 }}>{quiz.title}</h2>
          <p style={{ margin: 0, color: "#64748B", maxWidth: 780 }}>{quiz.description || "Без описания"}</p>
        </div>
        <Link to="/quizzes" style={{ background: "white", color: "#0F172A", border: "1px solid #E6EEF6", borderRadius: 8, padding: "9px 12px" }}>
          Назад к квизам
        </Link>
      </div>

      {err && (
        <div style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA", borderRadius: 10, padding: 12 }}>
          {err}
        </div>
      )}

      <section style={panel}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <div>
            <strong style={{ fontSize: 24 }}>{quiz.questions.length}</strong>
            <div style={{ color: "#64748B" }}>{pluralizeQuestions(quiz.questions.length)}</div>
          </div>
          <div>
            <strong style={{ fontSize: 24 }}>{quiz.max_score}</strong>
            <div style={{ color: "#64748B" }}>максимум баллов</div>
          </div>
          <div>
            <strong style={{ fontSize: 24 }}>{quiz.difficulty_label}</strong>
            <div style={{ color: "#64748B" }}>сложность</div>
          </div>
          <div>
            <strong style={{ fontSize: 24 }}>{quiz.publish_status_label}</strong>
            <div style={{ color: "#64748B" }}>статус</div>
          </div>
          <div>
            <strong style={{ fontSize: 24 }}>{quiz.time_limit_minutes ? `${quiz.time_limit_minutes} мин` : "—"}</strong>
            <div style={{ color: "#64748B" }}>таймер</div>
          </div>
          <div>
            <strong style={{ fontSize: 24 }}>{quiz.max_attempts || "∞"}</strong>
            <div style={{ color: "#64748B" }}>попыток</div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #E6EEF6", marginTop: 16, paddingTop: 16, display: "grid", gap: 8 }}>
          <div style={{ color: "#64748B" }}>
            Код доступа: <strong style={{ color: "#0F172A" }}>{quiz.access_code}</strong> · Ссылка: <strong style={{ color: "#0F172A" }}>/join/{quiz.access_code}</strong>
          </div>
          <div style={{ color: "#64748B" }}>
            {quiz.shuffle_questions ? "Вопросы перемешиваются" : "Порядок вопросов фиксирован"} · {quiz.shuffle_options ? "варианты перемешиваются" : "порядок вариантов фиксирован"} · {quiz.feedback_policy_label}
          </div>
        </div>

        {quiz.attachments.length > 0 && (
          <div style={{ borderTop: "1px solid #E6EEF6", marginTop: 16, paddingTop: 16 }}>
            <strong>Файлы квиза</strong>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {quiz.attachments.map((file) => (
                <a key={file.id} href={file.url} target="_blank" rel="noreferrer" style={{ border: "1px solid #E6EEF6", borderRadius: 8, padding: "6px 10px" }}>
                  {file.title || file.filename}
                </a>
              ))}
            </div>
          </div>
        )}
      </section>

      {!attemptId ? (
        <section style={{ ...panel, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: "0 0 4px" }}>Готов начать?</h3>
            <div style={{ color: "#64748B" }}>
              {canStart ? "После старта будет создана попытка. Ответы можно отправить один раз." : "Этот квиз пока нельзя пройти: он не опубликован или в нём нет вопросов."}
            </div>
          </div>
          <button onClick={onStartAttempt} disabled={busy || !canStart} style={{ background: "#2563EB", color: "white", padding: "10px 16px", borderRadius: 8 }}>
            {busy ? "Создаём..." : "Начать попытку"}
          </button>
        </section>
      ) : (
        <section style={{ ...panel, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: "0 0 4px" }}>Попытка #{attemptId}</h3>
            <div style={{ color: "#64748B" }}>Отвечено: {answeredCount} из {displayQuestions.length}</div>
            <div style={{ color: remainingSeconds !== null && remainingSeconds <= 30 ? "#B91C1C" : "#64748B", fontWeight: 700 }}>
              Осталось времени: {formatTime(remainingSeconds)}
            </div>
          </div>
          <button onClick={() => onSubmit(false)} disabled={busy} style={{ background: "#06B6D4", color: "white", padding: "10px 16px", borderRadius: 8 }}>
            {busy ? "Отправляем..." : "Завершить и отправить"}
          </button>
        </section>
      )}

      <div style={{ display: "grid", gap: 14 }}>
        {displayQuestions.map((question, index) => (
          <QuestionCard
            key={question.id}
            question={question}
            index={index}
            value={answers[question.id] ?? { selected_options: [], text_answer: "", number_answer: "" }}
            disabled={attemptId === null || busy}
            onChange={(next) => setAnswers((prev) => ({ ...prev, [question.id]: next }))}
          />
        ))}
      </div>
    </div>
  );
}
