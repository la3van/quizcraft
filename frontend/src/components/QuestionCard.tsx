import type { QuizDetail } from "../api/types";

export type AnswerDraft = {
  selected_options: number[];
  text_answer: string;
  number_answer: string;
};

type Question = QuizDetail["questions"][number];

type Props = {
  question: Question;
  value: AnswerDraft;
  index?: number;
  disabled?: boolean;
  onChange: (next: AnswerDraft) => void;
};

const cardStyle = {
  background: "white",
  border: "1px solid #E6EEF6",
  borderRadius: 14,
  padding: 16,
  boxShadow: "0 6px 18px rgba(15,23,42,0.04)",
} as const;

function mediaSrc(question: Question): string {
  return question.media_file_url || question.media_url || "";
}

export default function QuestionCard({ question, value, index, disabled, onChange }: Props) {
  const isSingle = question.type === "choice_single" || question.type === "tf";
  const isMulti = question.type === "choice_multi";
  const isText = question.type === "input_text";
  const isNumber = question.type === "input_number";
  const src = mediaSrc(question);

  function toggle(optionId: number) {
    if (disabled) return;

    if (isSingle) {
      onChange({ ...value, selected_options: [optionId] });
      return;
    }

    const has = value.selected_options.includes(optionId);
    onChange({ ...value, selected_options: has ? value.selected_options.filter((x) => x !== optionId) : [...value.selected_options, optionId] });
  }

  return (
    <section style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "#64748B", fontSize: 13, marginBottom: 4 }}>
            {typeof index === "number" ? `Вопрос ${index + 1}` : "Вопрос"} · {question.type_label || question.type}
          </div>
          <h3 style={{ margin: 0, fontSize: 18, lineHeight: 1.35, overflowWrap: "anywhere" }}>{question.text}</h3>
          {(question.learning_goal || question.tags) && (
            <div style={{ color: "#64748B", fontSize: 13, marginTop: 6 }}>
              {question.learning_goal && <>Цель: {question.learning_goal}</>}
              {question.learning_goal && question.tags ? " · " : ""}
              {question.tags && <>Теги: {question.tags}</>}
            </div>
          )}
        </div>
        <div
          style={{
            flex: "0 0 auto",
            border: "1px solid #E6EEF6",
            borderRadius: 999,
            padding: "5px 10px",
            color: "#64748B",
            fontSize: 13,
            whiteSpace: "nowrap",
          }}
        >
          {question.points} балл(ов)
        </div>
      </div>

      {src && (
        <div style={{ margin: "10px 0", border: "1px solid #E6EEF6", borderRadius: 12, padding: 10, background: "#F8FAFC" }}>
          {question.media_kind === "audio" ? (
            <audio src={src} controls style={{ width: "100%" }} />
          ) : question.media_kind === "video" ? (
            <video src={src} controls style={{ width: "100%", maxHeight: 360, borderRadius: 10 }} />
          ) : src.match(/\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i) ? (
            <img src={src} alt="Медиа вопроса" style={{ maxWidth: "100%", maxHeight: 360, borderRadius: 10, objectFit: "contain" }} />
          ) : (
            <a href={src} target="_blank" rel="noreferrer">Открыть вложение вопроса</a>
          )}
        </div>
      )}

      {(isSingle || isMulti) && (
        <div style={{ display: "grid", gap: 8 }}>
          {question.options.map((opt) => {
            const checked = value.selected_options.includes(opt.id);
            return (
              <label
                key={opt.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "24px minmax(0, 1fr)",
                  gap: 10,
                  alignItems: "center",
                  border: checked ? "1px solid #38BDF8" : "1px solid #E6EEF6",
                  background: checked ? "#F0F9FF" : "#FFFFFF",
                  borderRadius: 10,
                  padding: "10px 12px",
                  cursor: disabled ? "default" : "pointer",
                }}
              >
                <input
                  type={isSingle ? "radio" : "checkbox"}
                  name={`q_${question.id}`}
                  checked={checked}
                  onChange={() => toggle(opt.id)}
                  disabled={disabled}
                  style={{ width: 16, height: 16, padding: 0, justifySelf: "center" }}
                />
                <span style={{ overflowWrap: "anywhere" }}>{opt.text}</span>
              </label>
            );
          })}
        </div>
      )}

      {isText && (
        <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
          Ответ
          <input
            value={value.text_answer}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, text_answer: event.target.value })}
            placeholder="Введи краткий ответ"
          />
        </label>
      )}

      {isNumber && (
        <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
          Числовой ответ
          <input
            type="number"
            value={value.number_answer}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, number_answer: event.target.value })}
            placeholder="Например: 42"
          />
        </label>
      )}
    </section>
  );
}
