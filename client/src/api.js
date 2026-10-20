const TOKEN_KEY = "lc-token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, body) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  register: (username, email, password) => request("POST", "/auth/register", { username, email, password }),
  forgot: (email) => request("POST", "/auth/forgot", { email }),
  reset: (token, password) => request("POST", "/auth/reset", { token, password }),
  login: (username, password) => request("POST", "/auth/login", { username, password }),
  logout: () => request("POST", "/auth/logout"),
  me: () => request("GET", "/me"),

  profile: () => request("GET", "/profile"),
  saveProfile: (p) => request("PUT", "/profile", p),
  changePassword: (current, next) => request("PUT", "/profile/password", { current, next }),
  requestEmailCode: (email) => request("POST", "/profile/email", { email }),
  verifyEmailCode: (code) => request("POST", "/profile/email/verify", { code }),

  problems: () => request("GET", "/problems"),
  addProblem: (p) => request("POST", "/problems", p),
  updateProblem: (id, p) => request("PUT", `/problems/${id}`, p),
  deleteProblem: (id) => request("DELETE", `/problems/${id}`),

  users: () => request("GET", "/users"),
  setRole: (id, isAdmin) => request("PATCH", `/users/${id}`, { isAdmin }),

  progress: () => request("GET", "/progress"),
  setProgress: (problemId, patch) => request("PUT", `/progress/${problemId}`, patch),
};
