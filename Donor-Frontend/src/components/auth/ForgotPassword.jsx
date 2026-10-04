import { useState } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Sparkles,
} from "lucide-react";
import s from "./DonorLogin.module.css";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  generateStrongPassword,
  getPasswordStrength,
} from "../../utils/passwordStrength";
import { requestPasswordReset, resetPassword } from "../../services/authApi";
import OtpBoxes from "../ui/OtpBoxes";

export default function ForgotPassword({ email: initialEmail, onBack }) {
  const { t } = useLanguage();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState(initialEmail ?? "");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = getPasswordStrength(newPassword);

  const handleSuggest = () => {
    const generated = generateStrongPassword();
    setNewPassword(generated);
    setConfirmPassword(generated);
    setError("");
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError("");
    setNote("");

    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError(t("login.error.emailRequired"));
      return;
    }
    if (!/\S+@\S+\.\S+/.test(trimmed)) {
      setError(t("login.error.emailInvalid"));
      return;
    }

    setLoading(true);
    try {
      const res = await requestPasswordReset(trimmed);
      if (!res.ok) {
        if (res.reason === "cooldown") {
          setError(t("login.forgot.error.cooldown"));
        } else if (res.reason === "network") {
          setError(t("login.forgot.error.network"));
        } else {
          setError(t("login.forgot.error.notFound"));
        }
        return;
      }
      setEmail(trimmed);
      setNote(t("login.forgot.otpSent"));
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");

    if (!otp.trim()) {
      setError(t("login.forgot.error.otpRequired"));
      return;
    }
    if (!/^\d{6}$/.test(otp.trim())) {
      setError(t("login.forgot.error.otpInvalid"));
      return;
    }
    if (newPassword.length < 8) {
      setError(t("signup.error.passwordLength"));
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setError(t("signup.error.passwordUpper"));
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      setError(t("signup.error.passwordLower"));
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setError(t("signup.error.passwordNumber"));
      return;
    }
    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      setError(t("signup.error.passwordSpecial"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("signup.error.passwordMismatch"));
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword({
        email,
        otp: otp.trim(),
        newPassword,
      });
      if (!res.ok) {
        if (res.reason === "cooldown") {
          setError(t("login.forgot.error.cooldown"));
        } else if (res.reason === "network") {
          setError(t("login.forgot.error.network"));
        } else {
          // otp_invalid + otp_expired — message already covers both.
          setError(t("login.forgot.error.otpInvalid"));
        }
        return;
      }
      setNote(t("login.forgot.success"));
      setTimeout(() => onBack(email, t("login.forgot.resetSuccess")), 1400);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h2>{t("login.forgot.title")}</h2>
      <p className={s["login-subtitle"]}>{t("login.forgot.subtitle")}</p>

      <div className={s["forgot-steps"]}>
        <span className={step === 1 ? s["step-active"] : ""}>
          {t("login.forgot.step1")}
        </span>
        <span className={step === 2 ? s["step-active"] : ""}>
          {t("login.forgot.step2")}
        </span>
      </div>

      {step === 1 ? (
        <form onSubmit={handleSendOtp}>
          <div className={s["form-group"]}>
            <label htmlFor="forgot-email">{t("login.email")}</label>
            <div className={s["input-wrapper"]}>
              <span className={s["input-icon"]}>
                <Mail />
              </span>
              <input
                id="forgot-email"
                type="email"
                placeholder={t("login.emailPlaceholder")}
                value={email}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className={s["error-message"]} role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className={s["login-button"]}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {t("login.forgot.sending")}
              </>
            ) : (
              `${t("login.forgot.sendOtp")} →`
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleReset}>
          {/* OTP — 6 boxes, manual verify via Reset button (register mattum auto) */}
          <div className={s["form-group"]}>
            <label htmlFor="forgot-otp-1">{t("login.forgot.otp")}</label>
            <OtpBoxes
              value={otp}
              onChange={(v) => setOtp(v)}
              length={6}
              disabled={loading}
              error={Boolean(error)}
              idPrefix="forgot-otp"
            />
          </div>

          {/* NEW PASSWORD */}
          <div className={s["form-group"]}>
            <label htmlFor="forgot-new-password">
              {t("login.forgot.newPassword")}
            </label>
            <div className={s["input-wrapper"]}>
              <span className={s["input-icon"]}>
                <Lock />
              </span>
              <input
                id="forgot-new-password"
                type={showNew ? "text" : "password"}
                placeholder={t("login.forgot.newPasswordPlaceholder")}
                value={newPassword}
                autoComplete="new-password"
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                className={s["password-toggle"]}
                aria-label={t("password.generate")}
                title={t("password.generate")}
                onClick={handleSuggest}
              >
                <Sparkles />
              </button>
              <button
                type="button"
                className={s["password-toggle"]}
                aria-label={showNew ? "Hide password" : "Show password"}
                onClick={() => setShowNew((v) => !v)}
              >
                {showNew ? <EyeOff /> : <Eye />}
              </button>
            </div>

            {strength && (
              <div className={`${s["password-strength"]} ${s[strength]}`}>
                {t("signup.strength.label")}:{" "}
                <strong>{t(`signup.strength.${strength}`)}</strong>
              </div>
            )}
          </div>

          {/* CONFIRM PASSWORD */}
          <div className={s["form-group"]}>
            <label htmlFor="forgot-confirm-password">
              {t("login.forgot.confirmPassword")}
            </label>
            <div className={s["input-wrapper"]}>
              <span className={s["input-icon"]}>
                <Lock />
              </span>
              <input
                id="forgot-confirm-password"
                type={showConfirm ? "text" : "password"}
                placeholder={t("login.forgot.confirmPasswordPlaceholder")}
                value={confirmPassword}
                autoComplete="new-password"
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                type="button"
                className={s["password-toggle"]}
                aria-label={
                  showConfirm ? "Hide password" : "Show password"
                }
                onClick={() => setShowConfirm((v) => !v)}
              >
                {showConfirm ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </div>

          {note && (
            <div className={s["info-message"]} role="status">
              {note}
            </div>
          )}
          {error && (
            <div className={s["error-message"]} role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className={s["login-button"]}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {t("login.forgot.resetting")}
              </>
            ) : (
              `${t("login.forgot.reset")} →`
            )}
          </button>
        </form>
      )}

      <button
        type="button"
        className={s["forgot-back"]}
        onClick={() => onBack(email)}
      >
        <ArrowLeft size={16} />
        {t("login.forgot.back")}
      </button>
    </>
  );
}
