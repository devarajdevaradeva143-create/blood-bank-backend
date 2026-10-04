export const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const TOKEN_KEY = "donorAccessToken";

export function getAccessToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore storage errors (private mode etc.)
  }
}

export function clearAccessToken() {
  setAccessToken(null);
}

function getServerMessage(data, fallback) {
  if (data && typeof data.message === "string" && data.message.trim()) {
    if (Array.isArray(data.issues) && data.issues.length > 0) {
      const first = data.issues[0];
      if (first && typeof first.message === "string" && first.message.trim()) {
        const path = typeof first.path === "string" && first.path ? `${first.path}: ` : "";
        return `${data.message} — ${path}${first.message}`;
      }
    }
    return data.message;
  }
  if (data && typeof data.error === "string" && data.error.trim()) {
    return data.error;
  }
  return fallback;
}

function networkError() {
  return new Error("Unable to reach server. Please check your connection.");
}

async function parseJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

let refreshPromise = null;

/** Rotate the httpOnly refresh cookie into a fresh access token. */
function tryRefresh() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/donors/refresh`, {
          method: "POST",
          credentials: "include",
        });
        const data = await parseJson(res);
        if (res.ok && data?.accessToken) {
          setAccessToken(data.accessToken);
          return true;
        }
      } catch {
        // ignore — caller falls through to a clean 401
      }
      return false;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function req(path, { method = "GET", body, auth = false, _retried = false } = {}) {
  const token = getAccessToken();

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw networkError();
  }

  if (res.status === 401 && auth && !_retried) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return req(path, { method, body, auth, _retried: true });
    }
    clearAccessToken();
  }

  const data = await parseJson(res);

  if (!res.ok) {
    throw new Error(getServerMessage(data, `Request failed (${res.status})`));
  }

  return data ?? {};
}

export function requestOtp(mobile) {
  return req("/api/otp/request", {
    method: "POST",
    body: { mobile: String(mobile).trim(), purpose: "donor" },
  });
}

/**
 * Register a donor with a Supabase-verified email session (Supabase-only OTP, Option A).
 * supabaseAccessToken = Supabase session access_token after Email OTP verification.
 * Backend matches the verified email to payload.email (JWT stays ours).
 * Legacy: clerkToken still accepted during transition (deprecated).
 */
export function registerDonor(payload, codeOrToken) {
  const v = String(codeOrToken || "").trim();
  return req("/api/donors", {
    method: "POST",
    body: { ...payload, code: v },
  });
}

export function requestRegisterOtp(email) {
  return req("/api/donors/request-register-otp", {
    method: "POST",
    body: { email: String(email || "").trim().toLowerCase() },
  });
}
// SUPABASE-PENDING (old supabase heuristic, kept for resume):
// const isSupabase = v.split(".").length === 3 || v.length > 200;
// if (isSupabase) return req("/api/donors", { method: "POST", body: { ...payload, supabaseAccessToken: v } });

export async function loginDonor(email, password) {
  const data = await req("/api/donors/login", {
    method: "POST",
    body: { email, password },
  });
  if (data?.accessToken) setAccessToken(data.accessToken);
  return data;
}

export function logoutDonor() {
  return req("/api/donors/logout", { method: "POST" });
}

export function fetchDonorProfile() {
  return req("/api/donors/me", { auth: true });
}

export function requestDonationOtp(mobile) {
  return req("/api/otp/request", {
    method: "POST",
    body: { mobile: String(mobile).trim(), purpose: "donation" },
  });
}

export function submitDonation(payload) {
  const { code, otp, otpCode, supabaseAccessToken, supabaseToken, email, ...rest } =
    payload || {};
  const supToken = String(supabaseAccessToken || supabaseToken || "").trim();
  if (supToken) {
    // Supabase-only path — backend verifies email via service_role.
    return req("/api/donations", {
      method: "POST",
      body: { ...rest, email: String(email || rest.email || "").trim(), supabaseAccessToken: supToken },
    });
  }
  const legacyCode = String(code ?? otp ?? otpCode ?? "").trim();
  return req("/api/donations", {
    method: "POST",
    body: { ...rest, code: legacyCode },
  });
}

export function fetchStats() {
  return req("/api/stats");
}

export function listNotifications({ unreadOnly = false, limit } = {}) {
  const params = new URLSearchParams();
  if (unreadOnly) params.set("unreadOnly", "true");
  if (limit !== undefined && limit !== null && limit !== "") {
    params.set("limit", String(limit));
  }
  const query = params.toString();
  return req(`/api/notifications${query ? `?${query}` : ""}`, { auth: true });
}

export function getUnreadCount() {
  return req("/api/notifications/unread-count", { auth: true });
}

export function markNotificationRead(id) {
  return req(`/api/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
    auth: true,
  });
}

export function markAllNotificationsRead() {
  return req("/api/notifications/read-all", { method: "PATCH", auth: true });
}

export function deleteNotification(id) {
  return req(`/api/notifications/${encodeURIComponent(id)}`, {
    method: "DELETE",
    auth: true,
  });
}
