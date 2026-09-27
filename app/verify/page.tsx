import { Suspense } from 'react';
import VerifyClient from './VerifyClient';

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-shell">
          <div className="auth-box">
            <img
              src="/logo-white.png"
              alt="Sumedha College Photography Club"
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
                fontFamily: 'Space Grotesk, sans-serif',
                fontWeight: 700,
                fontSize: 45,
                letterSpacing: '-0.05em',
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
              Loading verification...
            </p>
          </div>
        </main>
      }
    >
      <VerifyClient />
    </Suspense>
  );
}