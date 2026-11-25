import axios from "axios";

// this file is used to create an axios instance with default headers and base URL
// also it will handle the token management and error handling globally

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000/api/v1";

// const BASE_URL =
// process.env.NEXT_PUBLIC_BACKEND_URL || "https://guh4nzpet5.ap-southeast-2.awsapprunner.com/api/v1";

const api = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
  baseURL: BASE_URL,
  // Sends and stores the httpOnly refresh cookie the backend sets on login.
  // Without it the browser drops that cookie, so /auth/refresh could never work.
  withCredentials: true,
});

// Auth endpoints answer 401 for a wrong password or a dead refresh cookie;
// refreshing in response to those would loop.
const NO_REFRESH = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"];

// One refresh at a time: when the token expires, every request that was in
// flight fails at once, and they should all wait on the same new token.
let refreshing: Promise<string | null> | null = null;

const refreshAccessToken = () =>
  (refreshing ??= api
    .post<{ accessToken?: string }>("/auth/refresh")
    .then((res) => {
      const token = res.data?.accessToken ?? null;
      if (token) localStorage.setItem("token", token);
      return token;
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    }));

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  // if token exists, add it to the headers so that the server can verify the user, otherwise proceed without it
  // this helps in maintaining the user session across different requests
  if (token) {
    config.headers.Authorization = `Bearer ${token}`; // Bearer 9348ytuierhfbieh
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // The access token lasts 15 minutes. On a 401, trade the refresh cookie
    // for a new one and replay the request once; only if that fails is the
    // session really over.
    if (error.response?.status === 401) {
      const canRefresh =
        original && !original._retried && !NO_REFRESH.some((p) => original.url?.startsWith(p));
      if (canRefresh) {
        original._retried = true;
        const token = await refreshAccessToken();
        if (token) {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        }
      }
      window.dispatchEvent(new Event("force-logout"));
    }
    // Normalize error message for UI toasts
    try {
      const serverMessage = error?.response?.data?.message;
      if (serverMessage && typeof serverMessage === "string") {
        error.message = serverMessage;
      }
    } catch {
      // no-op
    }
    return Promise.reject(error); // propagate the error to the calling function
  },
);

const postData = async <T>(path: string, data: unknown): Promise<T> => {
  const response = await api.post(path, data);
  return response.data;
};

const RETRY_DELAY_MS = 1500;
const MAX_RETRIES = 2;

/** Retry GET on 500 or network error (e.g. backend cold start). */
const getData = async <T>(path: string): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await api.get(path);
      return response.data;
    } catch (err: any) {
      lastError = err;
      const status = err?.response?.status;
      const isRetryable =
        status === 500 || status === 502 || status === 503 || !status;
      if (attempt < MAX_RETRIES && isRetryable) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
};

const updateData = async <T>(path: string, data: unknown): Promise<T> => {
  const response = await api.put(path, data);
  return response.data;
};
const patchData = async <T>(path: string, data?: unknown): Promise<T> => {
  const response = await api.patch(path, data ?? {});
  return response.data;
};
const deleteData = async <T>(path: string): Promise<T> => {
  const response = await api.delete(path);
  return response.data;
};

export { postData, getData, updateData, patchData, deleteData };
