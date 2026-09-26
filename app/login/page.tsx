"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ShieldCheck, KeyRound } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMsg("");

    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const d = await r.json();

      setLoading(false);

      if (!r.ok) {
        setMsg(d.error || "Login failed");
        return;
      }

      location.href = `/verify?email=${encodeURIComponent(d.email)}`;
    } catch {
      setLoading(false);
      setMsg("Unable to connect to the server. Please try again.");
    }
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

        {/* KICKER */}
        <span className="kicker">
          Private student & admin portal
        </span>

        {/* TITLE */}
        <h1
          style={{
            font: "700 47px Space Grotesk",
            letterSpacing: "-.055em",
            margin: "8px 0",
          }}
        >
          Student login.
        </h1>

        {/* DESCRIPTION */}
        <p
          className="soft"
          style={{
            fontSize: 12,
            lineHeight: 1.7,
          }}
        >
          Approved students and administrators sign in with their email and
          password, then verify a 6-digit code sent by email.
        </p>

        {/* LOGIN FORM */}
        <form className="form" onSubmit={submit}>
          {/* EMAIL */}
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

          {/* PASSWORD */}
          <div className="field">
            <label>Password</label>

            <input
              className="input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              autoComplete="current-password"
            />

            {/* FORGOT PASSWORD */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 9,
              }}
            >
              <Link
                href="/forgot-password"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  color: "#d8b55a",
                  fontSize: 11,
                  textDecoration: "none",
                  transition: "opacity .2s ease",
                }}
              >
                <KeyRound size={12} />
                Forgot password?
              </Link>
            </div>
          </div>

          {/* LOGIN BUTTON */}
          <button
            className="btn primary"
            disabled={loading}
            type="submit"
          >
            {loading ? "Checking…" : "Continue"}

            <ArrowRight size={15} />
          </button>
        </form>

        {/* ERROR / STATUS MESSAGE */}
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

        {/* APPROVAL NOTICE */}
        <div
          className="approval"
          style={{
            marginTop: 15,
          }}
        >
          <ShieldCheck
            size={14}
            style={{
              verticalAlign: "middle",
              marginRight: 6,
            }}
          />

          Member access is admin-approved. New students must request access
          before they can enter.
        </div>

        {/* DIVIDER */}
        <div className="divider" />

        {/* FOOTER LINKS */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10,
            color: "#777",
          }}
        >
          <Link href="/register">
            Request access ↗
          </Link>

          <Link href="/">
            ← Home
          </Link>
        </div>
      </div>
    </main>
  );
}