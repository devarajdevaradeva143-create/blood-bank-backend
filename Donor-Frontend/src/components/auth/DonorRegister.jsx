import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Droplet,
  Eye,
  EyeOff,
  HeartHandshake,
  Loader2,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import s from "./DonorRegister.module.css";
import ls from "./DonorLogin.module.css";
import DonationOtpDialog from "../donate/DonationOtpDialog";
import { useLanguage } from "../../i18n/LanguageContext";
import { TN_DISTRICTS } from "../../data/constants";
import { registerDonor, requestRegisterOtp } from "../../lib/api";
// SUPABASE-PENDING: paused, kept for later resume.
// import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { classifyOtpError } from "../../lib/otpErrors";
import { saveLocalDonor } from "../../services/authApi";
import {
  generateStrongPassword,
  getPasswordStrength,
} from "../../utils/passwordStrength";

const BENEFITS = [
  { key: "save", Icon: Droplet },
  { key: "community", Icon: Users },
  { key: "safe", Icon: ShieldCheck },
  { key: "regular", Icon: HeartHandshake },
];

function getMinDob() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 65);
  return d.toISOString().slice(0, 10);
}

function getMaxDob() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}

function getDonorAge(dobStr) {
  const dob = new Date(dobStr);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function DonorRegisterForm() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Map Supabase Auth errors to specific UI messages (no technical leak).
  // expired vs invalid vs cooldown — "same error" confusion fix.
  const supabaseErrorMessage = (err) => {
    const reason = classifyOtpError(err);
    if (reason === "expired") return t("signup.otp.error.expired");
    if (reason === "cooldown") return t("signup.otp.error.cooldown");
    if (reason === "network") return t("signup.otp.error.network");
    const blob = `${err?.message || ""} ${err?.code || ""}`.toLowerCase();
    if (
      blob.includes("exists") ||
      blob.includes("taken") ||
      blob.includes("already")
    ) {
      return t("signup.error.phoneExists");
    }
    return t("signup.otp.error");
  };

  // Backend OTP error mappers (primary). Supabase mapper above kept for resume.
  const backendOtpError = (err) => {
    const msg = String(err?.message || "");
    if (/Too many|wait \d+s|429/i.test(msg)) return t("signup.otp.error.cooldown");
    if (/expir/i.test(msg)) return t("signup.otp.error.expired");
    if (/already exists/i.test(msg)) return t("signup.error.phoneExists");
    if (/Unable to reach server|Failed to fetch|Network/i.test(msg)) return t("signup.otp.error.network");
    return msg || t("signup.otp.error");
  };
  const backendRegisterError = (err) => {
    const msg = String(err?.message || "");
    if (/already exists/i.test(msg)) return t("signup.error.phoneExists");
    if (/Too many|wait \d+s|429/i.test(msg)) return t("signup.otp.error.cooldown");
    if (/Unable to reach server|Failed to fetch|Network/i.test(msg)) return t("signup.otp.error.network");
    return msg || t("signup.otp.error");
  };
  // Magic-link redirect target — current origin (localhost dev / Pages prod).
  // OTP-only template la link ye illa, aana backup safety ku correct URL pogum.
  const redirectTo = () => {
    try {
      return window.location.origin;
    } catch {
      return undefined;
    }
  };

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    dob: "",
    gender: "",
    bloodGroup: "",
    district: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpResending, setOtpResending] = useState(false);
  const [otpError, setOtpError] = useState("");

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (
      !form.name ||
      !form.email ||
      !form.phone ||
      !form.dob ||
      !form.gender ||
      !form.bloodGroup ||
      !form.district ||
      !form.password ||
      !form.confirmPassword
    ) {
      setError(t("signup.error.allRequired"));
      return;
    }

    if (!/\S+@\S+\.\S+/.test(form.email)) {
      setError(t("signup.error.emailInvalid"));
      return;
    }

    if (!/^[0-9]{10}$/.test(form.phone)) {
      setError(t("signup.error.phoneInvalid"));
      return;
    }

    const donorAge = getDonorAge(form.dob);
    if (donorAge === null || donorAge < 18 || donorAge > 65) {
      setError(t("signup.error.ageInvalid"));
      return;
    }

    if (form.password.length < 8) {
      setError(t("signup.error.passwordLength"));
      return;
    }

    if (!/[A-Z]/.test(form.password)) {
      setError(t("signup.error.passwordUpper"));
      return;
    }

    if (!/[a-z]/.test(form.password)) {
      setError(t("signup.error.passwordLower"));
      return;
    }

    if (!/[0-9]/.test(form.password)) {
      setError(t("signup.error.passwordNumber"));
      return;
    }

    if (!/[^A-Za-z0-9]/.test(form.password)) {
      setError(t("signup.error.passwordSpecial"));
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError(t("signup.error.passwordMismatch"));
      return;
    }

    setLoading(true);
    // Backend Gmail OTP (primary — SUPABASE-PENDING: supabase block below kept for resume).
    try {
      const emailNorm = form.email.trim().toLowerCase();
      await requestRegisterOtp(emailNorm);
      setOtpError("");
      setError("");
      setOtpOpen(true);
    } catch (err) {
      setError(backendRegisterError(err));
    } finally {
      setLoading(false);
    }
    // SUPABASE-PENDING (old flow):
    // if (!isSupabaseConfigured()) { setError(t("signup.otp.notConfigured")); return; }
    // const { error: otpErr } = await supabase.auth.signInWithOtp({ email: emailNorm, options: { emailRedirectTo: redirectTo() } });
    // if (otpErr) { setError(supabaseErrorMessage(otpErr)); return; }
  };

  const buildPayload = () => ({
    fullName: form.name.trim(),
    email: form.email.trim().toLowerCase(),
    mobile: form.phone.trim(),
    dob: form.dob,
    gender: form.gender,
    bloodGroup: form.bloodGroup,
    district: form.district,
    districtId: form.district.toLowerCase().replace(/[^a-z0-9]/g, ""),
    password: form.password,
  });

  const handleVerifyOtp = async (code) => {
    setOtpError("");
    setOtpVerifying(true);
    try {
      // Backend Gmail OTP verify (primary). Code goes straight to backend.
      // SUPABASE-PENDING: supabase verify block kept below for resume.
      const data2 = await registerDonor(buildPayload(), String(code).trim());
      // SUPABASE-PENDING (old): const { data, error: verifyErr } = await supabase.auth.verifyOtp({ email: emailNorm, token: String(code).trim(), type: "email" });
      if (data2?.donor) saveLocalDonor(data2.donor);
      setOtpOpen(false);
      setSuccess(t("signup.success"));

      setTimeout(() => {
        navigate("/login", {
          replace: true,
          state: { registeredEmail: form.email, justRegistered: true },
        });
      }, 1200);
    } catch (err) {
      setOtpError(backendOtpError(err));
    } finally {
      setOtpVerifying(false);
    }
    // SUPABASE-PENDING: setOtpError(supabaseErrorMessage(err));
  };

  const handleResendOtp = async () => {
    setOtpError("");
    setOtpResending(true);
    try {
      // Backend resend (primary). Cooldown 60s enforced server-side.
      // SUPABASE-PENDING: supabase resend kept below.
      await requestRegisterOtp(form.email.trim().toLowerCase());
    } catch (err) {
      setOtpError(backendOtpError(err));
    } finally {
      setOtpResending(false);
    }
  };

  const strength = getPasswordStrength(form.password);

  const handleSuggestPassword = () => {
    const generated = generateStrongPassword();
    setForm({
      ...form,
      password: generated,
      confirmPassword: generated,
    });
    setError("");
  };

  return (
    <div className={`${ls["login-page"]} ${s["register-page"]}`}>
      {/* LEFT SECTION — same blood bank details as login page */}
      <div className={ls["login-info"]}>
        <span className={ls["hero-blob-1"]} aria-hidden="true" />
        <span className={ls["hero-blob-2"]} aria-hidden="true" />
        <span className={ls["hero-blob-3"]} aria-hidden="true" />

        <div className={ls.brand}>
          <div className={ls["brand-icon"]}>
            <HeartHandshake size={28} />
          </div>
          <div>
            <h1>Life Saver</h1>
            <p>Blood Bank Management</p>
          </div>
        </div>

        <div className={ls["info-content"]}>
          <h2>{t("login.info.heading")}</h2>

          <p className={ls["info-description"]}>{t("login.info.description")}</p>

          <div className={ls.benefits}>
            {BENEFITS.map(({ key, Icon }) => (
              <div className={ls.benefit} key={key}>
                <span className={ls["benefit-icon"]}>
                  <Icon />
                </span>
                <div>
                  <h3>{t(`login.benefit.${key}.title`)}</h3>
                  <p>{t(`login.benefit.${key}.text`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={ls["blood-illustration"]}>
          <div className={ls["blood-drop"]}>
            <Droplet />
          </div>
          <p>{t("login.illustration")}</p>
        </div>
      </div>

      {/* RIGHT SECTION — register form */}
      <div className={s["register-section"]}>
        <div className={s["register-card"]}>
          <div className={s["register-icon"]}>
            <Droplet size={28} />
          </div>

          <p className={s["card-badge"]}>{t("signup.badge")}</p>
          <h2>{t("signup.title")}</h2>
          <p className={s["register-subtitle"]}>{t("signup.subtitle")}</p>

          <form onSubmit={handleSubmit}>
            <h3 className={s["form-section-title"]}>
              {t("signup.section.personal")}
            </h3>
            <div className={s["form-row"]}>
              <div className={s["register-field"]}>
                <label htmlFor="reg-name">{t("signup.field.name")} <span className={s.required} aria-hidden="true">*</span></label>
                <input
                  id="reg-name"
                  type="text"
                  name="name"
                  placeholder={t("signup.placeholder.name")}
                  value={form.name}
                  onChange={handleChange}
                />
              </div>

              <div className={s["register-field"]}>
                <label htmlFor="reg-email">{t("signup.field.email")} <span className={s.required} aria-hidden="true">*</span></label>
                <input
                  id="reg-email"
                  type="email"
                  name="email"
                  placeholder={t("signup.placeholder.email")}
                  value={form.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className={s["form-row"]}>
              <div className={s["register-field"]}>
                <label htmlFor="reg-phone">{t("signup.field.phone")} <span className={s.required} aria-hidden="true">*</span></label>
                <input
                  id="reg-phone"
                  type="tel"
                  name="phone"
                  placeholder={t("signup.placeholder.phone")}
                  value={form.phone}
                  maxLength={10}
                  inputMode="numeric"
                  onChange={handleChange}
                />
              </div>

              <div className={s["register-field"]}>
                <label htmlFor="reg-dob">{t("signup.field.dob")} <span className={s.required} aria-hidden="true">*</span></label>
                <input
                  id="reg-dob"
                  type="date"
                  name="dob"
                  value={form.dob}
                  onChange={handleChange}
                  min={getMinDob()}
                  max={getMaxDob()}
                />
              </div>
            </div>

            <div className={s["form-row"]}>
              <div className={s["register-field"]}>
                <label htmlFor="reg-gender">{t("signup.field.gender")} <span className={s.required} aria-hidden="true">*</span></label>
                <select
                  id="reg-gender"
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                >
                  <option value="">{t("signup.placeholder.gender")}</option>
                  <option value="Male">{t("signup.option.male")}</option>
                  <option value="Female">{t("signup.option.female")}</option>
                  <option value="Other">{t("signup.option.other")}</option>
                </select>
              </div>

              <div className={s["register-field"]}>
                <label htmlFor="reg-blood">
                  {t("signup.field.bloodGroup")} <span className={s.required} aria-hidden="true">*</span>
                </label>
                <select
                  id="reg-blood"
                  name="bloodGroup"
                  value={form.bloodGroup}
                  onChange={handleChange}
                >
                  <option value="">{t("signup.placeholder.bloodGroup")}</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
            </div>

            <div className={s["register-field"]}>
              <label htmlFor="reg-district">{t("signup.field.district")} <span className={s.required} aria-hidden="true">*</span></label>
              <select
                id="reg-district"
                name="district"
                value={form.district}
                onChange={handleChange}
              >
                <option value="">{t("signup.placeholder.district")}</option>
                {TN_DISTRICTS.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
            </div>

            <h3 className={s["form-section-title"]}>
              {t("signup.section.account")}
            </h3>
            <div className={s["form-row"]}>
              <div className={s["register-field"]}>
                <label htmlFor="reg-password">
                  {t("signup.field.password")} <span className={s.required} aria-hidden="true">*</span>
                </label>
                <div className={s["password-box"]}>
                  <input
                    id="reg-password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder={t("signup.placeholder.password")}
                    value={form.password}
                    onChange={handleChange}
                  />
                  <button
                    type="button"
                    aria-label={t("password.generate")}
                    title={t("password.generate")}
                    onClick={handleSuggestPassword}
                  >
                    <Sparkles />
                  </button>
                  <button
                    type="button"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                    title={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>

                {strength && (
                  <div className={`${s["password-strength"]} ${s[strength]}`}>
                    <span
                      className={s["strength-meter"]}
                      aria-hidden="true"
                    >
                      <span
                        className={`${s["strength-seg"]} ${s["seg-on"]}`}
                      />
                      <span
                        className={`${s["strength-seg"]} ${
                          strength !== "weak" ? s["seg-on"] : ""
                        }`}
                      />
                      <span
                        className={`${s["strength-seg"]} ${
                          strength === "strong" ? s["seg-on"] : ""
                        }`}
                      />
                    </span>
                    {t("signup.strength.label")}:{" "}
                    <strong>{t(`signup.strength.${strength}`)}</strong>
                  </div>
                )}
              </div>

              <div className={s["register-field"]}>
                <label htmlFor="reg-confirm">
                  {t("signup.field.confirmPassword")} <span className={s.required} aria-hidden="true">*</span>
                </label>
                <div className={s["password-box"]}>
                  <input
                    id="reg-confirm"
                    type={showConfirm ? "text" : "password"}
                    name="confirmPassword"
                    placeholder={t("signup.placeholder.confirmPassword")}
                    value={form.confirmPassword}
                    onChange={handleChange}
                  />
                  <button
                    type="button"
                    aria-label={
                      showConfirm ? "Hide password" : "Show password"
                    }
                    aria-pressed={showConfirm}
                    title={showConfirm ? "Hide password" : "Show password"}
                    onClick={() => setShowConfirm(!showConfirm)}
                  >
                    {showConfirm ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className={s["register-error"]} role="alert">
                <AlertCircle size={17} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className={s["register-success"]} role="status">
                <CheckCircle2 size={17} aria-hidden="true" />
                <span>{success}</span>
              </div>
            )}

            <button
              type="submit"
              className={s["register-button"]}
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {t("signup.submitting")}
                </>
              ) : (
                `${t("signup.submit")} →`
              )}
            </button>
          </form>

          <div className={s["already-account"]}>
            {t("signup.already")}
            <button type="button" onClick={() => navigate("/login")}>
              {t("signup.login")}
            </button>
          </div>
        </div>
      </div>

      <DonationOtpDialog
        open={otpOpen}
        mobile={form.phone.trim()}
        email={form.email.trim().toLowerCase()}
        title={t("signup.otp.title")}
        description={t("signup.otp.description")}
        verifying={otpVerifying}
        resending={otpResending}
        error={otpError}
        autoSubmit
        onVerify={handleVerifyOtp}
        onResend={handleResendOtp}
        onClose={() => {
          if (!otpVerifying) setOtpOpen(false);
        }}
      />
    </div>
  );
}

export default function DonorRegister() {
  // Backend Gmail OTP primary — Supabase gate paused (SUPABASE-PENDING resume later).
  // SUPABASE-PENDING (old gate): if (!isSupabaseConfigured()) return notConfigured notice.
  return <DonorRegisterForm />;
}
