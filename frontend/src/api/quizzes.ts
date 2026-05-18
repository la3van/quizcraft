import { http } from "./http";
import type {
  PaginatedResponse,
  QuizAttachment,
  QuizCreateRequest,
  QuizCreateResponse,
  QuizDetail,
  QuizEditData,
  QuizListItem,
  QuizAnalytics,
} from "./types";

export function getQuizzes(params?: Record<string, string>): Promise<PaginatedResponse<QuizListItem>> {
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  return http<PaginatedResponse<QuizListItem>>(`/api/quizzes/${query}`);
}

export function getQuiz(id: number): Promise<QuizDetail> {
  return http<QuizDetail>(`/api/quizzes/${id}/`);
}

export function getQuizByCode(code: string): Promise<QuizDetail> {
  return http<QuizDetail>(`/api/quizzes/by-code/${encodeURIComponent(code)}/`);
}

export function getQuizForEdit(id: number): Promise<QuizEditData> {
  return http<QuizEditData>(`/api/quizzes/${id}/edit-data/`);
}

export function createQuiz(payload: QuizCreateRequest): Promise<QuizCreateResponse> {
  return http<QuizCreateResponse>("/api/quizzes/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function updateQuiz(id: number, payload: QuizCreateRequest): Promise<QuizCreateResponse> {
  return http<QuizCreateResponse>(`/api/quizzes/${id}/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function uploadQuizAttachments(quizId: number, files: File[]): Promise<QuizAttachment[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  return http<QuizAttachment[]>(`/api/quizzes/${quizId}/attachments/`, {
    method: "POST",
    body: formData,
  });
}

export function deleteQuizAttachment(quizId: number, attachmentId: number): Promise<void> {
  return http<void>(`/api/quizzes/${quizId}/attachments/${attachmentId}/`, {
    method: "DELETE",
  });
}


export function getQuizAnalytics(id: number): Promise<QuizAnalytics> {
  return http<QuizAnalytics>(`/api/quizzes/${id}/analytics/`);
}

export async function downloadQuizResultsCsv(id: number): Promise<void> {
  const res = await fetch(`/api/quizzes/${id}/analytics/export/`, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `quiz_${id}_results.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
