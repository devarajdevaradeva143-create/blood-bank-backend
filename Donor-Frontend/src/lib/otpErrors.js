// Shared Supabase OTP error classifier (donor flow).
// Supabase returns specific reasons (expired / invalid / 429 cooldown /
// network) but callers used to show one generic message — adhaan "same
// error" maari theriyudhu. Ippo exact reason-a classify panni UI kaatum.
// Debug ku raw error console la log aagum (no PII — message + code mattum).
export function classifyOtpError(err) {
  try {
    console.error("[supabase-otp]", err?.code || "", err?.message || err);
  } catch {
    // ignore logging errors
  }
  const status = Number(err?.status);
  const blob = `${err?.message || ""} ${err?.code || ""}`.toLowerCase();
  if (status === 429 || /rate.limit|too many|after \d+ second|cooldown|over_email_send_rate_limit|over_sms_send_rate_limit/.test(blob)) {
    return "cooldown";
  }
  if (/expir/.test(blob)) return "expired";
  if (
    /network|failed to fetch|load failed|fetch failed|networkrequestfailed|not_configured|not configured/.test(blob) ||
    err?.code === "not_configured"
  ) {
    return "network";
  }
  return "invalid";
}

export default { classifyOtpError };
