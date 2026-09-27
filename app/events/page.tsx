import { getHomeData } from '@/lib/data';
import Reveal from '@/components/Reveal';
import Link from 'next/link';
import { CalendarDays, ArrowUpRight } from 'lucide-react';

export default async function Events() {
  const data = await getHomeData();

  return (
    <main className="page">
      <div className="container">
        <Reveal>
          <div className="section-head">
            <div>
              <div className="kicker">Archive / Events</div>

              <h2>
                Every event
                <br />
                becomes a story.
              </h2>
            </div>

            <p>
              Trailers, after movies, albums and approved
              photographs from club productions.
            </p>
          </div>
        </Reveal>

        <div className="grid-2">
          {(data.events as any[]).map(
            (e: any, i: number) => (
              <Reveal
                key={e.id}
                delay={i * 0.06}
              >
                <article
                  className="card card-pad"
                  style={{
                    minHeight: 280,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    background: e.coverUrl
                      ? `linear-gradient(#0008,#000b),url(${e.coverUrl}) center/cover`
                      : 'linear-gradient(145deg,#171717,#0c0c0c)',
                  }}
                >
                  <div>
                    <span className="pill">
                      <CalendarDays size={12} />
                      {e.date}
                    </span>

                    <h3
                      style={{
                        fontSize: 29,
                        margin: '14px 0 6px',
                      }}
                    >
                      {e.title}
                    </h3>

                    <div
                      className="soft"
                      style={{
                        fontSize: 11,
                      }}
                    >
                      {e.location} · {e.description}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: 7,
                      flexWrap: 'wrap',
                    }}
                  >
                    {e.trailerUrl && (
                      <Link
                        href={e.trailerUrl}
                        target="_blank"
                        className="btn"
                      >
                        Trailer ↗
                      </Link>
                    )}

                    {e.aftermovieUrl && (
                      <Link
                        href={e.aftermovieUrl}
                        target="_blank"
                        className="btn"
                      >
                        After Movie ↗
                      </Link>
                    )}

                    {e.albumUrl && (
                      <Link
                        href={e.albumUrl}
                        target="_blank"
                        className="btn primary"
                      >
                        Album
                        <ArrowUpRight size={13} />
                      </Link>
                    )}
                  </div>
                </article>
              </Reveal>
            )
          )}

          {!(data.events as any[]).length && (
            <div className="notice">
              No events published yet.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}