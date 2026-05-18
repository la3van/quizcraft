import { http } from "./http";
import type { BankQuestion, BankQuestionPayload, PaginatedResponse, QuestionTopic } from "./types";

export function getTopics(): Promise<PaginatedResponse<QuestionTopic>> {
  return http<PaginatedResponse<QuestionTopic>>("/api/topics/?page_size=100");
}

export function createTopic(name: string): Promise<QuestionTopic> {
  return http<QuestionTopic>("/api/topics/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export function updateTopic(id: number, name: string): Promise<QuestionTopic> {
  return http<QuestionTopic>(`/api/topics/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export function deleteTopic(id: number): Promise<void> {
  return http<void>(`/api/topics/${id}/`, { method: "DELETE" });
}

export function getBankQuestions(params?: Record<string, string>): Promise<PaginatedResponse<BankQuestion>> {
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  return http<PaginatedResponse<BankQuestion>>(`/api/questions/${query}`);
}

export function createBankQuestion(payload: BankQuestionPayload): Promise<BankQuestion> {
  return http<BankQuestion>("/api/questions/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function updateBankQuestion(id: number, payload: BankQuestionPayload): Promise<BankQuestion> {
  return http<BankQuestion>(`/api/questions/${id}/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function deleteBankQuestion(id: number): Promise<void> {
  return http<void>(`/api/questions/${id}/`, { method: "DELETE" });
}

export function uploadQuestionMedia(id: number, file: File, mediaKind = "file"): Promise<BankQuestion> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("media_kind", mediaKind);
  return http<BankQuestion>(`/api/questions/${id}/media/`, {
    method: "POST",
    body: formData,
  });
}

export function importQuestionsCsv(file: File): Promise<{ created: number; errors: string[] }> {
  const formData = new FormData();
  formData.append("file", file);
  return http<{ created: number; errors: string[] }>("/api/questions/import/", {
    method: "POST",
    body: formData,
  });
}

export async function downloadQuestionsCsv(): Promise<void> {
  const res = await fetch("/api/questions/export/", { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "quizcraft_questions.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
