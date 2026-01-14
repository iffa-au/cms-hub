import axios from "axios";

type JsonResult<T> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
};

const backendOrigin =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
const baseURL = `${backendOrigin.replace(/\/+$/, "")}/api/v1`;

const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

function toResult<T>(error: unknown): JsonResult<T> {
  const err = error as { response?: { status?: number; data?: any } };
  const status = err.response?.status ?? 0;
  const message = (err.response?.data?.message as string) || "Request failed";
  return { ok: false, status, error: message };
}

export async function authLogin(input: { email: string; password: string }) {
  try {
    const res = await api.post<{
      accessToken: string;
      user: { id: string; email: string; name: string; role: string };
      message?: string;
    }>("/auth/login", input);
    return { ok: true, status: res.status, data: res.data } as JsonResult<
      typeof res.data
    >;
  } catch (error) {
    return toResult(error);
  }
}

export async function authRegister(input: {
  name: string;
  email: string;
  password: string;
}) {
  try {
    const res = await api.post<{
      accessToken: string;
      user: { id: string; email: string; name: string; role: string };
      message?: string;
    }>("/auth/register", input);
    console.log(res.data);
    return { ok: true, status: res.status, data: res.data } as JsonResult<
      typeof res.data
    >;
  } catch (error) {
    return toResult(error);
  }
}
