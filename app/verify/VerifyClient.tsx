'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, RefreshCw } from 'lucide-react';

export default function VerifyClient() {
  const sp = useSearchParams();

  const [email, setEmail] = useState(sp.get('email') || '');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    const r = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        code,
      }),
    });

    const d = await r.json();

    setBusy(false);

    if (!r.ok) {
      setMsg(d.error || 'Invalid code');
      return;
    }

    location.href = d.redirect || '/lms';
  }

  async function resend() {
    const r = await fetch('/api/auth/resend-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
      }),
    });

    const d = await r.json();

    setMsg(
      r.ok
        ? 'A new code was sent.'
        : d.error || 'Unable to resend.'
    );
  }

  return (
    <main className="auth-shell">
      <div className="auth-box">
        <img
          src="/logo-white.png"
          style={{
            width: 230,
            maxWidth: '80%',
            marginBottom: 28,
          }}
        />

        <span className="kicker">
          Two-step confirmation
        </span>

        <h1
          style={{
            font: '700 45px Space Grotesk',
            letterSpacing: '-.05em',
            margin: '8px 0',
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
          We sent a 6-digit confirmation code to the approved
          student's email. It expires in 10 minutes.
        </p>

        <form className="form" onSubmit={verify}>
          <div className="field">
            <label>Approved email</label>

            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <label>6-digit code</label>

            <input
              className="input"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, ''))
              }
              placeholder="000000"
            />
          </div>

          <button
            className="btn primary"
            disabled={busy}
          >
            {busy ? 'Verifying…' : 'Verify & enter LMS'}
            <ArrowRight size={15} />
          </button>
        </form>

        {msg && (
          <div
            className="notice"
            style={{ marginTop: 13 }}
          >
            {msg}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 12,
          }}
        >
          <button
            className="btn"
            onClick={resend}
          >
            <RefreshCw size={13} />
            Resend code
          </button>

          <Link
            className="btn"
            href="/login"
          >
            Back
          </Link>
        </div>
      </div>
    </main>
  );
}