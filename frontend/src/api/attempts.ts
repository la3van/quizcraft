import { http } from "./http";
import type {
  AttemptCreateResponse,
  AttemptDetail,
  AttemptItem,
  PaginatedResponse,
  SubmitRequest,
  SubmitResponse,
} from "./types";

export function createAttempt(quizId: number): Promise<AttemptCreateResponse> {
  return http<AttemptCreateResponse>("/api/attempts/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quiz: quizId }),
  });
}

export function getAttempt(attemptId: number): Promise<AttemptDetail> {
  return http<AttemptDetail>(`/api/attempts/${attemptId}/`);
}

export function submitAttempt(attemptId: number, payload: SubmitRequest): Promise<SubmitResponse> {
  return http<SubmitResponse>(`/api/attempts/${attemptId}/submit/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function getMyAttempts(): Promise<PaginatedResponse<AttemptItem>> {
  return http<PaginatedResponse<AttemptItem>>("/api/attempts/");
}
