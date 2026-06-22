import { apiRequest } from "@/lib/api/client";

export type LoginPayload = {
  username: string;
  password: string;
};

export type LoginResponse = {
  access: string;
  refresh: string;
};

export function login(payload: LoginPayload) {
  return apiRequest<LoginResponse>("/api/auth/login/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
