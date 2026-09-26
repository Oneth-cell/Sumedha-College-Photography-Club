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
              style={{
                width: 230,
                maxWidth: '80%',
                marginBottom: 28,
              }}
            />
            <span className="kicker">Two-step confirmation</span>
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