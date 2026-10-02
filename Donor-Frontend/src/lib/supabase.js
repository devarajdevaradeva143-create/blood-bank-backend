// Donor-Frontend Supabase client (publishable key only — never secret/service_role).
// Supabase-only OTP (Option A: JWT stays, OTP via Supabase Email OTP).
// Env (user manages .env.local — this file only reads):
//   VITE_SUPABASE_URL=https://xyz.supabase.co
//   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
//   VITE_API_URL=http://localhost:5000
//
// Hardened: keys missing-na createClient throw panni full app-a crash
// pannaadhu (blank page fix). Instead safe stub — auth calls throw a
// friendly error that the UI already catches + shows "not configured".
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export function isSupabaseConfigured() {
  if (!url || !key) return false;
  return !/paste_here|placeholder|your_key/i.test(String(key));
}

function notConfiguredError() {
  const err = new Error(
    "Email verification is not configured. Add VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY and rebuild."
  );
  err.code = "not_configured";
  return err;
}

function createStub() {
  if (!url || !key) {
    console.warn(
      "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing — email OTP will not work. Add to .env.local (local) or Pages env (deploy) and rebuild."
    );
  }
  const authStub = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "onAuthStateChange") return () => ({ data: { subscription: null } });
        return async () => ({ data: null, error: notConfiguredError() });
      },
    }
  );
  return { auth: authStub };
}

export const supabase = isSupabaseConfigured()
  ? createClient(url, key)
  : createStub();

export default supabase;
