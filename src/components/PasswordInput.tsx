import { useState } from "react";

/**
 * Password field with a show/hide toggle. Drop-in for the auth screens
 * (sign in, register, first-admin setup).
 */
export function PasswordInput({
  value,
  onChange,
  required,
  minLength,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        className="input pr-16"
        type={show ? "text" : "password"}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 px-3 flex items-center text-xs font-bold uppercase tracking-wide text-rebar"
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}
