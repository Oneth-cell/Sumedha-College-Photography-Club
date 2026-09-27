'use client';

import {
  useEffect,
  useMemo,
  useState
} from 'react';

type GalleryItem = {
  id: number | string;
  title?: string | null;
  author?: string | null;
  media_url?: string | null;
  mediaUrl?: string | null;
  kind?: string | null;

  likes?: number | string | null;
  liked?: boolean | null;

  rating?: number | string | null;
  avgRating?: number | string | null;

  commentCount?: number | string | null;
  commentsCount?: number | string | null;

  q1080?: string | null;
  q720?: string | null;
  q480?: string | null;

  poster_url?: string | null;
  posterUrl?: string | null;
};

type GalleryComment = {
  id: number | string;
  author?: string | null;
  body: string;
  createdAt?: string | null;
};

type Props = {
  item: GalleryItem;
  index?: number;
};

/* =========================================================
   SAFE JSON RESPONSE
========================================================= */

async function readJson(
  response: Response
) {
  const text =
    await response.text().catch(
      () => ''
    );

  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export default function GalleryCard({
  item,
  index = 0
}: Props) {
  const [liked, setLiked] =
    useState(
      Boolean(item.liked)
    );

  const [likes, setLikes] =
    useState(
      Number(item.likes || 0)
    );

  const initialRating =
    Number(
      item.rating ??
        item.avgRating ??
        0
    );

  const [rating, setRating] =
    useState(
      Number.isFinite(
        initialRating
      )
        ? initialRating
        : 0
    );

  const [comments, setComments] =
    useState<GalleryComment[]>(
      []
    );

  const [
    openComments,
    setOpenComments
  ] = useState(false);

  const [
    loadingComments,
    setLoadingComments
  ] = useState(false);

  const [
    submittingComment,
    setSubmittingComment
  ] = useState(false);

  const [
    commentText,
    setCommentText
  ] = useState('');

  const [error, setError] =
    useState('');

  const [ratingBusy, setRatingBusy] =
    useState(false);

  const [likeBusy, setLikeBusy] =
    useState(false);

  const mediaUrl =
    item.media_url ||
    item.mediaUrl ||
    '';

  const poster =
    item.poster_url ||
    item.posterUrl ||
    undefined;

  const isVideo =
    String(
      item.kind || ''
    ).toLowerCase() ===
    'video';

  /* =======================================================
     LOAD COMMENTS
  ======================================================= */

  async function loadComments() {
    const willOpen =
      !openComments;

    setOpenComments(
      willOpen
    );

    if (
      !willOpen ||
      loadingComments ||
      comments.length > 0
    ) {
      return;
    }

    setLoadingComments(true);
    setError('');

    try {
      const response =
        await fetch(
          `/api/gallery/comments?mediaId=${encodeURIComponent(
            String(item.id)
          )}`,
          {
            method: 'GET',
            credentials:
              'include',
            cache: 'no-store'
          }
        );

      const data =
        await readJson(
          response
        );

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `Could not load comments (${response.status}).`
        );
      }

      setComments(
        Array.isArray(
          data?.comments
        )
          ? data.comments
          : []
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not load comments.'
      );
    } finally {
      setLoadingComments(
        false
      );
    }
  }

  /* =======================================================
     LIKE
  ======================================================= */

  async function like() {
    if (likeBusy) {
      return;
    }

    setLikeBusy(true);
    setError('');

    try {
      const response =
        await fetch(
          '/api/gallery/like',
          {
            method: 'POST',
            credentials:
              'include',
            headers: {
              'Content-Type':
                'application/json'
            },
            body:
              JSON.stringify({
                mediaId:
                  item.id
              })
          }
        );

      const data =
        await readJson(
          response
        );

      if (
        response.status ===
        401
      ) {
        setError(
          'Please sign in to like this work.'
        );
        return;
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `Could not update like (${response.status}).`
        );
      }

      setLiked(
        Boolean(
          data?.liked
        )
      );

      setLikes(
        Number(
          data?.likes ?? likes
        )
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not update like.'
      );
    } finally {
      setLikeBusy(false);
    }
  }

  /* =======================================================
     RATE
  ======================================================= */

  async function rate(
    value: number
  ) {
    if (
      ratingBusy ||
      value < 1 ||
      value > 5
    ) {
      return;
    }

    setRatingBusy(true);
    setError('');

    try {
      const response =
        await fetch(
          '/api/gallery/rating',
          {
            method: 'POST',
            credentials:
              'include',
            headers: {
              'Content-Type':
                'application/json'
            },
            body:
              JSON.stringify({
                mediaId:
                  item.id,
                rating:
                  value
              })
          }
        );

      const data =
        await readJson(
          response
        );

      if (
        response.status ===
        401
      ) {
        setError(
          'Please sign in to rate this work.'
        );
        return;
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `Could not save rating (${response.status}).`
        );
      }

      setRating(
        Number(
          data?.rating ??
            value
        )
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not save rating.'
      );
    } finally {
      setRatingBusy(
        false
      );
    }
  }

  /* =======================================================
     COMMENT
  ======================================================= */

  async function submitComment(
    e: React.FormEvent
  ) {
    e.preventDefault();

    const body =
      commentText.trim();

    if (!body) {
      return;
    }

    if (
      submittingComment
    ) {
      return;
    }

    setSubmittingComment(
      true
    );

    setError('');

    try {
      const response =
        await fetch(
          '/api/gallery/comments',
          {
            method: 'POST',
            credentials:
              'include',
            headers: {
              'Content-Type':
                'application/json'
            },
            body:
              JSON.stringify({
                mediaId:
                  item.id,
                body
              })
          }
        );

      const data =
        await readJson(
          response
        );

      if (
        response.status ===
        401
      ) {
        setError(
          'Please sign in to comment.'
        );
        return;
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `Could not post comment (${response.status}).`
        );
      }

      if (data?.comment) {
        setComments(
          prev => [
            data.comment,
            ...prev
          ]
        );
      } else {
        setComments(
          prev => [
            {
              id:
                `temp-${Date.now()}`,
              author:
                'You',
              body
            },
            ...prev
          ]
        );
      }

      setCommentText('');
      setOpenComments(
        true
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not post comment.'
      );
    } finally {
      setSubmittingComment(
        false
      );
    }
  }

  /* =======================================================
     STARS
  ======================================================= */

  const stars =
    useMemo(
      () =>
        [1, 2, 3, 4, 5],
      []
    );

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <article
      className={
        `media-card ${
          index === 0
            ? 'featured'
            : ''
        } reveal revealed`
      }
      style={{
        transitionDelay:
          `${index * 0.05}s`
      }}
    >

      {/* MEDIA */}

      <div
        style={{
          position:
            'relative',
          background:
            '#000',
          aspectRatio:
            '16 / 10',
          overflow:
            'hidden'
        }}
      >

        {mediaUrl ? (
          isVideo ? (
            <video
              src={
                mediaUrl
              }
              poster={
                poster
              }
              controls
              playsInline
              preload="metadata"
              style={{
                width:
                  '100%',
                height:
                  '100%',
                display:
                  'block',
                objectFit:
                  'cover'
              }}
            />
          ) : (
            <img
              className="media-image"
              src={
                mediaUrl
              }
              alt={
                item.title ||
                'Photography Club media'
              }
              loading="lazy"
            />
          )
        ) : (
          <div
            style={{
              width:
                '100%',
              height:
                '100%',
              minHeight:
                260,
              display:
                'grid',
              placeItems:
                'center',
              color:
                '#777',
              fontSize:
                11
            }}
          >
            Media unavailable.
          </div>
        )}

      </div>

      {/* INFO */}

      <div className="media-overlay">

        <div className="media-title">
          {
            item.title ||
            'Untitled'
          }
        </div>

        <div className="media-author">
          {item.author ||
            'Photography Club'}
        </div>

        {/* ACTIONS */}

        <div
          className="media-actions"
          style={{
            flexWrap:
              'wrap'
          }}
        >

          {/* LIKE */}

          <button
            type="button"
            className={
              `ghost-btn ${
                liked
                  ? 'active'
                  : ''
              }`
            }
            onClick={
              like
            }
            disabled={
              likeBusy
            }
          >
            {liked
              ? '♥'
              : '♡'}{' '}
            {likes}
          </button>

          {/* RATING */}

          <div
            className="rating-picker"
            style={{
              display:
                'flex',
              alignItems:
                'center',
              gap: 2
            }}
          >

            {stars.map(
              star => (
                <button
                  type="button"
                  key={
                    star
                  }
                  className={
                    star <=
                    Math.round(
                      rating
                    )
                      ? 'on'
                      : ''
                  }
                  onClick={() =>
                    rate(
                      star
                    )
                  }
                  disabled={
                    ratingBusy
                  }
                  aria-label={
                    `Rate ${star} out of 5`
                  }
                >
                  ★
                </button>
              )
            )}

          </div>

          <span
            className="soft"
            style={{
              fontSize:
                8
            }}
          >
            {rating > 0
              ? `${rating.toFixed(
                  1
                )} / 5`
              : 'No rating'}
          </span>

          {/* COMMENTS */}

          <button
            type="button"
            className="ghost-btn"
            onClick={
              loadComments
            }
          >
            💬{' '}
            {comments.length ||
              Number(
                item.commentCount ??
                  item.commentsCount ??
                  0
              )}
          </button>

        </div>

        {/* ERROR */}

        {error && (
          <div
            style={{
              marginTop:
                8,
              padding:
                '7px 9px',
              borderRadius:
                8,
              background:
                'rgba(190,80,80,.10)',
              border:
                '1px solid rgba(190,80,80,.18)',
              color:
                '#e2aaa0',
              fontSize:
                8,
              lineHeight:
                1.4
            }}
          >
            {error}
          </div>
        )}

        {/* COMMENTS */}

        {openComments && (
          <div
            className="comments"
            style={{
              marginTop:
                12
            }}
          >

            {loadingComments ? (
              <div
                className="soft"
                style={{
                  fontSize:
                    9
                }}
              >
                Loading comments…
              </div>
            ) : comments.length ? (
              <div>
                {comments.map(
                  comment => (
                    <div
                      className="comment-row"
                      key={
                        comment.id
                      }
                    >

                      <div>
                        <strong>
                          {comment.author ||
                            'Member'}
                        </strong>

                        <div
                          style={{
                            fontSize:
                              9,
                            marginTop:
                              3,
                            color:
                              '#bbb',
                            lineHeight:
                              1.5
                          }}
                        >
                          {
                            comment.body
                          }
                        </div>

                        {comment.createdAt && (
                          <small>
                            {new Date(
                              comment.createdAt
                            ).toLocaleString()}
                          </small>
                        )}
                      </div>

                    </div>
                  )
                )}
              </div>
            ) : (
              <div
                className="soft"
                style={{
                  fontSize:
                    9
                }}
              >
                No comments yet.
              </div>
            )}

            {/* COMMENT FORM */}

            <form
              className="comment-form"
              onSubmit={
                submitComment
              }
            >

              <input
                value={
                  commentText
                }
                onChange={e =>
                  setCommentText(
                    e.target.value
                  )
                }
                placeholder="Write a comment…"
                className="input"
                maxLength={
                  1000
                }
              />

              <button
                type="submit"
                className="tiny-btn gold"
                disabled={
                  submittingComment
                }
              >
                {submittingComment
                  ? '...'
                  : 'Post'}
              </button>

            </form>

          </div>
        )}

      </div>

    </article>
  );
}