import { useState } from "react";
import { User, CalendarDays, HeartPulse, Loader2, Plus, X } from "lucide-react";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Select from "../ui/Select";
import Checkbox from "../ui/Checkbox";
import Button from "../ui/Button";
import DonationOtpDialog from "./DonationOtpDialog";
import { useLanguage } from "../../i18n/LanguageContext";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { classifyOtpError } from "../../lib/otpErrors";
import { submitDonationServer } from "../../services/donationStore";
import {
  TN_DISTRICTS,
  BLOOD_GROUPS,
  toDistrictId,
} from "../../data/constants";

const INITIAL_FORM = {
  donorName: "",
  bloodGroup: "",
  age: 18,
  gender: "",
  mobile: "",
  email: "",
  district: "",
  date: localToday(),
  time: "",
  prevDate: "",
  address: "",
  notes: "",
};

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

const MAX_PREFERRED_DATES = 3;

// "2026-01-15, 2026-01-20" -> ["2026-01-15", "2026-01-20"]
// Empty + trailing ", " (pending new row) -> [""] so the new row renders.
function parseDateList(dateStr) {
  const raw = String(dateStr ?? "");
  if (!raw.trim()) return [""];
  return raw.split(",").map((s) => s.trim());
}

function cleanDateList(dateStr) {
  return parseDateList(dateStr).filter(Boolean);
}

function isNetworkError(err) {
  const msg = String((err && err.message) || err || "");
  return (
    msg.includes("Unable to reach server") ||
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("Load failed") ||
    msg.includes("Network request failed")
  );
}

function buildDonationPayload(formValues, supabaseAccessToken) {
  const district = formValues.district || "";
  // Backend accepts a single availableDate — primary = first preferred date.
  // Extra dates ride along in preferredDates + notes for staff visibility.
  const dates = cleanDateList(formValues.date);
  const date = dates[0] || "";
  const extraDates = dates.slice(1);
  const time = formValues.time || "";
  let notes = String(formValues.notes || "").trim();
  if (extraDates.length > 0) {
    const alt = `Alternate preferred dates: ${extraDates.join(", ")}`;
    notes = notes ? `${notes}\n${alt}` : alt;
  }
  return {
    // Contract fields for POST /api/donations.
    donorName: String(formValues.donorName || "").trim(),
    bloodGroup: formValues.bloodGroup || "",
    mobile: String(formValues.mobile || "").trim(),
    districtId: toDistrictId(district),
    district,
    address: String(formValues.address || "").trim(),
    availableDate: date,
    preferredDates: dates,
    preferredTime: time,
    notes,
    // Supabase-only OTP (Option A) — backend verifies the session token.
    supabaseAccessToken: String(supabaseAccessToken || "").trim(),
    // Backend schema aliases (date/time) + optional display fields kept for
    // compatibility and local offline cache / Confirmation display.
    date: dates.join(", "),
    time,

    email: String(formValues.email || "").trim(),
  };
}

function SectionCard({ icon, title, children }) {
  return (
    <Card className="p-6">
      <h2 className="mb-6 flex items-center gap-3 text-lg font-bold text-gray-900 dark:text-white">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
          {icon}
        </span>
        <span className="flex flex-col gap-1.5">
          {title}
          <span className="h-1 w-10 rounded-full bg-red-600 dark:bg-brand-500" />
        </span>
      </h2>
      {children}
    </Card>
  );
}

export default function DonationForm({ onSubmit, onCancel = () => {} }) {
  const { t } = useLanguage();  const [form, setForm] = useState(INITIAL_FORM);
  const [eligibility, setEligibility] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [resending, setResending] = useState(false);

  // Specific OTP error text (expired vs invalid vs cooldown) + redirect target.
  const otpErrorText = (err, fallback) => {
    const reason = classifyOtpError(err);
    if (reason === "expired")
      return "This code has expired. Please request a new one.";
    if (reason === "cooldown")
      return "Please wait a minute before requesting another code.";
    if (reason === "network")
      return "Unable to reach server. Please check your connection.";
    if (err && err.message) return err.message;
    return fallback;
  };

  const redirectTo = () => {
    try {
      return window.location.origin;
    } catch {
      return undefined;
    }
  };
  const today = localToday();

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleEligibilityChange = (checked) => {
    setEligibility(checked);
    setErrors((prev) => ({ ...prev, eligibility: undefined }));
  };

  const validate = () => {
    const newErrors = {};

    if (!form.donorName.trim()) newErrors.donorName = t("donate.validation.name");

    if (!form.bloodGroup) newErrors.bloodGroup = t("donate.validation.bloodGroup");

    if (!String(form.age).trim()) {
      newErrors.age = t("donate.validation.age");
    } else {
      const ageNum = Number(form.age);
      if (!Number.isInteger(ageNum) || ageNum < 18 || ageNum > 65)
        newErrors.age = t("donate.validation.ageRange");
    }

    if (!form.gender) newErrors.gender = t("donate.validation.gender");

    if (!/^[0-9]{10}$/.test(form.mobile))
      newErrors.mobile = t("donate.validation.mobile");

    if (!/\S+@\S+\.\S+/.test(form.email))
      newErrors.email = t("donate.validation.email");

    if (!form.district) newErrors.district = t("donate.validation.district");
    const pickedDates = cleanDateList(form.date);
    if (pickedDates.length === 0) {
      newErrors.date = t("donate.validation.date");
    } else {
      const seen = new Set();
      for (const d of pickedDates) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) {
          newErrors.date = t("donate.validation.dateInvalid");
          break;
        }
        if (d < today) {
          newErrors.date = t("donate.validation.datePast");
          break;
        }
        if (seen.has(d)) {
          newErrors.date = t("donate.validation.dateDuplicate");
          break;
        }
        seen.add(d);
      }
    }
    if (form.prevDate && form.prevDate > today) {
      newErrors.prevDate = t("donate.validation.prevDate");
    }

    if (!String(form.address || "").trim())
      newErrors.address = t("donate.validation.address");

    if (!eligibility) newErrors.eligibility = t("donate.validation.eligibility");

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setFormError("");
    setSubmitting(true);
    try {
      // Supabase-only Email OTP — no custom /api/otp SMS path.
      if (!isSupabaseConfigured()) {
        setFormError("Email verification is not configured. Please try again later.");
        return;
      }
      const { error } = await supabase.auth.signInWithOtp({
        email: String(form.email || "").trim().toLowerCase(),
        options: { emailRedirectTo: redirectTo() },
      });
      if (error) throw error;
      setOtpError("");
      setOtpOpen(true);
    } catch (err) {
      // Real website: no offline fake success. Show the real error.
      setFormError(otpErrorText(err, "Could not send OTP. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (code) => {
    setOtpError("");
    setOtpVerifying(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: String(form.email || "").trim().toLowerCase(),
        token: String(code || "").trim(),
        type: "email",
      });
      if (error) throw error;
      const token = String(data?.session?.access_token || "").trim();
      if (!token) throw new Error("Invalid OTP. Please try again.");
      const serverRes = await submitDonationServer(
        buildDonationPayload(form, token)
      );
      setOtpOpen(false);
      // OTP verified via Supabase — never keep the code or session in local state.
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore — one-time OTP session
      }
      onSubmit({ ...form, eligibility, _server: serverRes || {} });
    } catch (err) {
      // Real website: offline must fail visibly, never fake-approved.
      setOtpError(otpErrorText(err, "Invalid OTP. Please try again."));
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    setOtpError("");
    setResending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: String(form.email || "").trim().toLowerCase(),
        options: { emailRedirectTo: redirectTo() },
      });
      if (error) throw error;
    } catch (err) {
      setOtpError(otpErrorText(err, "Could not resend OTP. Please try again."));
    } finally {
      setResending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <SectionCard
        icon={<User className="h-5 w-5" />}
        title={t("donate.section.personal")}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            id="donorName"
            label={t("donate.field.donorName")}
            value={form.donorName}
            onChange={(v) => handleChange("donorName", v)}
            error={errors.donorName}
            placeholder={t("donate.field.donorName")}
            required
          />

          <Select
            id="bloodGroup"
            label={t("donate.field.bloodGroup")}
            value={form.bloodGroup}
            onChange={(v) => handleChange("bloodGroup", v)}
            options={BLOOD_GROUPS}
            error={errors.bloodGroup}
            placeholder={t("donate.placeholder.select")}
            required
          />
          <Input
            id="age"
            type="number"
            label={t("donate.field.age")}
            value={form.age}
            onChange={(v) => handleChange("age", v)}
            error={errors.age}
            placeholder={t("donate.placeholder.age")}
            required
            min={18}
            max={65}
          />
          <div>
            <label
              htmlFor="gender"
              className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300"
            >
              {t("donate.field.gender")}
              <span className="ml-0.5 text-red-600" aria-hidden="true">
                *
              </span>
            </label>
            <select
              id="gender"
              name="gender"
              value={form.gender}
              onChange={(e) => handleChange("gender", e.target.value)}
              required
              aria-invalid={errors.gender ? "true" : undefined}
              aria-describedby={errors.gender ? "gender-error" : undefined}
              className={`block w-full rounded-lg border bg-white px-3.5 text-sm text-gray-900 shadow-sm outline-none transition-colors focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-100 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 ${
                errors.gender
                  ? "border-red-400 focus:border-red-500 focus:ring-red-200 dark:border-red-500 dark:focus:border-red-400 dark:focus:ring-red-900/60"
                  : "border-gray-300 focus:border-red-500 focus:ring-red-200 dark:border-slate-700 dark:focus:border-brand-500 dark:focus:ring-brand-900/60"
              } h-11`}
            >
              <option value="">{t("donate.placeholder.select")}</option>
              <option value="Male">{t("donate.option.male")}</option>
              <option value="Female">{t("donate.option.female")}</option>
              <option value="Transgender">{t("donate.option.transgender")}</option>
            </select>
            {errors.gender && (
              <p
                id="gender-error"
                role="alert"
                className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400"
              >
                {errors.gender}
              </p>
            )}
          </div>
          <Input
            id="mobile"
            type="tel"
            label={t("donate.field.mobile")}
            value={form.mobile}
            onChange={(v) => handleChange("mobile", v)}
            error={errors.mobile}
            placeholder={t("donate.placeholder.mobile")}
            maxLength={10}
            required
          />
          <Input
            id="email"
            type="email"
            label={t("donate.field.email")}
            value={form.email}
            onChange={(v) => handleChange("email", v)}
            error={errors.email}
            required
          />
        </div>
      </SectionCard>

      <SectionCard
        icon={<CalendarDays className="h-5 w-5" />}
        title={t("donate.section.donation")}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            id="district"
            label={t("donate.field.district")}
            value={form.district}
            onChange={(v) => handleChange("district", v)}
            options={TN_DISTRICTS}
            error={errors.district}
            placeholder={t("donate.placeholder.select")}
            required
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300">
              {t("donate.field.date")}
              <span className="ml-0.5 text-red-600" aria-hidden="true">
                *
              </span>
            </label>
            {/* Preferred dates list — works on all viewports (up to 3). */}
            <div className="flex flex-col gap-2">
              {parseDateList(form.date).map((d, i, arr) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={d}
                    onChange={(v) => {
                      const dates = parseDateList(form.date);
                      dates[i] = v;
                      handleChange("date", dates.join(", "));
                    }}
                    min={today}
                    className="flex-1"
                  />
                  {arr.length > 1 && (
                    <button
                      type="button"
                      aria-label={t("donate.removeDate")}
                      title={t("donate.removeDate")}
                      onClick={() => {
                        const dates = parseDateList(form.date);
                        dates.splice(i, 1);
                        handleChange("date", dates.join(", "));
                      }}
                      className="rounded-lg border border-gray-300 bg-white p-2 text-gray-500 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {parseDateList(form.date).length < MAX_PREFERRED_DATES && (
                <button
                  type="button"
                  onClick={() => {
                    const dates = parseDateList(form.date);
                    handleChange("date", [...dates, ""].join(", "));
                  }}
                  className="inline-flex items-center gap-1 self-start text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
                >
                  <Plus className="h-4 w-4" />
                  {t("donate.addDate")}
                </button>
              )}
            </div>
            {errors.date && (
              <p
                role="alert"
                className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400"
              >
                {errors.date}
              </p>
            )}
          </div>
          <Input
            id="time"
            type="time"
            label={t("donate.field.time")}
            value={form.time}
            onChange={(v) => handleChange("time", v)}
            error={errors.time}
          />
          <Input
            id="prevDate"
            type="date"
            label={t("donate.field.prevDate")}
            value={form.prevDate}
            onChange={(v) => handleChange("prevDate", v)}
            error={errors.prevDate}
            max={today}
          />
          <div className="sm:col-span-2">
            <label
              htmlFor="address"
              className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300"
            >
              {t("donate.field.address")}
              <span className="ml-0.5 text-red-600" aria-hidden="true">
                *
              </span>
            </label>
            <textarea
              id="address"
              name="address"
              rows={2}
              value={form.address}
              onChange={(e) => handleChange("address", e.target.value)}
              placeholder={t("donate.placeholder.address")}
              aria-invalid={errors.address ? "true" : undefined}
              aria-describedby={errors.address ? "address-error" : undefined}
              className={`block w-full min-h-[64px] rounded-lg border bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm outline-none transition-colors focus:ring-2 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500 ${
                errors.address
                  ? "border-red-400 focus:border-red-500 focus:ring-red-200 dark:border-red-500 dark:focus:border-red-400 dark:focus:ring-red-900/60"
                  : "border-gray-300 focus:border-red-500 focus:ring-red-200 dark:border-slate-700 dark:focus:border-brand-500 dark:focus:ring-brand-900/60"
              }`}
            />
            {errors.address && (
              <p
                id="address-error"
                role="alert"
                className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400"
              >
                {errors.address}
              </p>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        icon={<HeartPulse className="h-5 w-5" />}
        title={t("donate.section.health")}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Checkbox
            id="eligibility"
            label={t("donate.eligibility.label")}
            checked={eligibility}
            onChange={handleEligibilityChange}
            error={errors.eligibility}
            className="sm:col-span-2"
          />
          <div className="sm:col-span-2">
            <label
              htmlFor="notes"
              className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300"
            >
              {t("donate.field.notes")}
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder={t("donate.placeholder.notes")}
              className={`block w-full min-h-[96px] rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm outline-none transition-colors focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-100 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 ${
                errors.notes
                  ? "border-red-400 focus:border-red-500 focus:ring-red-200 dark:border-red-500 dark:focus:border-red-400 dark:focus:ring-red-900/60"
                  : "border-gray-300 focus:border-red-500 focus:ring-red-200 dark:border-slate-700 dark:focus:border-brand-500 dark:focus:ring-brand-900/60"
              }`}
            />
            {errors.notes && (
              <p
                role="alert"
                className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400"
              >
                {errors.notes}
              </p>
            )}
          </div>
        </div>
      </SectionCard>

      {formError && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
        >
          {formError}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? t("donate.submitting") : t("donate.submit")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("donate.cancel")}
        </Button>
      </div>

      <DonationOtpDialog
        open={otpOpen}
        mobile={form.mobile}
        email={form.email}
        verifying={otpVerifying}
        resending={resending}
        error={otpError}
        onVerify={handleVerifyOtp}
        onResend={handleResendOtp}
        onClose={() => {
          if (!otpVerifying) setOtpOpen(false);
        }}
      />
    </form>
  );
}
