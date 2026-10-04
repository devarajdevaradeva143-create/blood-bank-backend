import { clearAccessToken } from "../lib/api";
// SUPABASE-PENDING: kept for later resume — backend Gmail OTP is primary now.
// import { supabase, isSupabaseConfigured } from "../lib/supabase";
// import { classifyOtpError } from "../lib/otpErrors";

function redirectTo() {
  try {
    return window.location.origin;
  } catch {
    return undefined;
  }
}

const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const REGISTERED_KEY = "registeredDonor";

function readRegisteredDonor() {
  try {
    return JSON.parse(localStorage.getItem(REGISTERED_KEY));
  } catch {
    return null;
  }
}

function isLocalAccount(email) {
  const normalized = String(email).trim().toLowerCase();
  const donor = readRegisteredDonor();
  return (
    !!donor &&
    String(donor.email || "").trim().toLowerCase() === normalized
  );
}

async function postJson(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

/**
 * Server donor -> the localStorage profile shape used by Profile/Donate pages.
 * Local-only extras (photo, totals) are merged in by the caller.
 */
export function toLocalDonor(user) {
  if (!user) return null;
  const created = user.createdAt ? String(user.createdAt).slice(0, 10) : "";
  return {
    donorId: user.donorId || "",
    name: user.fullName || "",
    email: user.email || "",
    phone: user.mobile || "",
    dob: user.dob || "",
    gender: user.gender || "",
    bloodGroup: user.bloodGroup || "",
    district: user.district || "",
    districtId: user.districtId || "",
    city: user.city || "",
    pincode: user.pincode || "",
    address: user.address || "",
    registrationDate: created,
  };
}

/** Merge the server profile into the local one (keeps photo / totals). */
export function saveLocalDonor(user) {
  const incoming = toLocalDonor(user);
  if (!incoming) return null;
  const prev = readRegisteredDonor() || {};
  const merged = { ...prev };

  for (const [key, value] of Object.entries(incoming)) {
    const empty = value === "" || value === null || value === undefined;
    // Server wins when it has a value; never blank out a locally filled field.
    if (!empty || merged[key] === undefined) merged[key] = value;
  }

  merged.donorId = incoming.donorId || prev.donorId || "";
  merged.registrationDate =
    incoming.registrationDate || prev.registrationDate || "";
  merged.totalDonations = Number(prev.totalDonations ?? 0) || 0;
  merged.isActive = prev.isActive ?? true;
  merged.photo = prev.photo || prev.photoUrl || prev.avatar || "";

  try {
    localStorage.setItem(REGISTERED_KEY, JSON.stringify(merged));
  } catch {
    // ignore storage errors
  }
  return merged;
}

// Backend Gmail OTP flow (Supabase paused — SUPABASE-PENDING resume later).
// Backend creates OTP + sends Gmail. Frontend only calls backend.
export async function requestPasswordReset(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return { ok: false, reason: "not_found" };
  let res;
  try {
    res = await postJson("/api/donors/forgot-password", { email: normalized });
  } catch {
    return { ok: false, reason: "network" };
  }
  if (res.ok) return { ok: true };
  if (res.status === 429) return { ok: false, reason: "cooldown" };
  if (res.status >= 500) return { ok: false, reason: "network" };
  // Backend is generic-safe (always 200) — non-200 here is rate-limit/network.
  return { ok: true };
  // SUPABASE-PENDING (old flow, kept for resume):
  // if (!isLocalAccount(normalized)) return { ok: false, reason: "not_found" };
  // if (!isSupabaseConfigured()) return { ok: false, reason: "network" };
  // const { error } = await supabase.auth.signInWithOtp({ email: normalized, options: { emailRedirectTo: redirectTo() } });
  // if (error) { const reason = classifyOtpError(error); if (reason === "cooldown") return { ok: false, reason: "cooldown" }; return { ok: false, reason: "network" }; }
  // return { ok: true };
}

// Verifies backend Gmail OTP code, then stores the new bcrypt hash via backend.
// SUPABASE-PENDING: supabase verify block commented below for later resume.
export async function resetPassword({ email, otp, newPassword }) {
  const normalized = String(email || "").trim().toLowerCase();
  const code = String(otp || "").trim();
  if (!/^\d{6}$/.test(code)) return { ok: false, reason: "otp_invalid" };
  let res;
  try {
    res = await postJson("/api/donors/reset-password", {
      email: normalized,
      code,
      newPassword,
    });
  } catch {
    return { ok: false, reason: "network" };
  }
  if (res.ok) {
    clearAccessToken();
    return { ok: true };
  }
  if (res.status === 429) return { ok: false, reason: "cooldown" };
  const msg = String(res.data?.message || "").toLowerCase();
  if (msg.includes("expire")) return { ok: false, reason: "otp_expired" };
  return { ok: false, reason: "otp_invalid" };
  // SUPABASE-PENDING (old flow):
  // if (!isSupabaseConfigured()) return { ok: false, reason: "network" };
  // const { data, error } = await supabase.auth.verifyOtp({ email: normalized, token: code, type: "email" });
  // if (error) { const reason = classifyOtpError(error); if (reason === "cooldown") return { ok: false, reason: "cooldown" }; if (reason === "expired") return { ok: false, reason: "otp_expired" }; return { ok: false, reason: "otp_invalid" }; }
  // const sessionToken = String(data?.session?.access_token || "").trim();
  // if (!sessionToken) return { ok: false, reason: "otp_invalid" };
  // res = await postJson("/api/donors/reset-password", { email: normalized, supabaseAccessToken: sessionToken, newPassword });
  // if (!res.ok) { if (res.status === 429) return { ok: false, reason: "cooldown" }; return { ok: false, reason: "otp_invalid" }; }
  // clearAccessToken();
  // try { await supabase.auth.signOut(); } catch {}
  // return { ok: true };
}
