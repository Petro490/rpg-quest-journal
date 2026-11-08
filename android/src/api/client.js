import * as SecureStore from "expo-secure-store";

// --- Конфигурация бэкенда ---
// Для реального телефона укажите локальный IP вашего ПК в той же Wi-Fi сети:
//   const API_BASE = "http://192.168.1.10:8000";
// Для Android-эмулятора используйте: http://10.0.2.2:8000
export const API_BASE = "http://127.0.0.1:8000";
export const TOKEN_KEY = "rpg_quest_token";

// --- Хранение токена ---
export async function saveToken(token) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}
export async function getToken() {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}
export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/**
 * Базовый запрос к API с JWT.
 * - Инжектит Authorization: Bearer <token> в каждый запрос.
 * - Парсит JSON ответ, при HTTP-ошибке кидает Error с detail.
 */
export async function api(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = {};
  }

  if (!res.ok) {
    const detail =
      typeof data?.detail === "string"
        ? data.detail
        : data?.message || `Ошибка ${res.status}`;
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  return data;
}

// --- Типовые вызовы API ---
export const authApi = {
  login: (username, password) =>
    api("/auth/token", { method: "POST", auth: false, body: { username, password } }),
  register: (username, password) =>
    api("/auth/register", { method: "POST", auth: false, body: { username, password } }),
  me: () => api("/auth/me"),
};

export const heroApi = {
  get: () => api("/hero"),
};

export const taskApi = {
  list: () => api("/tasks"),
  create: (title, category_id) =>
    api("/tasks", { method: "POST", body: { title, category_id } }),
  complete: (id) => api(`/tasks/${id}`, { method: "PATCH" }),
  remove: (id) => api(`/tasks/${id}`, { method: "DELETE" }),
};

export const dailyApi = {
  list: () => api("/dailies"),
  create: (title, category_id) =>
    api("/dailies", { method: "POST", body: { title, category_id } }),
  complete: (id) => api(`/dailies/${id}`, { method: "PATCH" }),
  remove: (id) => api(`/dailies/${id}`, { method: "DELETE" }),
};

export const shopApi = {
  list: () => api("/shop"),
  buy: (item_id) => api("/shop/buy", { method: "POST", body: { item_id } }),
};

export const categoryApi = {
  list: () => api("/categories"),
};

export const activityApi = {
  get: () => api("/activity"),
};