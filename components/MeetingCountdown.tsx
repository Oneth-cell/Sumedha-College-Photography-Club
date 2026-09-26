'use client';

import { useEffect, useState } from 'react';

export default function MeetingCountdown({
  startTime,
}: {
  startTime: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [ms, setMs] = useState(0);

  useEffect(() => {
    setMounted(true);

    const target = new Date(startTime).getTime();

    const update = () => {
      setMs(Math.max(0, target - Date.now()));
    };

    update();

    const timer = setInterval(update, 1000);

    return () => clearInterval(timer);
  }, [startTime]);

  if (!mounted) {
    return <div className="countdown">00 : 00 : 00</div>;
  }

  const total = Math.floor(ms / 1000);

  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  return (
    <div className="countdown">
      {d ? `${String(d).padStart(2, '0')}d ` : ''}
      {String(h).padStart(2, '0')} :{' '}
      {String(m).padStart(2, '0')} :{' '}
      {String(s).padStart(2, '0')}
    </div>
  );
}