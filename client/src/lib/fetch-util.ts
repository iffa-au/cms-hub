import axios from "axios";

// this file is used to create an axios instance with default headers and base URL
// also it will handle the token management and error handling globally

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

// const BASE_URL =
// process.env.NEXT_PUBLIC_BACKEND_URL || "https://guh4nzpet5.ap-southeast-2.awsapprunner.com/api/v1";

const api = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
  baseURL: BASE_URL,
  // withCredentials: true,
});

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
  (error) => {
    // Handle 401 Unauthorized errors when the token is invalid or expired
    if (error.response && error.response.status === 401) {
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
