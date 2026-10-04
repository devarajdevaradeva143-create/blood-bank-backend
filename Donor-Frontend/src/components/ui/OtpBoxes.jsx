import { useEffect, useRef } from "react";

// Shared 6-box OTP input (donor register / forgot / donate).
// Props: value (6-char string), onChange(next), length=6, disabled, error(bool), autoFocus, idPrefix.
export default function OtpBoxes({
  value = "",
  onChange,
  length = 6,
  disabled = false,
  error = false,
  autoFocus = true,
  idPrefix = "otp",
}) {
  const digits = String(value || "")
    .replace(/\D/g, "")
    .slice(0, length)
    .padEnd(length, "")
    .split("")
    .slice(0, length);
  const refs = useRef([]);

  useEffect(() => {
    if (autoFocus && !disabled && refs.current[0]) {
      try {
        refs.current[0].focus();
      } catch {
        // ignore focus errors
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setDigit = (next) => {
    const clean = String(next || "").replace(/\D/g, "").slice(0, length);
    onChange(clean);
  };

  const handleChange = (i, raw) => {
    const d = String(raw || "").replace(/\D/g, "");
    if (!d) {
      const arr = [...digits];
      arr[i] = "";
      onChange(arr.join("").replace(/\D/g, ""));
      return;
    }
    const last = d.slice(-1);
    const arr = [...digits];
    arr[i] = last;
    const next = arr.join("").replace(/\D/g, "").slice(0, length);
    onChange(next);
    if (i < length - 1 && refs.current[i + 1]) {
      try {
        refs.current[i + 1].focus();
      } catch {
        // ignore
      }
    }
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      if (digits[i]) {
        const arr = [...digits];
        arr[i] = "";
        onChange(arr.join("").replace(/\D/g, ""));
      } else if (i > 0 && refs.current[i - 1]) {
        const arr = [...digits];
        arr[i - 1] = "";
        onChange(arr.join("").replace(/\D/g, ""));
        try {
          refs.current[i - 1].focus();
        } catch {
          // ignore
        }
      }
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && i > 0 && refs.current[i - 1]) {
      try {
        refs.current[i - 1].focus();
      } catch {
        // ignore
      }
      e.preventDefault();
    } else if (e.key === "ArrowRight" && i < length - 1 && refs.current[i + 1]) {
      try {
        refs.current[i + 1].focus();
      } catch {
        // ignore
      }
      e.preventDefault();
    }
  };

  const handlePaste = (e) => {
    const text = (e.clipboardData?.getData("text") || "").replace(/\D/g, "").slice(0, length);
    if (!text) return;
    e.preventDefault();
    setDigit(text);
    const focusIdx = Math.min(text.length, length - 1);
    if (refs.current[focusIdx]) {
      try {
        refs.current[focusIdx].focus();
      } catch {
        // ignore
      }
    }
  };

  const boxClass = (filled) =>
    `flex h-11 w-9 items-center justify-center rounded-lg border bg-white text-center text-base font-bold text-gray-900 shadow-sm outline-none transition-colors focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-100 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800 sm:h-12 sm:w-11 sm:text-lg ${
      error
        ? "border-red-400 focus:border-red-500 focus:ring-red-200 dark:border-red-500 dark:focus:ring-red-900/60"
        : filled
          ? "border-red-500 focus:border-red-500 focus:ring-red-200 dark:border-brand-500 dark:focus:ring-brand-900/60"
          : "border-gray-300 focus:border-red-500 focus:ring-red-200 dark:border-slate-700 dark:focus:border-brand-500 dark:focus:ring-brand-900/60"
    }`;

  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-2" onPaste={handlePaste} role="group" aria-label="6-digit OTP">
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          id={`${idPrefix}-${i + 1}`}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digits[i] || ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={error ? "true" : undefined}
          className={boxClass(Boolean(digits[i]))}
        />
      ))}
    </div>
  );
}
