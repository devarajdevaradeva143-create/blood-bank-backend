import { useEffect, useRef, useState } from "react";
import { KeyRound, Loader2, X } from "lucide-react";
import Button from "../ui/Button";
import OtpBoxes from "../ui/OtpBoxes";

export default function DonationOtpDialog({
  open,
  mobile,
  email,
  title = "Verify OTP",
  description = "",
  verifying = false,
  resending = false,
  error = "",
  autoSubmit = false,
  onVerify,
  onResend,
  onClose,
}) {
  const [code, setCode] = useState("");
  const [localError, setLocalError] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  const autoFiredRef = useRef("");

  // Reset the code field each time the dialog is (re)opened.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setCode("");
      setLocalError("");
      autoFiredRef.current = "";
    }
  }

  // Register OTP: 6 digits type panna odane auto verify (donate/others need button).
  useEffect(() => {
    if (autoSubmit && open && !verifying && /^\d{6}$/.test(code) && autoFiredRef.current !== code) {
      autoFiredRef.current = code;
      setLocalError("");
      onVerify(code);
    }
  }, [autoSubmit, open, verifying, code, onVerify]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setLocalError(
        email
          ? "Please enter the 6-digit OTP sent to your email."
          : "Please enter the 6-digit OTP sent to your mobile."
      );
      return;
    }
    setLocalError("");
    autoFiredRef.current = trimmed;
    onVerify(trimmed);
  };

  const shownError = localError || error;
  const contactLabel = email ? String(email) : mobile ? `+91 ${mobile}` : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="donation-otp-title"
    >
      <div className="my-auto max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
            <KeyRound className="h-5 w-5" />
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={verifying}
            aria-label="Close OTP dialog"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <h2
          id="donation-otp-title"
          className="mt-4 text-lg font-bold text-gray-900 dark:text-white"
        >
          {title}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          {description ? (
            <>
              {description} {contactLabel}.
            </>
          ) : (
            <>
              We sent a 6-digit code to {contactLabel || "your email"}. Enter it below to confirm
              your donation request.
            </>
          )}
        </p>

        <form onSubmit={handleSubmit} className="mt-5">
          <label
            htmlFor="donation-otp-1"
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300"
          >
            6-digit OTP
          </label>
          <OtpBoxes
            value={code}
            onChange={(v) => {
              setCode(v);
              setLocalError("");
            }}
            length={6}
            disabled={verifying}
            error={Boolean(shownError)}
            idPrefix="donation-otp"
          />
          <input type="hidden" autoComplete="one-time-code" value={code} readOnly aria-hidden="true" tabIndex={-1} className="hidden" />
          {shownError && (
            <p
              role="alert"
              className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400"
            >
              {shownError}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              type="submit"
              variant="primary"
              disabled={verifying || code.trim().length !== 6}
              className="w-full px-4 py-2.5 sm:w-auto sm:flex-1"
            >
              {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
              {verifying ? "Verifying..." : "Verify & Submit"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onResend}
              disabled={verifying || resending}
              className="w-full px-4 py-2.5 sm:w-auto"
            >
              {resending && <Loader2 className="h-4 w-4 animate-spin" />}
              {resending ? "Sending..." : "Resend OTP"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
