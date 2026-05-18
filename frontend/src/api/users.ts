import { http } from "./http";
import type { ProfileStats } from "./types";

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  name: string;
  avatar_url: string;
};

export type LoginRequest = {
  login: string;
  password: string;
};

export type RegisterRequest = {
  name: string;
  username?: string;
  email: string;
  password: string;
};

export function getMe(): Promise<AuthUser> {
  return http<AuthUser>("/api/me/");
}

export function loginUser(payload: LoginRequest): Promise<AuthUser> {
  return http<AuthUser>("/api/login/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function registerUser(payload: RegisterRequest): Promise<AuthUser> {
  return http<AuthUser>("/api/register/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function logoutUser(): Promise<{ detail: string }> {
  return http<{ detail: string }>("/api/logout/", { method: "POST" });
}

export function updateProfile(formData: FormData): Promise<AuthUser> {
  return http<AuthUser>("/api/profile/", {
    method: "PATCH",
    body: formData,
  });
}

export function changePassword(payload: {
  current_password: string;
  new_password: string;
  new_password_confirm: string;
}): Promise<{ detail: string }> {
  return http<{ detail: string }>("/api/profile/password/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function getProfileStats(): Promise<ProfileStats> {
  return http<ProfileStats>("/api/profile/stats/");
}

export type PasswordResetRequestResponse = {
  detail: string;
  debug_reset_link?: string;
};

export function requestPasswordReset(login: string): Promise<PasswordResetRequestResponse> {
  return http<PasswordResetRequestResponse>("/api/password-reset/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login }),
  });
}

export function confirmPasswordReset(payload: {
  uid: string;
  token: string;
  new_password: string;
  new_password_confirm: string;
}): Promise<{ detail: string }> {
  return http<{ detail: string }>("/api/password-reset/confirm/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
