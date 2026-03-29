"use client";
import React, { useState, useCallback } from "react";
import { signIn } from "@/lib/auth";
import { FirebaseError } from "firebase/app";

interface Props {
  redirectTo?: string;
}

const EMAIL_REGEX = /\S+@\S+\.\S+/;
const PASSWORD_REGEX = /^.{8,}$/; // Only 8+ characters required now

const ERROR_MESSAGES: Record<string, string> = {
  "auth/configuration-not-found": "Email/Password sign-in is not enabled.",
  "auth/operation-not-allowed": "Email/Password sign-in is not enabled.",
  "auth/user-not-found": "No account found for this email!",
  "auth/wrong-password": "Incorrect email or password!",
  "auth/invalid-credential": "Incorrect email or password!",
  "auth/too-many-requests": "Too many attempts. Please wait a minute and try again.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
};

function MSIcon({ name, className }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className || ''}`}>{name}</span>;
}

export const LoginForm: React.FC<Props> = ({ redirectTo = "/dashboard" }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const isEmailValid = useCallback((value: string) => EMAIL_REGEX.test(value), []);
  const isPasswordValid = useCallback((value: string) => PASSWORD_REGEX.test(value), []);
  const isFormValid = email && password;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isEmailValid(email)) {
      setError("Invalid email format");
      return;
    }

    if (!isPasswordValid(password)) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      window.location.href = redirectTo;
    } catch (err) {
      const message = err instanceof FirebaseError
        ? ERROR_MESSAGES[err.code] || "Login failed"
        : err instanceof Error
        ? err.message
        : "Login failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-5">
      
      <div className="space-y-1.5">
        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest pl-1">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={loading}
          className="w-full h-14 bg-white border border-slate-200 rounded-2xl px-5 text-[14px] font-semibold text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-[#b7102a]/30 focus:border-[#b7102a] transition-all disabled:opacity-50 placeholder:text-slate-300"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest pl-1">Password</label>
        <div className="relative">
          <input
            id="password"
            type={passwordVisible ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={loading}
            className="w-full h-14 bg-white border border-slate-200 rounded-2xl pl-5 pr-12 text-[15px] font-semibold text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-[#b7102a]/30 focus:border-[#b7102a] transition-all disabled:opacity-50 placeholder:text-slate-300"
          />
          <button
            type="button"
            onClick={() => setPasswordVisible(!passwordVisible)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
            tabIndex={-1}
          >
            <MSIcon name={passwordVisible ? "visibility_off" : "visibility"} className="text-[20px]" />
          </button>
        </div>
      </div>

      {error && (
        <div className="text-[13px] text-[#b7102a] bg-red-50 border border-red-100 rounded-2xl px-4 py-3 font-semibold flex items-center gap-2">
          <MSIcon name="error" className="text-[18px] shrink-0" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !isFormValid}
        className="w-full h-14 bg-[#b7102a] text-white font-black rounded-2xl shadow-lg shadow-red-900/25 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-2 text-[15px] mt-2"
      >
        {loading
          ? <><MSIcon name="progress_activity" className="animate-spin text-[20px]" /> Signing in...</>
          : <><span>Sign In</span><MSIcon name="arrow_forward" className="text-[20px]" /></>
        }
      </button>

    </form>
  );
};
