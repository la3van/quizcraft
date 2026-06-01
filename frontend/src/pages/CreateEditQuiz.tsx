import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createQuiz, deleteQuizAttachment, getQuizForEdit, updateQuiz, uploadQuizAttachments } from "../api/quizzes";
import { getBankQuestions } from "../api/questions";
import type { BankQuestion, QuestionMediaKind, QuestionType, QuizAttachment, QuizCreateRequest, QuizDeliveryMode, QuizKind, QuizDifficulty, QuizFeedbackPolicy, QuizPublishStatus, QuizVisibility } from "../api/types";

type DraftQuestionType = QuestionType;

type DraftOption = {
  clientId: string;
  text: string;
  isCorrect: boolean;
};

type DraftQuestion = {
  clientId: string;
  text: string;
  explanation: string;
  tags: string;
  learningGoal: string;
  type: DraftQuestionType;
  points: number;
  options: DraftOption[];
  mediaKind: QuestionMediaKind;
  mediaUrl: string;
  correctText: string;
  correctNumber: string;
  numericTolerance: string;
};

const panelStyle: CSSProperties = {
  background: "white",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 1px 6px rgba(2,6,23,0.06)",
};

const labelStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  fontWeight: 600,
  color: "#0F172A",
  minWidth: 0,
};

const helpTextStyle: CSSProperties = {
  margin: 0,
  color: "#64748B",
  fontSize: 13,
  fontWeight: 400,
};

const secondaryButtonStyle: CSSProperties = {
  background: "white",
  color: "#0F172A",
  border: "1px solid #E6EEF6",
};

const dangerButtonStyle: CSSProperties = {
  background: "#DC2626",
  color: "white",
};

function makeClientId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function makeOption(text = "", isCorrect = false): DraftOption {
  return {
    clientId: makeClientId(),
    text,
    isCorrect,
  };
}

function makeQuestion(order: number): DraftQuestion {
  return {
    clientId: makeClientId(),
    text: `Вопрос ${order + 1}`,
    explanation: "",
    tags: "",
    learningGoal: "",
    type: "choice_single",
    points: 1,
    options: [makeOption("Вариант 1", true), makeOption("Вариант 2")],
    mediaKind: "none",
    mediaUrl: "",
    correctText: "",
    correctNumber: "",
    numericTolerance: "0",
  };
}

function questionFromBank(question: BankQuestion): DraftQuestion {
  return {
    clientId: makeClientId(),
    text: question.text,
    explanation: question.explanation ?? "",
    tags: question.tags ?? "",
    learningGoal: question.learning_goal ?? "",
    type: question.type,
    points: question.points,
    options: question.options.map((option) => makeOption(option.text, option.is_correct)),
    mediaKind: question.media_kind ?? "none",
    mediaUrl: question.media_file_url || question.media_url || "",
    correctText: question.correct_text ?? "",
    correctNumber: question.correct_number === null || question.correct_number === undefined ? "" : String(question.correct_number),
    numericTolerance: String(question.numeric_tolerance ?? 0),
  };
}

function parseAllowedLogins(value: string) {
  return value
    .split(/[\s,;]+/)
    .map((login) => login.trim())
    .filter(Boolean);
}

function getQuestionTypeLabel(type: DraftQuestionType) {
  if (type === "choice_single") return "Один вариант";
  if (type === "choice_multi") return "Несколько вариантов";
  if (type === "tf") return "Верно/неверно";
  if (type === "input_text") return "Краткий ответ";
  return "Числовой ответ";
}

function isChoiceType(type: DraftQuestionType) {
  return type === "choice_single" || type === "choice_multi" || type === "tf";
}

function getDifficultyLabel(difficulty: QuizDifficulty) {
  if (difficulty === "easy") return "Лёгкий";
  if (difficulty === "hard") return "Сложный";
  return "Средний";
}

export default function CreateEditQuiz({ initialKind = "quiz" }: { initialKind?: QuizKind }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const editId = id ? Number(id) : null;
  const isEditMode = Number.isFinite(editId) && editId !== null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<QuizKind>(initialKind);
  const [visibility, setVisibility] = useState<QuizVisibility>("public");
  const [difficulty, setDifficulty] = useState<QuizDifficulty>("medium");
  const [publishStatus, setPublishStatus] = useState<QuizPublishStatus>("published");
  const [timeLimitMinutesText, setTimeLimitMinutesText] = useState("");
  const [maxAttemptsText, setMaxAttemptsText] = useState("0");
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [feedbackPolicy, setFeedbackPolicy] = useState<QuizFeedbackPolicy>("after_submit");
  const [deliveryMode, setDeliveryMode] = useState<QuizDeliveryMode>("self_paced");
  const [accessCode, setAccessCode] = useState("");
  const [allowedLoginsText, setAllowedLoginsText] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>(() => [makeQuestion(0)]);
  const [selectedQuestionId, setSelectedQuestionId] = useState(() => questions[0]?.clientId ?? "");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(isEditMode));
  const [error, setError] = useState<string | null>(null);
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [bankQuestionsCount, setBankQuestionsCount] = useState(0);
  const [bankPage, setBankPage] = useState(1);
  const [bankPageSize, setBankPageSize] = useState("5");
  const [bankSearch, setBankSearch] = useState("");
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<QuizAttachment[]>([]);
  const bankTotalPages = Math.max(1, Math.ceil(bankQuestionsCount / Number(bankPageSize || 5)));
  const entityLabel = kind === "trivia" ? "викторину" : "квиз";
  const entityLabelCapitalized = kind === "trivia" ? "Викторина" : "Квиз";

  useEffect(() => {
    let cancelled = false;

    async function loadBank() {
      try {
        const data = await getBankQuestions({ page: String(bankPage), page_size: bankPageSize, search: bankSearch });
        if (!cancelled) {
          setBankQuestions(data.results);
          setBankQuestionsCount(data.count);
        }
      } catch {
        if (!cancelled) {
          setBankQuestions([]);
          setBankQuestionsCount(0);
        }
      }
    }

    loadBank();
    return () => {
      cancelled = true;
    };
  }, [bankSearch, bankPage, bankPageSize]);

  useEffect(() => {
    if (!isEditMode || !editId) return;
    const quizIdForEdit = editId;
    let cancelled = false;

    async function loadQuiz() {
      try {
        setLoading(true);
        setError(null);
        const data = await getQuizForEdit(quizIdForEdit);
        if (cancelled) return;
        setTitle(data.title);
        setDescription(data.description);
        setKind(data.kind);
        setVisibility(data.visibility);
        setDifficulty(data.difficulty);
        setPublishStatus(data.publish_status);
        setAccessCode(data.access_code);
        setTimeLimitMinutesText(data.time_limit_minutes ? String(data.time_limit_minutes) : "");
        setMaxAttemptsText(String(data.max_attempts ?? 0));
        setShuffleQuestions(Boolean(data.shuffle_questions));
        setShuffleOptions(Boolean(data.shuffle_options));
        setFeedbackPolicy(data.feedback_policy);
        setAllowedLoginsText(data.allowed_logins.join(", "));
        setExistingAttachments(data.attachments ?? []);
        const loadedQuestions = data.questions
          .sort((a, b) => a.order - b.order)
          .map<DraftQuestion>((question) => ({
            clientId: makeClientId(),
            text: question.text,
            explanation: question.explanation ?? "",
            tags: question.tags ?? "",
            learningGoal: question.learning_goal ?? "",
            type: question.type,
            points: question.points,
            options: question.options.map((option) => makeOption(option.text, option.is_correct)),
            mediaKind: question.media_kind ?? "none",
            mediaUrl: question.media_file_url || question.media_url || "",
            correctText: question.correct_text ?? "",
            correctNumber: question.correct_number === null || question.correct_number === undefined ? "" : String(question.correct_number),
            numericTolerance: String(question.numeric_tolerance ?? 0),
          }));
        const nextQuestions = loadedQuestions.length ? loadedQuestions : [makeQuestion(0)];
        setQuestions(nextQuestions);
        setSelectedQuestionId(nextQuestions[0].clientId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить квиз для редактирования.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadQuiz();
    return () => {
      cancelled = true;
    };
  }, [editId, isEditMode]);

  const selectedQuestion = useMemo(
    () => questions.find((question) => question.clientId === selectedQuestionId) ?? questions[0],
    [questions, selectedQuestionId],
  );

  const totalPoints = useMemo(
    () => questions.reduce((sum, question) => sum + (Number.isFinite(question.points) ? question.points : 0), 0),
    [questions],
  );

  function updateQuestion(questionId: string, updater: (question: DraftQuestion) => DraftQuestion) {
    setQuestions((prev) => prev.map((question) => (question.clientId === questionId ? updater(question) : question)));
  }

  function addQuestion() {
    setQuestions((prev) => {
      const nextQuestion = makeQuestion(prev.length);
      setSelectedQuestionId(nextQuestion.clientId);
      return [...prev, nextQuestion];
    });
  }

  function addBankQuestion(question: BankQuestion) {
    const draft = questionFromBank(question);
    setQuestions((prev) => [...prev, draft]);
    setSelectedQuestionId(draft.clientId);
  }

  function duplicateQuestion(questionId: string) {
    setQuestions((prev) => {
      const source = prev.find((question) => question.clientId === questionId);
      if (!source) return prev;

      const copy: DraftQuestion = {
        ...source,
        clientId: makeClientId(),
        text: `${source.text} — копия`,
        options: source.options.map((option) => ({ ...option, clientId: makeClientId() })),
      };

      setSelectedQuestionId(copy.clientId);
      return [...prev, copy];
    });
  }

  function deleteQuestion(questionId: string) {
    setQuestions((prev) => {
      if (prev.length === 1) {
        setError(`${entityLabelCapitalized}: должен остаться хотя бы один вопрос.`);
        return prev;
      }

      const deletedIndex = prev.findIndex((question) => question.clientId === questionId);
      const next = prev.filter((question) => question.clientId !== questionId);

      if (selectedQuestionId === questionId) {
        const fallbackIndex = Math.max(0, deletedIndex - 1);
        setSelectedQuestionId(next[fallbackIndex]?.clientId ?? next[0]?.clientId ?? "");
      }

      return next;
    });
  }

  function setQuestionType(questionId: string, nextType: DraftQuestionType) {
    updateQuestion(questionId, (question) => {
      if (nextType === "choice_multi") return { ...question, type: nextType };

      if (nextType === "tf") {
        return {
          ...question,
          type: nextType,
          options: [makeOption("Верно", true), makeOption("Неверно", false)],
        };
      }

      if (nextType === "input_text" || nextType === "input_number") {
        return { ...question, type: nextType, options: [] };
      }

      const currentOptions = question.options.length >= 2 ? question.options : [makeOption("Вариант 1", true), makeOption("Вариант 2")];
      const firstCorrectIndex = currentOptions.findIndex((option) => option.isCorrect);
      const correctIndex = firstCorrectIndex >= 0 ? firstCorrectIndex : 0;

      return {
        ...question,
        type: nextType,
        options: currentOptions.map((option, index) => ({ ...option, isCorrect: index === correctIndex })),
      };
    });
  }

  function addOption(questionId: string) {
    updateQuestion(questionId, (question) => ({
      ...question,
      options: [
        ...question.options,
        makeOption(`Вариант ${question.options.length + 1}`, (question.type === "choice_single" || question.type === "tf") && question.options.length === 0),
      ],
    }));
  }

  function updateOptionText(questionId: string, optionId: string, text: string) {
    updateQuestion(questionId, (question) => ({
      ...question,
      options: question.options.map((option) => (option.clientId === optionId ? { ...option, text } : option)),
    }));
  }

  function setSingleCorrectOption(questionId: string, optionId: string) {
    updateQuestion(questionId, (question) => ({
      ...question,
      options: question.options.map((option) => ({ ...option, isCorrect: option.clientId === optionId })),
    }));
  }

  function toggleMultiCorrectOption(questionId: string, optionId: string) {
    updateQuestion(questionId, (question) => ({
      ...question,
      options: question.options.map((option) => (option.clientId === optionId ? { ...option, isCorrect: !option.isCorrect } : option)),
    }));
  }

  function deleteOption(questionId: string, optionId: string) {
    updateQuestion(questionId, (question) => {
      if (question.options.length <= 2) {
        setError("Для вопроса с выбором нужно минимум два варианта ответа.");
        return question;
      }

      const nextOptions = question.options.filter((option) => option.clientId !== optionId);

      if ((question.type === "choice_single" || question.type === "tf") && !nextOptions.some((option) => option.isCorrect)) {
        return {
          ...question,
          options: nextOptions.map((option, index) => ({ ...option, isCorrect: index === 0 })),
        };
      }

      return { ...question, options: nextOptions };
    });
  }

  function buildPayload(): QuizCreateRequest | null {
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    const allowedLogins = parseAllowedLogins(allowedLoginsText);
    const cleanTimeLimit = timeLimitMinutesText.trim();
    const timeLimitMinutes = cleanTimeLimit ? Number(cleanTimeLimit) : null;
    const maxAttempts = maxAttemptsText.trim() ? Number(maxAttemptsText) : 0;

    if (!cleanTitle) {
      setError(`Заполни название: ${entityLabel} не может быть без имени.`);
      return null;
    }

    if (visibility === "private" && allowedLogins.length === 0) {
      setError("Для приватного квиза укажи хотя бы один логин/email пользователя.");
      return null;
    }

    if (timeLimitMinutes !== null && (!Number.isInteger(timeLimitMinutes) || timeLimitMinutes <= 0)) {
      setError("Время на квиз должно быть целым числом больше 0 или пустым.");
      return null;
    }

    if (!Number.isInteger(maxAttempts) || maxAttempts < 0) {
      setError("Количество попыток должно быть целым числом от 0. 0 означает без ограничений.");
      return null;
    }

    if (questions.length === 0) {
      setError("Добавь хотя бы один вопрос.");
      return null;
    }

    const payloadQuestions: QuizCreateRequest["questions"] = [];

    for (let index = 0; index < questions.length; index += 1) {
      const question = questions[index];
      const questionText = question.text.trim();
      const explanation = question.explanation.trim();
      const points = Number(question.points);
      const cleanOptions = question.options
        .map((option) => ({ text: option.text.trim(), is_correct: option.isCorrect }))
        .filter((option) => option.text.length > 0);
      const correctOptionsCount = cleanOptions.filter((option) => option.is_correct).length;

      if (!questionText) {
        setSelectedQuestionId(question.clientId);
        setError(`Заполни текст вопроса №${index + 1}.`);
        return null;
      }

      if (!Number.isFinite(points) || points <= 0) {
        setSelectedQuestionId(question.clientId);
        setError(`Баллы в вопросе №${index + 1} должны быть больше 0.`);
        return null;
      }

      if (isChoiceType(question.type) && cleanOptions.length < 2) {
        setSelectedQuestionId(question.clientId);
        setError(`В вопросе №${index + 1} должно быть минимум два непустых варианта ответа.`);
        return null;
      }

      if ((question.type === "choice_single" || question.type === "tf") && correctOptionsCount !== 1) {
        setSelectedQuestionId(question.clientId);
        setError(`В вопросе №${index + 1} должен быть ровно один правильный ответ.`);
        return null;
      }

      if (question.type === "choice_multi" && correctOptionsCount < 1) {
        setSelectedQuestionId(question.clientId);
        setError(`В вопросе №${index + 1} нужен хотя бы один правильный ответ.`);
        return null;
      }

      if (question.type === "input_text" && !question.correctText.trim()) {
        setSelectedQuestionId(question.clientId);
        setError(`Для краткого ответа в вопросе №${index + 1} укажи правильный ответ.`);
        return null;
      }

      if (question.type === "input_number" && question.correctNumber.trim() === "") {
        setSelectedQuestionId(question.clientId);
        setError(`Для числового ответа в вопросе №${index + 1} укажи правильное число.`);
        return null;
      }

      const numericTolerance = Number(question.numericTolerance || 0);
      if (!Number.isFinite(numericTolerance) || numericTolerance < 0) {
        setSelectedQuestionId(question.clientId);
        setError(`Допуск в вопросе №${index + 1} должен быть числом от 0.`);
        return null;
      }

      payloadQuestions.push({
        text: questionText,
        explanation,
        tags: question.tags.trim(),
        learning_goal: question.learningGoal.trim(),
        type: question.type,
        points,
        order: index,
        options: isChoiceType(question.type) ? cleanOptions : [],
        media_kind: question.mediaUrl.trim() ? question.mediaKind : "none",
        media_url: question.mediaUrl.trim() || null,
        correct_text: question.type === "input_text" ? question.correctText.trim() : null,
        correct_number: question.type === "input_number" ? Number(question.correctNumber) : null,
        numeric_tolerance: numericTolerance,
      });
    }

    return {
      title: cleanTitle,
      description: cleanDescription,
      kind,
      visibility,
      difficulty,
      publish_status: publishStatus,
      time_limit_minutes: timeLimitMinutes,
      max_attempts: maxAttempts,
      shuffle_questions: shuffleQuestions,
      shuffle_options: shuffleOptions,
      feedback_policy: feedbackPolicy,
      delivery_mode: deliveryMode,
      allowed_logins: visibility === "private" ? allowedLogins : [],
      questions: payloadQuestions,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const payload = buildPayload();
    if (!payload) return;

    try {
      setSaving(true);
      const savedQuiz = isEditMode && editId ? await updateQuiz(editId, payload) : await createQuiz(payload);
      if (newFiles.length > 0) {
        await uploadQuizAttachments(savedQuiz.id, newFiles);
      }
      navigate(`/quizzes/${savedQuiz.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить квиз.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAttachment(attachmentId: number) {
    if (!editId) return;
    try {
      await deleteQuizAttachment(editId, attachmentId);
      setExistingAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить файл.");
    }
  }

  if (loading) {
    return <div>Загрузка редактора...</div>;
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ marginBottom: 6 }}>{isEditMode ? `Редактировать ${entityLabel}` : `Создать ${entityLabel}`}</h2>
          <p style={{ margin: 0, color: "#64748B" }}>
            Собери материал из новых вопросов или добавь готовые вопросы из общего банка.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" onClick={() => navigate("/quizzes?owner=me")} style={secondaryButtonStyle}>
            Отмена
          </button>
          <button type="submit" disabled={saving} style={{ background: "#06B6D4", color: "white" }}>
            {saving ? "Сохраняем..." : isEditMode ? "Сохранить изменения" : `Сохранить ${entityLabel}`}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA", borderRadius: 10, padding: 12 }}>
          {error}
        </div>
      )}

      <section style={{ ...panelStyle, display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 220px 150px 150px 150px", gap: 12 }}>
          <label style={labelStyle}>
            Название
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={kind === "trivia" ? "Например: Кино и музыка 2000-х" : "Например: Математика 5 класс"}
            />
          </label>

          <label style={labelStyle}>
            Формат
            <select value={kind} onChange={(event) => setKind(event.target.value as QuizKind)}>
              <option value="quiz">Квиз: учебный/академический</option>
              <option value="trivia">Викторина: развлекательная</option>
            </select>
          </label>

          <label style={labelStyle}>
            Доступ
            <select value={visibility} onChange={(event) => setVisibility(event.target.value as QuizVisibility)}>
              <option value="public">Публичный</option>
              <option value="private">Приватный</option>
            </select>
          </label>

          <label style={labelStyle}>
            Сложность
            <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as QuizDifficulty)}>
              <option value="easy">Лёгкий</option>
              <option value="medium">Средний</option>
              <option value="hard">Сложный</option>
            </select>
          </label>

          <label style={labelStyle}>
            Статус
            <select value={publishStatus} onChange={(event) => setPublishStatus(event.target.value as QuizPublishStatus)}>
              <option value="draft">Черновик</option>
              <option value="published">Опубликован</option>
              <option value="archived">Архив</option>
            </select>
          </label>
        </div>

        <label style={labelStyle}>
          Описание
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="Кратко опиши, о чём этот квиз"
            style={{ resize: "vertical" }}
          />
        </label>

        {visibility === "private" && (
          <label style={labelStyle}>
            Логины или email пользователей, которым доступен квиз
            <input
              value={allowedLoginsText}
              onChange={(event) => setAllowedLoginsText(event.target.value)}
              placeholder="ivan, maria@example.com, student_01"
            />
            <p style={helpTextStyle}>Можно вводить через пробел, запятую или с новой строки.</p>
          </label>
        )}

        {isEditMode && accessCode && (
          <div style={{ border: "1px solid #E6EEF6", borderRadius: 10, padding: 12, background: "#F8FAFC", display: "grid", gap: 6 }}>
            <strong>Код доступа: {accessCode}</strong>
            <p style={helpTextStyle}>Ссылка для участников: /join/{accessCode}</p>
          </div>
        )}

        <div style={{ borderTop: "1px solid #E6EEF6", paddingTop: 14, display: "grid", gap: 12 }}>
          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: 18 }}>Проведение</h3>
            <p style={helpTextStyle}>Настрой таймер, число попыток, перемешивание и видимость обратной связи.</p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
              alignItems: "start",
            }}
          >
            <label style={labelStyle}>
              Время на квиз, минут
              <input
                type="number"
                min="1"
                step="1"
                value={timeLimitMinutesText}
                onChange={(event) => setTimeLimitMinutesText(event.target.value)}
                placeholder="Без ограничения"
              />
              <p style={helpTextStyle}>Пустое поле = таймера нет.</p>
            </label>

            <label style={labelStyle}>
              Количество попыток
              <input
                type="number"
                min="0"
                step="1"
                value={maxAttemptsText}
                onChange={(event) => setMaxAttemptsText(event.target.value)}
              />
              <p style={helpTextStyle}>0 = без ограничения.</p>
            </label>

            <label style={labelStyle}>
              Обратная связь
              <select value={feedbackPolicy} onChange={(event) => setFeedbackPolicy(event.target.value as QuizFeedbackPolicy)}>
                <option value="after_submit">Показать результат с разбором</option>
                <option value="score_only">Показать только результат</option>
                <option value="hidden">Скрыть результат</option>
              </select>
              <p style={helpTextStyle}>Что увидит участник после отправки попытки.</p>
            </label>

            <label style={labelStyle}>
              Режим проведения
              <select value={deliveryMode} onChange={(event) => setDeliveryMode(event.target.value as QuizDeliveryMode)}>
                <option value="self_paced">Самостоятельное прохождение</option>
                <option value="live">Live-прохождение</option>
              </select>
              <p style={helpTextStyle}>Live-режим помечается в карточке квиза; полноценные комнаты можно расширить отдельно.</p>
            </label>
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(event) => setShuffleQuestions(event.target.checked)}
                style={{ width: 16, height: 16, padding: 0 }}
              />
              Перемешивать вопросы
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={shuffleOptions}
                onChange={(event) => setShuffleOptions(event.target.checked)}
                style={{ width: 16, height: 16, padding: 0 }}
              />
              Перемешивать варианты
            </label>
          </div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label style={labelStyle}>
            Файлы квиза
            <input
              type="file"
              multiple
              onChange={(event) => setNewFiles(Array.from(event.target.files ?? []))}
            />
            <p style={helpTextStyle}>Файлы загрузятся после сохранения квиза. В админке их тоже можно добавлять в карточке квиза.</p>
          </label>

          {newFiles.length > 0 && (
            <div style={{ color: "#64748B", fontSize: 13 }}>
              Новые файлы: {newFiles.map((file) => file.name).join(", ")}
            </div>
          )}

          {existingAttachments.length > 0 && (
            <div style={{ display: "grid", gap: 6 }}>
              <strong>Загруженные файлы</strong>
              {existingAttachments.map((attachment) => (
                <div key={attachment.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", border: "1px solid #E6EEF6", borderRadius: 8, padding: 8 }}>
                  <a href={attachment.url} target="_blank" rel="noreferrer">{attachment.title || attachment.filename}</a>
                  <button type="button" onClick={() => removeAttachment(attachment.id)} style={{ ...dangerButtonStyle, padding: "6px 10px" }}>Удалить</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px, 300px) minmax(0, 1fr) minmax(260px, 300px)",
          gap: 16,
          alignItems: "start",
          minWidth: 0,
        }}
      >
        <aside style={{ ...panelStyle, display: "grid", gap: 12, minWidth: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18 }}>Вопросы</h3>
              <p style={helpTextStyle}>
                {questions.length} шт. · {totalPoints} балл(ов) · {getDifficultyLabel(difficulty)}
              </p>
            </div>
            <button type="button" onClick={addQuestion} style={{ background: "#06B6D4", color: "white", padding: "8px 10px" }}>
              +
            </button>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {questions.map((question, index) => {
              const active = question.clientId === selectedQuestion?.clientId;
              const correctCount = question.options.filter((option) => option.isCorrect).length;

              return (
                <button
                  key={question.clientId}
                  type="button"
                  onClick={() => setSelectedQuestionId(question.clientId)}
                  style={{
                    width: "100%",
                    minWidth: 0,
                    overflow: "hidden",
                    background: active ? "#E0F2FE" : "white",
                    color: "#0F172A",
                    border: active ? "1px solid #06B6D4" : "1px solid #E6EEF6",
                    textAlign: "left",
                    boxShadow: "none",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>Вопрос {index + 1}</div>
                  <div style={{ color: "#64748B", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {question.text || "Без текста"}
                  </div>
                  <div style={{ color: "#64748B", fontSize: 12, marginTop: 4 }}>
                    {getQuestionTypeLabel(question.type)} · правильных: {correctCount}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section style={{ ...panelStyle, minHeight: 360, minWidth: 0 }}>
          {!selectedQuestion ? (
            <p style={{ color: "#64748B" }}>Выбери вопрос слева или добавь новый.</p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ margin: 0 }}>Редактор вопроса</h3>
                  <p style={helpTextStyle}>Настрой текст, тип вопроса, баллы и правильные ответы.</p>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => duplicateQuestion(selectedQuestion.clientId)} style={secondaryButtonStyle}>
                    Дублировать
                  </button>
                  <button type="button" onClick={() => deleteQuestion(selectedQuestion.clientId)} style={dangerButtonStyle}>
                    Удалить
                  </button>
                </div>
              </div>

              <label style={labelStyle}>
                Текст вопроса
                <textarea
                  value={selectedQuestion.text}
                  onChange={(event) => updateQuestion(selectedQuestion.clientId, (question) => ({ ...question, text: event.target.value }))}
                  rows={4}
                  placeholder="Напиши формулировку вопроса"
                  style={{ resize: "vertical" }}
                />
              </label>

              <label style={labelStyle}>
                Объяснение после ответа
                <textarea
                  value={selectedQuestion.explanation}
                  onChange={(event) => updateQuestion(selectedQuestion.clientId, (question) => ({ ...question, explanation: event.target.value }))}
                  rows={3}
                  placeholder="Кратко объясни правильный ответ. Будет видно только в режиме результата с разбором."
                  style={{ resize: "vertical" }}
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 12 }}>
                <label style={labelStyle}>
                  Теги
                  <input
                    value={selectedQuestion.tags}
                    onChange={(event) => updateQuestion(selectedQuestion.clientId, (question) => ({ ...question, tags: event.target.value }))}
                    placeholder="например: python, циклы, базовый уровень"
                  />
                </label>

                <label style={labelStyle}>
                  Цель обучения
                  <input
                    value={selectedQuestion.learningGoal}
                    onChange={(event) => updateQuestion(selectedQuestion.clientId, (question) => ({ ...question, learningGoal: event.target.value }))}
                    placeholder="например: понять работу цикла for"
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 160px", gap: 12 }}>
                <label style={labelStyle}>
                  Тип вопроса
                  <select
                    value={selectedQuestion.type}
                    onChange={(event) => setQuestionType(selectedQuestion.clientId, event.target.value as DraftQuestionType)}
                  >
                    <option value="choice_single">Один правильный вариант</option>
                    <option value="choice_multi">Несколько правильных вариантов</option>
                    <option value="tf">Верно/неверно</option>
                    <option value="input_text">Краткий ответ</option>
                    <option value="input_number">Числовой ответ</option>
                  </select>
                </label>

                <label style={labelStyle}>
                  Баллы
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={selectedQuestion.points}
                    onChange={(event) =>
                      updateQuestion(selectedQuestion.clientId, (question) => ({ ...question, points: Number(event.target.value) }))
                    }
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "180px minmax(0, 1fr)", gap: 12 }}>
                <label style={labelStyle}>
                  Тип медиа
                  <select
                    value={selectedQuestion.mediaKind}
                    onChange={(event) => updateQuestion(selectedQuestion.clientId, (question) => ({ ...question, mediaKind: event.target.value as QuestionMediaKind }))}
                  >
                    <option value="none">Без медиа</option>
                    <option value="file">Файл/изображение</option>
                    <option value="audio">Аудио</option>
                    <option value="video">Видео</option>
                  </select>
                </label>

                <label style={labelStyle}>
                  Ссылка на медиа
                  <input
                    value={selectedQuestion.mediaUrl}
                    onChange={(event) => updateQuestion(selectedQuestion.clientId, (question) => ({ ...question, mediaUrl: event.target.value }))}
                    placeholder="https://... или /media/..."
                  />
                </label>
              </div>

              {selectedQuestion.type === "input_text" && (
                <label style={labelStyle}>
                  Правильный краткий ответ
                  <input
                    value={selectedQuestion.correctText}
                    onChange={(event) => updateQuestion(selectedQuestion.clientId, (question) => ({ ...question, correctText: event.target.value }))}
                    placeholder="Точное совпадение без учёта регистра"
                  />
                </label>
              )}

              {selectedQuestion.type === "input_number" && (
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 180px", gap: 12 }}>
                  <label style={labelStyle}>
                    Правильное число
                    <input
                      type="number"
                      value={selectedQuestion.correctNumber}
                      onChange={(event) => updateQuestion(selectedQuestion.clientId, (question) => ({ ...question, correctNumber: event.target.value }))}
                      placeholder="Например: 3.14"
                    />
                  </label>
                  <label style={labelStyle}>
                    Допуск
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={selectedQuestion.numericTolerance}
                      onChange={(event) => updateQuestion(selectedQuestion.clientId, (question) => ({ ...question, numericTolerance: event.target.value }))}
                    />
                  </label>
                </div>
              )}

              {isChoiceType(selectedQuestion.type) && (
                <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <h4 style={{ margin: 0 }}>Варианты ответа</h4>
                    <p style={helpTextStyle}>
                      {selectedQuestion.type === "choice_single"
                        ? "Отметь радиокнопкой один правильный ответ."
                        : "Отметь чекбоксами один или несколько правильных ответов."}
                    </p>
                  </div>
                  <button type="button" onClick={() => addOption(selectedQuestion.clientId)} style={secondaryButtonStyle}>
                    + Добавить вариант
                  </button>
                </div>

                {selectedQuestion.options.map((option, index) => (
                  <div
                    key={option.clientId}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "32px minmax(0, 1fr) auto",
                      gap: 8,
                      alignItems: "center",
                      border: "1px solid #E6EEF6",
                      borderRadius: 10,
                      padding: 10,
                    }}
                  >
                    <input
                      aria-label="Правильный ответ"
                      type={selectedQuestion.type === "choice_multi" ? "checkbox" : "radio"}
                      checked={option.isCorrect}
                      onChange={() => {
                        if (selectedQuestion.type === "choice_multi") {
                          toggleMultiCorrectOption(selectedQuestion.clientId, option.clientId);
                        } else {
                          setSingleCorrectOption(selectedQuestion.clientId, option.clientId);
                        }
                      }}
                    />
                    <input
                      value={option.text}
                      onChange={(event) => updateOptionText(selectedQuestion.clientId, option.clientId, event.target.value)}
                      placeholder={`Вариант ${index + 1}`}
                    />
                    <button type="button" onClick={() => deleteOption(selectedQuestion.clientId, option.clientId)} style={dangerButtonStyle}>
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
              )}
            </div>
          )}
        </section>

        <aside style={{ ...panelStyle, display: "grid", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18 }}>Банк вопросов</h3>
            <p style={helpTextStyle}>Можно добавить вопрос из общего банка в текущий материал.</p>
          </div>
          <input value={bankSearch} onChange={(event) => { setBankSearch(event.target.value); setBankPage(1); }} placeholder="Поиск по вопросам" />
          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <button type="button" onClick={() => navigate("/questions")} style={secondaryButtonStyle}>
              Открыть банк вопросов
            </button>
            <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748B", fontSize: 13 }}>
              На странице
              <select
                value={bankPageSize}
                onChange={(event) => { setBankPageSize(event.target.value); setBankPage(1); }}
                style={{ width: 72 }}
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
              </select>
            </label>
          </div>
          <div style={{ color: "#64748B", fontSize: 13 }}>
            Страница {bankPage} из {bankTotalPages} · найдено: {bankQuestionsCount}
          </div>
          <div style={{ display: "grid", gap: 8, maxHeight: 420, overflow: "auto" }}>
            {bankQuestions.length === 0 && <p style={helpTextStyle}>В банке пока нет вопросов.</p>}
            {bankQuestions.map((question) => (
              <div key={question.id} style={{ border: "1px solid #E6EEF6", borderRadius: 10, padding: 10, display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 700 }}>{question.text}</div>
                <div style={{ color: "#64748B", fontSize: 12 }}>
                  {question.topic_name || "Без темы"} · {getQuestionTypeLabel(question.type)} · {question.points} балл(ов)
                </div>
                <button type="button" onClick={() => addBankQuestion(question)} style={{ background: "#2563EB", color: "white" }}>
                  Добавить
                </button>
              </div>
            ))}
          </div>
          {bankQuestionsCount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", borderTop: "1px solid #E6EEF6", paddingTop: 10 }}>
              <button type="button" onClick={() => setBankPage((current) => Math.max(1, current - 1))} disabled={bankPage <= 1} style={secondaryButtonStyle}>
                ← Назад
              </button>
              <span style={{ color: "#64748B", fontSize: 13 }}>{bankQuestions.length} из {bankQuestionsCount}</span>
              <button type="button" onClick={() => setBankPage((current) => Math.min(bankTotalPages, current + 1))} disabled={bankPage >= bankTotalPages} style={secondaryButtonStyle}>
                Вперёд →
              </button>
            </div>
          )}
        </aside>
      </div>
    </form>
  );
}
