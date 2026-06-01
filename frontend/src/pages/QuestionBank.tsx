import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import {
  createBankQuestion,
  createTopic,
  deleteBankQuestion,
  downloadQuestionsCsv,
  getBankQuestions,
  getTopics,
  importQuestionsCsv,
  updateBankQuestion,
  uploadQuestionMedia,
} from "../api/questions";
import type { BankQuestion, BankQuestionPayload, QuestionMediaKind, QuestionTopic, QuestionType } from "../api/types";

type DraftOption = { id: string; text: string; is_correct: boolean };

const panel: CSSProperties = {
  background: "white",
  border: "1px solid #E6EEF6",
  borderRadius: 14,
  padding: 16,
  boxShadow: "0 6px 22px rgba(15,23,42,0.06)",
  minWidth: 0,
};
const muted: CSSProperties = { color: "#64748B" };
const labelStyle: CSSProperties = { display: "grid", gap: 6, fontWeight: 600, minWidth: 0 };
const ghostButton: CSSProperties = { background: "white", color: "#0F172A", border: "1px solid #E6EEF6", whiteSpace: "nowrap" };
const dangerButton: CSSProperties = { background: "#DC2626", color: "white", whiteSpace: "nowrap" };
const primaryButton: CSSProperties = { background: "#2563EB", color: "white", whiteSpace: "nowrap" };
const cyanButton: CSSProperties = { background: "#06B6D4", color: "white", whiteSpace: "nowrap" };

function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}
function defaultOptions(): DraftOption[] {
  return [
    { id: makeId(), text: "Вариант 1", is_correct: true },
    { id: makeId(), text: "Вариант 2", is_correct: false },
  ];
}
function isChoiceType(type: QuestionType) {
  return type === "choice_single" || type === "choice_multi" || type === "tf";
}
function questionTypeLabel(type: QuestionType) {
  if (type === "choice_single") return "Один правильный вариант";
  if (type === "choice_multi") return "Несколько правильных вариантов";
  if (type === "tf") return "Верно/неверно";
  if (type === "input_text") return "Краткий ответ";
  return "Числовой ответ";
}

export default function QuestionBank() {
  const [topics, setTopics] = useState<QuestionTopic[]>([]);
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [questionCount, setQuestionCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState("10");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedType, setSelectedType] = useState<"" | QuestionType>("");
  const [selectedMediaKind, setSelectedMediaKind] = useState<"" | QuestionMediaKind>("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [search, setSearch] = useState("");
  const [newTopicName, setNewTopicName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [explanation, setExplanation] = useState("");
  const [tags, setTags] = useState("");
  const [learningGoal, setLearningGoal] = useState("");
  const [type, setType] = useState<QuestionType>("choice_single");
  const [points, setPoints] = useState(1);
  const [topic, setTopic] = useState("");
  const [options, setOptions] = useState<DraftOption[]>(() => defaultOptions());
  const [correctText, setCorrectText] = useState("");
  const [correctNumber, setCorrectNumber] = useState("");
  const [numericTolerance, setNumericTolerance] = useState("0");
  const [mediaKind, setMediaKind] = useState<QuestionMediaKind>("none");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(questionCount / Number(pageSize || 10)));

  async function loadData(nextPage = page) {
    const params: Record<string, string> = { page: String(nextPage), page_size: pageSize };
    if (selectedTopic) params.topic = selectedTopic;
    if (selectedType) params.type = selectedType;
    if (selectedMediaKind) params.media_kind = selectedMediaKind;
    if (ownerFilter) params.owner = ownerFilter;
    if (search.trim()) params.search = search.trim();
    const [topicData, questionData] = await Promise.all([getTopics(), getBankQuestions(params)]);
    setTopics(topicData.results);
    setQuestions(questionData.results);
    setQuestionCount(questionData.count);
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        setError(null);
        const params: Record<string, string> = { page: String(page), page_size: pageSize };
        if (selectedTopic) params.topic = selectedTopic;
        if (selectedType) params.type = selectedType;
        if (selectedMediaKind) params.media_kind = selectedMediaKind;
        if (ownerFilter) params.owner = ownerFilter;
        if (search.trim()) params.search = search.trim();
        const [topicData, questionData] = await Promise.all([getTopics(), getBankQuestions(params)]);
        if (cancelled) return;
        setTopics(topicData.results);
        setQuestions(questionData.results);
        setQuestionCount(questionData.count);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Не удалось загрузить банк вопросов.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [selectedTopic, selectedType, selectedMediaKind, ownerFilter, search, page, pageSize]);

  function resetForm() {
    setEditingId(null);
    setText("");
    setExplanation("");
    setTags("");
    setLearningGoal("");
    setType("choice_single");
    setPoints(1);
    setTopic("");
    setOptions(defaultOptions());
    setCorrectText("");
    setCorrectNumber("");
    setNumericTolerance("0");
    setMediaKind("none");
    setMediaUrl("");
    setMediaFile(null);
  }

  function editQuestion(question: BankQuestion) {
    if (!question.is_owner) {
      setError("Редактировать можно только свои вопросы. Этот вопрос можно использовать в квизах и викторинах через конструктор.");
      return;
    }
    setEditingId(question.id);
    setText(question.text);
    setExplanation(question.explanation ?? "");
    setTags(question.tags ?? "");
    setLearningGoal(question.learning_goal ?? "");
    setType(question.type);
    setPoints(question.points);
    setTopic(question.topic ? String(question.topic) : "");
    setOptions(question.options.length ? question.options.map((option) => ({ id: makeId(), text: option.text, is_correct: option.is_correct })) : []);
    setCorrectText(question.correct_text ?? "");
    setCorrectNumber(question.correct_number === null || question.correct_number === undefined ? "" : String(question.correct_number));
    setNumericTolerance(String(question.numeric_tolerance ?? 0));
    setMediaKind(question.media_kind ?? "none");
    setMediaUrl(question.media_url ?? "");
    setMediaFile(null);
  }

  function setQuestionType(nextType: QuestionType) {
    setType(nextType);
    if (nextType === "tf") {
      setOptions([
        { id: makeId(), text: "Верно", is_correct: true },
        { id: makeId(), text: "Неверно", is_correct: false },
      ]);
      return;
    }
    if (nextType === "choice_single") {
      setOptions((prev) => {
        const base = prev.length >= 2 ? prev : defaultOptions();
        const firstCorrectIndex = Math.max(0, base.findIndex((option) => option.is_correct));
        return base.map((option, index) => ({ ...option, is_correct: index === firstCorrectIndex }));
      });
      return;
    }
    if (nextType === "choice_multi") {
      setOptions((prev) => (prev.length >= 2 ? prev : defaultOptions()));
      return;
    }
    setOptions([]);
  }

  function buildPayload(): BankQuestionPayload | null {
    const cleanText = text.trim();
    const cleanOptions = options.map((option) => ({ text: option.text.trim(), is_correct: option.is_correct })).filter((option) => option.text);
    const correctCount = cleanOptions.filter((option) => option.is_correct).length;
    const tolerance = Number(numericTolerance || 0);

    if (!cleanText) return setError("Заполни текст вопроса."), null;
    if (!Number.isFinite(points) || points <= 0) return setError("Баллы должны быть больше 0."), null;
    if (isChoiceType(type) && cleanOptions.length < 2) return setError("Добавь минимум два варианта ответа."), null;
    if ((type === "choice_single" || type === "tf") && correctCount !== 1) return setError("Для вопроса с одним выбором нужен ровно один правильный ответ."), null;
    if (type === "choice_multi" && correctCount < 1) return setError("Для множественного выбора нужен хотя бы один правильный ответ."), null;
    if (type === "input_text" && !correctText.trim()) return setError("Для краткого ответа укажи правильный ответ."), null;
    if (type === "input_number" && correctNumber.trim() === "") return setError("Для числового ответа укажи правильное число."), null;
    if (!Number.isFinite(tolerance) || tolerance < 0) return setError("Допуск должен быть числом от 0."), null;

    return {
      text: cleanText,
      explanation: explanation.trim(),
      tags: tags.trim(),
      learning_goal: learningGoal.trim(),
      type,
      points,
      topic: topic ? Number(topic) : null,
      options: isChoiceType(type) ? cleanOptions : [],
      media_kind: mediaUrl.trim() || mediaFile ? mediaKind : "none",
      media_url: mediaUrl.trim() || null,
      correct_text: type === "input_text" ? correctText.trim() : null,
      correct_number: type === "input_number" ? Number(correctNumber) : null,
      numeric_tolerance: tolerance,
    };
  }

  async function saveQuestion(event: FormEvent) {
    event.preventDefault();
    const payload = buildPayload();
    if (!payload) return;
    try {
      setError(null);
      setMessage(null);
      const saved = editingId ? await updateBankQuestion(editingId, payload) : await createBankQuestion(payload);
      if (mediaFile) await uploadQuestionMedia(saved.id, mediaFile, mediaKind === "none" ? "file" : mediaKind);
      resetForm();
      await loadData(page);
      setMessage("Вопрос сохранён.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить вопрос.");
    }
  }

  async function addTopic() {
    if (!newTopicName.trim()) return;
    try {
      const created = await createTopic(newTopicName.trim());
      setNewTopicName("");
      await loadData(page);
      setTopic(String(created.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать тему.");
    }
  }

  async function removeQuestion(id: number) {
    try {
      await deleteBankQuestion(id);
      if (editingId === id) resetForm();
      await loadData(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить вопрос.");
    }
  }

  async function handleImport() {
    if (!importFile) return;
    try {
      const result = await importQuestionsCsv(importFile);
      setImportFile(null);
      setPage(1);
      await loadData(1);
      setMessage(`Импортировано вопросов: ${result.created}${result.errors.length ? `. Ошибки: ${result.errors.join("; ")}` : ""}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось импортировать CSV.");
    }
  }

  return (
    <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 6px" }}>Общий банк вопросов</h2>
          <p style={{ margin: 0, ...muted }}>Все пользователи видят вопросы и могут добавлять их в квизы или викторины. Редактировать и удалять можно только свои вопросы.</p>
        </div>
        <div style={{ ...panel, minWidth: 220 }}>
          <strong style={{ fontSize: 20 }}>{questionCount}</strong>
          <div style={muted}>вопросов найдено</div>
        </div>
      </div>

      {error && <div style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA", borderRadius: 10, padding: 12 }}>{error}</div>}
      {message && <div style={{ background: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0", borderRadius: 10, padding: 12 }}>{message}</div>}

      <section style={{ ...panel, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input type="file" accept=".csv,text/csv" onChange={(event) => setImportFile(event.target.files?.[0] ?? null)} />
        <button type="button" onClick={handleImport} disabled={!importFile} style={primaryButton}>Импорт CSV</button>
        <button type="button" onClick={() => void downloadQuestionsCsv()} style={ghostButton}>Экспорт CSV</button>
        <span style={{ ...muted, fontSize: 13 }}>CSV: text,type,points,topic,tags,learning_goal,explanation,options,correct_options.</span>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(360px, 450px)", gap: 16, alignItems: "start" }}>
        <section style={{ ...panel, display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ display: "grid", gap: 6, color: "#64748B", fontSize: 13, fontWeight: 600 }}>
              Поиск по банку вопросов
              <input
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder="Например: футбол, HTML, океан, цикл, объяснение или тег"
                style={{ width: "100%" }}
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(130px, 1fr))", gap: 8 }}>
              <select value={selectedTopic} onChange={(event) => { setSelectedTopic(event.target.value); setPage(1); }}>
                <option value="">Все темы</option>
                {topics.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <select value={selectedType} onChange={(event) => { setSelectedType(event.target.value as "" | QuestionType); setPage(1); }}>
                <option value="">Все типы</option>
                <option value="choice_single">Один вариант</option>
                <option value="choice_multi">Несколько вариантов</option>
                <option value="tf">Верно/неверно</option>
                <option value="input_text">Краткий ответ</option>
                <option value="input_number">Числовой ответ</option>
              </select>
              <select value={selectedMediaKind} onChange={(event) => { setSelectedMediaKind(event.target.value as "" | QuestionMediaKind); setPage(1); }}>
                <option value="">Любые медиа</option>
                <option value="none">Без медиа</option>
                <option value="file">Файл/изображение</option>
                <option value="audio">Аудио</option>
                <option value="video">Видео</option>
              </select>
              <select value={ownerFilter} onChange={(event) => { setOwnerFilter(event.target.value); setPage(1); }}>
                <option value="">Все авторы</option>
                <option value="me">Только мои</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ ...muted, fontSize: 13 }}>
              Страница {page} из {totalPages} · найдено: {questionCount}
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748B", fontSize: 13 }}>
              На странице
              <select
                value={pageSize}
                onChange={(event) => { setPageSize(event.target.value); setPage(1); }}
                style={{ width: 84 }}
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </label>
          </div>

          {loading && <div style={muted}>Загрузка...</div>}
          {!loading && questions.length === 0 && <div style={muted}>Вопросов пока нет.</div>}

          <div style={{ display: "grid", gap: 10 }}>
            {questions.map((question) => (
              <article key={question.id} style={{ border: "1px solid #E6EEF6", borderRadius: 12, padding: 12, display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ overflowWrap: "anywhere" }}>{question.text}</strong>
                    <div style={{ color: "#64748B", fontSize: 13 }}>
                      {question.topic_name || "Без темы"} · {questionTypeLabel(question.type)} · {question.points} балл(ов)
                    </div>
                    <div style={{ color: "#64748B", fontSize: 12 }}>
                      Автор: {question.author_name}{question.is_owner ? " · мой вопрос" : ""}
                    </div>
                    {(question.tags || question.learning_goal) && (
                      <div style={{ color: "#64748B", fontSize: 12 }}>
                        {question.tags && <>Теги: {question.tags}</>} {question.learning_goal && <>· Цель: {question.learning_goal}</>}
                      </div>
                    )}
                  </div>
                  {question.is_owner && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button type="button" onClick={() => editQuestion(question)} style={ghostButton}>Редактировать</button>
                      <button type="button" onClick={() => removeQuestion(question.id)} style={dangerButton}>Удалить</button>
                    </div>
                  )}
                </div>

                {question.media_file_url || question.media_url ? <a href={question.media_file_url || question.media_url || "#"} target="_blank" rel="noreferrer">Медиа/вложение</a> : null}

                {question.options.length > 0 ? (
                  <ol style={{ margin: 0, paddingLeft: 20, color: "#64748B" }}>
                    {question.options.map((option) => <li key={option.id} style={{ fontWeight: option.is_correct ? 700 : 400 }}>{option.text} {option.is_correct ? "✓" : ""}</li>)}
                  </ol>
                ) : (
                  <div style={{ color: "#64748B", fontSize: 13 }}>
                    Правильный ответ: {question.type === "input_number" ? question.correct_number : question.correct_text}
                  </div>
                )}
              </article>
            ))}
          </div>

          {questionCount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", borderTop: "1px solid #E6EEF6", paddingTop: 12 }}>
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} style={ghostButton}>
                ← Назад
              </button>
              <span style={{ color: "#64748B", fontSize: 13 }}>
                Показано {questions.length} из {questionCount}
              </span>
              <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages} style={ghostButton}>
                Вперёд →
              </button>
            </div>
          )}
        </section>

        <aside style={{ ...panel, display: "grid", gap: 14, overflow: "hidden" }}>
          <h3 style={{ margin: 0 }}>{editingId ? "Редактировать вопрос" : "Новый вопрос"}</h3>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 96px", gap: 8 }}>
            <input value={newTopicName} onChange={(event) => setNewTopicName(event.target.value)} placeholder="Новая тема" />
            <button type="button" onClick={addTopic} style={cyanButton}>Создать</button>
          </div>

          <form onSubmit={saveQuestion} style={{ display: "grid", gap: 12 }}>
            <label style={labelStyle}>Текст вопроса<textarea rows={4} value={text} onChange={(event) => setText(event.target.value)} placeholder="Напиши формулировку" /></label>
            <label style={labelStyle}>Объяснение<textarea rows={3} value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="Показывается в разборе" /></label>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 8 }}>
              <label style={labelStyle}>Теги<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="python, циклы" /></label>
              <label style={labelStyle}>Цель обучения<input value={learningGoal} onChange={(event) => setLearningGoal(event.target.value)} placeholder="что должен понять ученик" /></label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 100px", gap: 8 }}>
              <label style={labelStyle}>Тип<select value={type} onChange={(event) => setQuestionType(event.target.value as QuestionType)}>
                <option value="choice_single">Один правильный вариант</option>
                <option value="choice_multi">Несколько правильных вариантов</option>
                <option value="tf">Верно/неверно</option>
                <option value="input_text">Краткий ответ</option>
                <option value="input_number">Числовой ответ</option>
              </select></label>
              <label style={labelStyle}>Баллы<input type="number" min="0.1" step="0.1" value={points} onChange={(event) => setPoints(Number(event.target.value))} /></label>
            </div>

            <label style={labelStyle}>Тема<select value={topic} onChange={(event) => setTopic(event.target.value)}>
              <option value="">Без темы</option>
              {topics.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select></label>

            <div style={{ display: "grid", gridTemplateColumns: "140px minmax(0, 1fr)", gap: 8 }}>
              <label style={labelStyle}>Медиа<select value={mediaKind} onChange={(event) => setMediaKind(event.target.value as QuestionMediaKind)}>
                <option value="none">Нет</option><option value="file">Файл/изображение</option><option value="audio">Аудио</option><option value="video">Видео</option>
              </select></label>
              <label style={labelStyle}>URL медиа<input value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder="https://..." /></label>
            </div>
            <label style={labelStyle}>Файл медиа<input type="file" onChange={(event) => setMediaFile(event.target.files?.[0] ?? null)} /></label>

            {type === "input_text" && <label style={labelStyle}>Правильный ответ<input value={correctText} onChange={(event) => setCorrectText(event.target.value)} /></label>}
            {type === "input_number" && <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 120px", gap: 8 }}>
              <label style={labelStyle}>Правильное число<input type="number" value={correctNumber} onChange={(event) => setCorrectNumber(event.target.value)} /></label>
              <label style={labelStyle}>Допуск<input type="number" min="0" step="0.001" value={numericTolerance} onChange={(event) => setNumericTolerance(event.target.value)} /></label>
            </div>}

            {isChoiceType(type) && <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <strong>Варианты</strong>
                <button type="button" onClick={() => setOptions((prev) => [...prev, { id: makeId(), text: `Вариант ${prev.length + 1}`, is_correct: false }])} style={ghostButton}>+ вариант</button>
              </div>
              {options.map((option, index) => <div key={option.id} style={{ display: "grid", gridTemplateColumns: "24px minmax(0, 1fr) 44px", gap: 8, alignItems: "center" }}>
                <input type={type === "choice_multi" ? "checkbox" : "radio"} checked={option.is_correct} onChange={() => setOptions((prev) => prev.map((item) => item.id === option.id ? { ...item, is_correct: type === "choice_multi" ? !item.is_correct : true } : { ...item, is_correct: type === "choice_multi" ? item.is_correct : false }))} />
                <input value={option.text} onChange={(event) => setOptions((prev) => prev.map((item) => item.id === option.id ? { ...item, text: event.target.value } : item))} placeholder={`Вариант ${index + 1}`} />
                <button type="button" onClick={() => setOptions((prev) => prev.length > 2 ? prev.filter((item) => item.id !== option.id) : prev)} style={{ ...dangerButton, paddingInline: 0 }}>×</button>
              </div>)}
            </div>}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              {editingId && <button type="button" onClick={resetForm} style={ghostButton}>Отмена</button>}
              <button type="submit" style={primaryButton}>{editingId ? "Сохранить вопрос" : "Создать вопрос"}</button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}
