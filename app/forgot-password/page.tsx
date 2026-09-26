"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  KeyRound,
  Mail,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

type Step = "email" | "code" | "password" | "success";

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>("email");

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMsg("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "request-code",
          email,
        }),
      });

      const data = await response.json();

      setLoading(false);

      if (!response.ok) {
        setMsg(data.error || "Unable to send reset code.");
        return;
      }

      setStep("code");
      setMsg(data.message || "A verification code has been sent.");
    } catch {
      setLoading(false);
      setMsg("Unable to connect to the server.");
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMsg("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "verify-code",
          email,
          code,
        }),
      });

      const data = await response.json();

      setLoading(false);

      if (!response.ok) {
        setMsg(data.error || "Invalid verification code.");
        return;
      }

      setStep("password");
      setMsg("");
    } catch {
      setLoading(false);
      setMsg("Unable to connect to the server.");
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();

    setMsg("");

    if (password.length < 8) {
      setMsg("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMsg("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "reset-password",
          email,
          code,
          password,
        }),
      });

      const data = await response.json();

      setLoading(false);

      if (!response.ok) {
        setMsg(data.error || "Unable to reset password.");
        return;
      }

      setStep("success");
      setMsg("");
    } catch {
      setLoading(false);
      setMsg("Unable to connect to the server.");
    }
  }

  function resendCode() {
    setCode("");
    setMsg("");

    setStep("email");
  }

  return (
    <main className="auth-shell">
      <div className="auth-box">
        {/* LOGO */}
        <img
          src="/logo-white.png"
          alt="Sumedha College Photography Club"
          style={{
            width: 260,
            maxWidth: "80%",
            marginBottom: 28,
          }}
        />

        {/* EMAIL STEP */}
        {step === "email" && (
          <>
            <span className="kicker">
              Account recovery
            </span>

            <h1
              style={{
                font: "700 47px Space Grotesk",
                letterSpacing: "-.055em",
                margin: "8px 0",
              }}
            >
              Forgot password.
            </h1>

            <p
              className="soft"
              style={{
                fontSize: 12,
                lineHeight: 1.7,
              }}
            >
              Enter the email address connected to your
              Photography Club LMS account. We will send you
              a 6-digit verification code.
            </p>

            <form className="form" onSubmit={requestCode}>
              <div className="field">
                <label>Email</label>

                <input
                  className="input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@school.lk"
                  autoComplete="email"
                />
              </div>

              <button
                className="btn primary"
                disabled={loading}
                type="submit"
              >
                {loading ? "Sending…" : "Send verification code"}

                <ArrowRight size={15} />
              </button>
            </form>

            {msg && (
              <div
                className="notice"
                style={{
                  marginTop: 14,
                }}
              >
                {msg}
              </div>
            )}

            <div className="divider" />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10,
                color: "#777",
              }}
            >
              <Link href="/login">
                ← Back to login
              </Link>

              <Link href="/register">
                Request access ↗
              </Link>
            </div>
          </>
        )}

        {/* CODE STEP */}
        {step === "code" && (
          <>
            <span className="kicker">
              Email verification
            </span>

            <h1
              style={{
                font: "700 47px Space Grotesk",
                letterSpacing: "-.055em",
                margin: "8px 0",
              }}
            >
              Enter your code.
            </h1>

            <p
              className="soft"
              style={{
                fontSize: 12,
                lineHeight: 1.7,
              }}
            >
              We sent a 6-digit password reset code to:
            </p>

            <div
              style={{
                marginTop: 10,
                color: "#d6b76b",
                fontSize: 12,
                fontWeight: 700,
                wordBreak: "break-word",
              }}
            >
              {email}
            </div>

            <form className="form" onSubmit={verifyCode}>
              <div className="field">
                <label>6-Digit Code</label>

                <input
                  className="input reset-code-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) =>
                    setCode(
                      e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 6)
                    )
                  }
                  placeholder="000000"
                  autoComplete="one-time-code"
                />
              </div>

              <button
                className="btn primary"
                disabled={loading || code.length !== 6}
                type="submit"
              >
                {loading ? "Checking…" : "Verify code"}

                <ShieldCheck size={15} />
              </button>
            </form>

            {msg && (
              <div
                className="notice"
                style={{
                  marginTop: 14,
                }}
              >
                {msg}
              </div>
            )}

            <div
              style={{
                marginTop: 15,
                textAlign: "center",
                fontSize: 10,
                color: "#777",
              }}
            >
              Code expires in 10 minutes.
            </div>

            <div className="divider" />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10,
                color: "#777",
              }}
            >
              <button
                type="button"
                onClick={resendCode}
                style={{
                  border: 0,
                  background: "transparent",
                  color: "#d6b76b",
                  padding: 0,
                  fontSize: 10,
                }}
              >
                Resend code
              </button>

              <Link href="/login">
                ← Login
              </Link>
            </div>
          </>
        )}

        {/* PASSWORD STEP */}
        {step === "password" && (
          <>
            <span className="kicker">
              Create new password
            </span>

            <h1
              style={{
                font: "700 47px Space Grotesk",
                letterSpacing: "-.055em",
                margin: "8px 0",
              }}
            >
              New password.
            </h1>

            <p
              className="soft"
              style={{
                fontSize: 12,
                lineHeight: 1.7,
              }}
            >
              Choose a new secure password for your LMS
              account.
            </p>

            <form className="form" onSubmit={resetPassword}>
              <div className="field">
                <label>New password</label>

                <input
                  className="input"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  placeholder="New password"
                  autoComplete="new-password"
                />
              </div>

              <div className="field">
                <label>Confirm password</label>

                <input
                  className="input"
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                />
              </div>

              <button
                className="btn primary"
                disabled={loading}
                type="submit"
              >
                {loading ? "Updating…" : "Reset password"}

                <KeyRound size={15} />
              </button>
            </form>

            {msg && (
              <div
                className="notice"
                style={{
                  marginTop: 14,
                }}
              >
                {msg}
              </div>
            )}

            <div className="approval" style={{ marginTop: 15 }}>
              <ShieldCheck
                size={14}
                style={{
                  verticalAlign: "middle",
                  marginRight: 6,
                }}
              />

              Your new password will be securely stored.
            </div>
          </>
        )}

        {/* SUCCESS STEP */}
        {step === "success" && (
          <>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                marginBottom: 22,
                background: "#173020",
                color: "#8dd6a4",
              }}
            >
              <CheckCircle2 size={30} />
            </div>

            <span className="kicker">
              Password updated
            </span>

            <h1
              style={{
                font: "700 47px Space Grotesk",
                letterSpacing: "-.055em",
                margin: "8px 0",
              }}
            >
              You're all set.
            </h1>

            <p
              className="soft"
              style={{
                fontSize: 12,
                lineHeight: 1.7,
              }}
            >
              Your password has been successfully changed.
              You can now log in using your new password.
            </p>

            <button
              className="btn primary"
              type="button"
              onClick={() => {
                window.location.href = "/login";
              }}
              style={{
                width: "100%",
                marginTop: 22,
              }}
            >
              Back to login
              <ArrowRight size={15} />
            </button>
          </>
        )}
      </div>
    </main>
  );
}