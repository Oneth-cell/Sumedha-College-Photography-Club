'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  PictureInPicture2,
  Settings,
} from 'lucide-react';

export default function VideoPlayer({
  src,
  poster,
  variants = {},
}: {
  src: string;
  poster?: string;
  variants?: Record<string, string>;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [menu, setMenu] = useState(false);
  const [quality, setQuality] = useState('Original');

  useEffect(() => {
    const v = ref.current;
    if (!v) return;

    const update = () => {
      setProgress(v.duration ? v.currentTime / v.duration : 0);
    };

    const handleVolumeChange = () => {
      setMuted(v.muted);
      setVolume(v.volume);
    };

    v.addEventListener('timeupdate', update);
    v.addEventListener('volumechange', handleVolumeChange);

    return () => {
      v.removeEventListener('timeupdate', update);
      v.removeEventListener('volumechange', handleVolumeChange);
    };
  }, []);

  function toggle() {
    const v = ref.current;
    if (!v) return;

    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const v = ref.current;
    const value = Number(e.target.value);

    if (v?.duration) {
      v.currentTime = value * v.duration;
    }

    setProgress(value);
  }

  function toggleMute() {
    const v = ref.current;
    if (!v) return;

    const nextMuted = !v.muted;
    v.muted = nextMuted;
    setMuted(nextMuted);
  }

  function setVol(e: React.ChangeEvent<HTMLInputElement>) {
    const n = Number(e.target.value);

    setVolume(n);

    if (ref.current) {
      ref.current.volume = n;

      if (n > 0 && ref.current.muted) {
        ref.current.muted = false;
        setMuted(false);
      }

      if (n === 0) {
        ref.current.muted = true;
        setMuted(true);
      }
    }
  }

  async function pip() {
    const v = ref.current as HTMLVideoElement & {
      requestPictureInPicture?: () => Promise<void>;
    };

    if (v?.requestPictureInPicture) {
      try {
        await v.requestPictureInPicture();
      } catch {
        // Picture-in-Picture may be unavailable in some browsers.
      }
    }
  }

  function fullscreen() {
    ref.current?.requestFullscreen?.();
  }

  function choose(q: string) {
    setQuality(q);
    setMenu(false);

    const url = variants[q];

    if (url && ref.current) {
      const v = ref.current;
      const currentTime = v.currentTime;
      const wasPlaying = !v.paused;

      v.src = url;

      v.addEventListener(
        'loadedmetadata',
        () => {
          v.currentTime = Math.min(currentTime, v.duration || currentTime);

          if (wasPlaying) {
            v.play().catch(() => {});
          }
        },
        { once: true }
      );
    }
  }

  return (
    <div className="video-player">
      <video
        ref={ref}
        src={src}
        poster={poster}
        playsInline
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      <div className="video-shade"></div>

      <div className="video-center">
        <button className="play-big" onClick={toggle}>
          {playing ? (
            <Pause fill="currentColor" />
          ) : (
            <Play fill="currentColor" />
          )}
        </button>
      </div>

      <div className="video-controls">
        <button onClick={toggle}>
          {playing ? <Pause size={15} /> : <Play size={15} />}
        </button>

        <button
          onClick={toggleMute}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? (
            <VolumeX size={15} />
          ) : (
            <Volume2 size={15} />
          )}
        </button>

        <input
          className="range seek"
          type="range"
          min="0"
          max="1"
          step="0.001"
          value={progress}
          onChange={seek}
        />

        <span className="video-time">
          {Math.round(progress * 100)}%
        </span>

        <button onClick={() => setMenu((v) => !v)}>
          <Settings size={15} />
        </button>

        <button onClick={pip}>
          <PictureInPicture2 size={15} />
        </button>

        <button onClick={fullscreen}>
          <Maximize size={15} />
        </button>
      </div>

      {menu && (
        <div className="video-menu">
          <div className="menu-label">QUALITY</div>

          {['Original', '1080p', '720p', '480p'].map((q) => (
            <button
              key={q}
              className={quality === q ? 'selected' : ''}
              onClick={() => choose(q)}
            >
              {q}
              {q !== 'Original' && !variants[q]
                ? ' · source unavailable'
                : ''}
            </button>
          ))}

          <div className="menu-label">SPEED</div>

          {[0.75, 1, 1.25, 1.5, 2].map((x) => (
            <button
              key={x}
              className={speed === x ? 'selected' : ''}
              onClick={() => {
                setSpeed(x);
                setMenu(false);

                if (ref.current) {
                  ref.current.playbackRate = x;
                }
              }}
            >
              {x}×
            </button>
          ))}

          <div className="menu-label">VOLUME</div>

          <input
            className="range"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={setVol}
          />
        </div>
      )}
    </div>
  );
}