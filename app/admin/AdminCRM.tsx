'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  Users,
  Image as ImageIcon,
  CalendarDays,
  ClipboardCheck,
  MessageCircle,
  Send,
  Trash2,
  EyeOff,
  Check,
  Plus,
  Settings,
  LayoutDashboard,
  Video,
  Globe,
  ShieldCheck
} from 'lucide-react';

type Tab =
  | 'overview'
  | 'members'
  | 'media'
  | 'tasks'
  | 'meetings'
  | 'events'
  | 'community'
  | 'chat'
  | 'board'
  | 'settings';

/* =========================================================
   API HELPER
========================================================= */

async function api(
  url: string,
  opts: RequestInit = {}
) {
  const r = await fetch(url, {
    ...opts,
    credentials: 'include'
  });

  const contentType =
    r.headers.get('content-type') || '';

  let d: any = {};

  if (
    contentType.includes(
      'application/json'
    )
  ) {
    d =
      await r.json().catch(
        () => ({})
      );
  } else {
    const text =
      await r.text().catch(
        () => ''
      );

    if (!r.ok) {
      throw new Error(
        text ||
          `Request failed (${r.status})`
      );
    }

    d = {};
  }

  if (!r.ok) {
    throw new Error(
      d?.error ||
        `Request failed (${r.status})`
    );
  }

  return d;
}

export default function AdminCRM() {
  const [tab, setTab] =
    useState<Tab>('overview');

  const [msg, setMsg] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [data, setData] =
    useState<any>({});

  /* =========================
     TASK
  ========================= */

  const [task, setTask] =
    useState({
      title: '',
      description: '',
      dueDate: '',
      uploadType: 'photo'
    });

  /* =========================
     MEETING
  ========================= */

  const [meeting, setMeeting] =
    useState({
      title: '',
      startTime: '',
      zoomUrl: '',
      agenda: ''
    });

  /* =========================
     EVENT
  ========================= */

  const [event, setEvent] =
    useState({
      title: '',
      date: '',
      location: '',
      description: '',
      trailerUrl: '',
      aftermovieUrl: '',
      albumUrl: '',
      coverUrl: ''
    });

  /* =========================
     ANNOUNCEMENT
  ========================= */

  const [announcement, setAnnouncement] =
    useState({
      title: '',
      body: ''
    });

  /* =========================
     BOARD
  ========================= */

  const [board, setBoard] =
    useState({
      position: '',
      personName: '',
      userId: '',
      displayOrder: '1'
    });

  /* =========================
     SETTINGS
  ========================= */

  const [setting, setSetting] =
    useState({
      key: 'instagram_url',
      value: 'https://instagram.com/'
    });

  /* =========================
     CHAT
  ========================= */

  const [chatThread, setChatThread] =
    useState<number | null>(null);

  const [chatText, setChatText] =
    useState('');

  /* =========================
     TABS
  ========================= */

  const tabs: [Tab, string, any][] = [
    [
      'overview',
      'Overview',
      LayoutDashboard
    ],
    [
      'members',
      'Members',
      Users
    ],
    [
      'media',
      'Media',
      ImageIcon
    ],
    [
      'tasks',
      'Tasks',
      ClipboardCheck
    ],
    [
      'meetings',
      'Meetings',
      CalendarDays
    ],
    [
      'events',
      'Events',
      Video
    ],
    [
      'community',
      'Community',
      Globe
    ],
    [
      'chat',
      'Admin Chat',
      MessageCircle
    ],
    [
      'board',
      'Board',
      ShieldCheck
    ],
    [
      'settings',
      'Settings',
      Settings
    ]
  ];

  /* =========================
     LOAD CRM DATA
  ========================= */

  async function load() {
    setLoading(true);

    const defaults = {
      metrics: {
        pendingRequests: 0,
        pendingMedia: 0,
        openChats: 0,
        students: 0,
        weeklyBest: 0
      },
      requests: [],
      users: [],
      submissions: [],
      files: [],
      tasks: [],
      meetings: [],
      events: [],
      comments: [],
      subs: [],
      threads: [],
      messages: [],
      announcements: [],
      board: [],
      settings: []
    };

    const endpoints = [
      [
        'dashboard',
        '/api/admin/dashboard'
      ],
      [
        'requests',
        '/api/admin/requests'
      ],
      [
        'users',
        '/api/admin/users'
      ],
      [
        'media',
        '/api/admin/media'
      ],
      [
        'tasks',
        '/api/admin/tasks'
      ],
      [
        'meetings',
        '/api/admin/meetings'
      ],
      [
        'events',
        '/api/admin/events'
      ],
      [
        'comments',
        '/api/admin/comments'
      ],
      [
        'subs',
        '/api/admin/subscribers'
      ],
      [
        'chat',
        '/api/admin/chat'
      ],
      [
        'announcements',
        '/api/admin/announcements'
      ],
      [
        'board',
        '/api/admin/board'
      ],
      [
        'settings',
        '/api/admin/settings'
      ]
    ] as const;

    const results =
      await Promise.allSettled(
        endpoints.map(
          ([, url]) =>
            api(url)
        )
      );

    const failures: string[] = [];

    const get = (i: number) => {
      const r = results[i];

      if (
        r.status ===
        'fulfilled'
      ) {
        return r.value;
      }

      failures.push(
        endpoints[i][0]
      );

      return null;
    };

    const dashboard = get(0);
    const requests = get(1);
    const users = get(2);
    const media = get(3);
    const tasks = get(4);
    const meetings = get(5);
    const events = get(6);
    const comments = get(7);
    const subs = get(8);
    const chat = get(9);
    const announcements = get(10);
    const board = get(11);
    const settings = get(12);

    setData({
      metrics:
        dashboard?.metrics ??
        defaults.metrics,

      requests:
        requests?.requests ??
        defaults.requests,

      users:
        users?.users ??
        defaults.users,

      submissions:
        media?.submissions ??
        defaults.submissions,

      files:
        media?.files ??
        defaults.files,

      tasks:
        tasks?.tasks ??
        defaults.tasks,

      meetings:
        meetings?.meetings ??
        defaults.meetings,

      events:
        events?.events ??
        defaults.events,

      comments:
        comments?.comments ??
        defaults.comments,

      subs:
        subs?.subscribers ??
        defaults.subs,

      threads:
        chat?.threads ??
        defaults.threads,

      messages:
        chat?.messages ??
        defaults.messages,

      announcements:
        announcements?.announcements ??
        defaults.announcements,

      board:
        board?.board ??
        defaults.board,

      settings:
        settings?.settings ??
        defaults.settings
    });

    setMsg(
      failures.length
        ? `Some admin sections could not load: ${failures.join(
            ', '
          )}`
        : ''
    );

    setLoading(false);
  }

  /* =========================
     INITIAL LOAD
  ========================= */

  useEffect(() => {
    load();
  }, []);

  /* =========================
     ACTION WRAPPER
  ========================= */

  async function act(
    fn: () => Promise<any>,
    success: string
  ) {
    try {
      await fn();

      setMsg(success);

      await load();
    } catch (e: any) {
      setMsg(
        e?.message ||
          'Something went wrong.'
      );
    }
  }

  /* =========================
     MEMBER APPROVE / REJECT
  ========================= */

  async function memberAction(
    id: number,
    action: string
  ) {
    let reason = '';

    if (
      action === 'reject'
    ) {
      const entered =
        window.prompt(
          'Enter the reason for rejecting this registration:'
        );

      if (entered === null) {
        return;
      }

      reason =
        entered.trim();
    }

    await act(
      () =>
        api(
          '/api/admin/requests',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json'
            },
            body:
              JSON.stringify({
                id,
                action,
                reason
              })
          }
        ),
      action === 'approve'
        ? 'Member approved.'
        : 'Request rejected.'
    );
  }

  /* =========================
     UPDATE USER
  ========================= */

  async function updateUser(
    u: any
  ) {
    await act(
      () =>
        api(
          '/api/admin/users',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json'
            },
            body:
              JSON.stringify({
                id: u.id,

                status:
                  u.status,

                membershipType:
                  u.membershipType ??
                  u.membership_type ??
                  'member',

                boardPosition:
                  u.boardPosition ??
                  ''
              })
          }
        ),
      'Member record updated.'
    );
  }

  /* =========================
     DELETE USER
  ========================= */

  async function deleteUser(
    id: number
  ) {
    if (
      !window.confirm(
        'Are you sure you want to permanently delete this user? This action cannot be undone.'
      )
    ) {
      return;
    }

    await act(
      () =>
        api(
          '/api/admin/users',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json'
            },
            body:
              JSON.stringify({
                id,
                action: 'delete'
              })
          }
        ),
      'User deleted successfully.'
    );
  }

  /* =========================
     MEDIA
  ========================= */

  async function mediaAction(
    action: string,
    ids: any
  ) {
    if (
      action ===
        'delete_media' &&
      !window.confirm(
        'Delete this media permanently? This removes the media record and its stored file.'
      )
    ) {
      return;
    }

    if (
      action ===
        'media_status' &&
      ids?.status ===
        'rejected' &&
      !window.confirm(
        'Reject this individual media file?'
      )
    ) {
      return;
    }

    let success =
      'Media action completed.';

    if (
      action ===
        'media_status'
    ) {
      success =
        ids?.status ===
        'approved'
          ? 'Media approved.'
          : 'Media rejected.';
    } else if (
      action ===
      'weekly_best'
    ) {
      success =
        'Weekly Best updated.';
    } else if (
      action ===
      'delete_media'
    ) {
      success =
        'Media deleted.';
    } else if (
      action.includes(
        'reject'
      )
    ) {
      success =
        'Submission rejected.';
    } else if (
      action.includes(
        'approve'
      )
    ) {
      success =
        'Submission approved.';
    }

    await act(
      () =>
        api(
          '/api/admin/media',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json'
            },
            body:
              JSON.stringify({
                ...ids,
                action
              })
          }
        ),
      success
    );
  }

  /* =========================
     GENERIC POST
  ========================= */

  async function post(
    url: string,
    payload: any,
    text: string
  ) {
    await act(
      () =>
        api(
          url,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json'
            },
            body:
              JSON.stringify(
                payload
              )
          }
        ),
      text
    );
  }

  /* =========================
     CHAT MESSAGES
  ========================= */

  const messagesFor =
    useMemo(
      () =>
        chatThread
          ? data.messages?.filter(
              (m: any) =>
                Number(
                  m.threadId
                ) ===
                Number(
                  chatThread
                )
            ) || []
          : [],
      [
        data.messages,
        chatThread
      ]
    );

  /* =========================
     LOADING
  ========================= */

  if (loading) {
    return (
      <main className="page">
        <div className="container">
          <div className="notice">
            Loading Admin CRM…
          </div>
        </div>
      </main>
    );
  }

  /* =========================
     CRM
  ========================= */

  return (
    <main className="page">

      <div className="crm-shell">

        {/* SIDEBAR */}

        <aside className="crm-side">

          <div className="brand-wrap">
            <img
              src="/logo-white.png"
              className="site-logo"
              alt="Sumedha College Photography Club"
            />
          </div>

          <nav className="crm-nav">

            {tabs.map(
              ([
                k,
                label,
                Icon
              ]) => (
                <a
                  key={k}
                  className={
                    tab === k
                      ? 'active'
                      : ''
                  }
                  href={`#${k}`}
                  onClick={e => {
                    e.preventDefault();
                    setTab(k);
                  }}
                >
                  <Icon size={15} />
                  <span>
                    {label}
                  </span>
                </a>
              )
            )}

          </nav>

          <div
            style={{
              position:
                'absolute',
              bottom: 14,
              left: 14,
              right: 14,
              fontSize: 8,
              color: '#5f5a54'
            }}
          >

            <button
              type="button"
              className="tiny-btn"
              style={{
                width: '100%'
              }}
              onClick={async () => {
                await fetch(
                  '/api/auth/logout',
                  {
                    method:
                      'POST'
                  }
                );

                location.href =
                  '/';
              }}
            >
              Sign out
            </button>

          </div>

        </aside>

        {/* MAIN */}

        <div className="crm-main">

          {/* HEADER */}

          <div className="section-head">

            <div>

              <div className="kicker">
                Control room
              </div>

              <h2>
                Run the club.
              </h2>

              <p
                style={{
                  marginTop: 12
                }}
              >
                Every operational button
                on this screen is
                connected to a protected
                API and PostgreSQL.
              </p>

            </div>

            <div
              style={{
                textAlign:
                  'right'
              }}
            >

              {msg && (
                <div
                  className="notice"
                  style={{
                    marginBottom: 9
                  }}
                >
                  {msg}
                </div>
              )}

              <button
                type="button"
                className="btn"
                onClick={
                  load
                }
              >
                Refresh data
              </button>

            </div>

          </div>

          {/* OVERVIEW */}

          {tab ===
            'overview' && (
            <Overview
              metrics={
                data.metrics
              }
              onTab={setTab}
            />
          )}

          {/* MEMBERS */}

          {tab ===
            'members' && (
            <Members
              requests={
                data.requests
              }
              users={
                data.users
              }
              memberAction={
                memberAction
              }
              updateUser={
                updateUser
              }
              deleteUser={
                deleteUser
              }
            />
          )}

          {/* MEDIA */}

          {tab ===
            'media' && (
            <Media
              submissions={
                data.submissions
              }
              files={
                data.files
              }
              mediaAction={
                mediaAction
              }
            />
          )}

          {/* TASKS */}

          {tab === 'tasks' && (
            <Tasks
              task={task}
              setTask={setTask}
              tasks={data.tasks}
              post={post}
              act={act}
            />
          )}

          {/* MEETINGS */}

          {tab ===
            'meetings' && (
            <Meetings
              meeting={meeting}
              setMeeting={
                setMeeting
              }
              meetings={
                data.meetings
              }
              post={post}
            />
          )}

          {/* EVENTS */}

          {tab === 'events' && (
            <Events
              event={event}
              setEvent={setEvent}
              events={
                data.events
              }
              post={post}
            />
          )}

          {/* COMMUNITY */}

          {tab ===
            'community' && (
            <Community
              comments={
                data.comments
              }
              subs={data.subs}
              announcements={
                data.announcements
              }
              announcement={
                announcement
              }
              setAnnouncement={
                setAnnouncement
              }
              post={post}
              act={act}
            />
          )}

          {/* CHAT */}

          {tab === 'chat' && (
            <Chat
              threads={
                data.threads
              }
              messages={
                messagesFor
              }
              selected={
                chatThread
              }
              setSelected={
                setChatThread
              }
              text={
                chatText
              }
              setText={
                setChatText
              }
              post={post}
            />
          )}

          {/* BOARD */}

          {tab === 'board' && (
            <Board
              board={data.board}
              users={data.users}
              boardForm={
                board
              }
              setBoardForm={
                setBoard
              }
              post={post}
              act={act}
            />
          )}

          {/* SETTINGS */}

          {tab ===
            'settings' && (
            <SettingsPanel
              settings={
                data.settings
              }
              setting={setting}
              setSetting={
                setSetting
              }
              post={post}
            />
          )}

        </div>

      </div>

    </main>
  );
}


/* =========================================================
   OVERVIEW
========================================================= */

function Overview({
  metrics,
  onTab
}: {
  metrics: any;
  onTab: (x: Tab) => void;
}) {
  const cards = [
    [
      'Pending requests',
      metrics?.pendingRequests ??
        0,
      'members'
    ],
    [
      'Pending media',
      metrics?.pendingMedia ??
        0,
      'media'
    ],
    [
      'Open chats',
      metrics?.openChats ?? 0,
      'chat'
    ],
    [
      'Approved students',
      metrics?.students ?? 0,
      'members'
    ],
    [
      'Weekly Best',
      metrics?.weeklyBest ??
        0,
      'media'
    ]
  ];

  return (
    <>
      <div className="grid-3">

        {cards.map(
          ([label, n, t]) => (
            <button
              type="button"
              key={String(
                label
              )}
              className="card card-pad"
              style={{
                textAlign:
                  'left',
                cursor:
                  'pointer'
              }}
              onClick={() =>
                onTab(
                  t as Tab
                )
              }
            >

              <div className="kicker">
                {label}
              </div>

              <div
                style={{
                  font:
                    '700 34px Space Grotesk',
                  marginTop: 15,
                  color: '#fff'
                }}
              >
                {n}
              </div>

              <div
                className="soft"
                style={{
                  fontSize: 9,
                  marginTop: 5
                }}
              >
                Open module →
              </div>

            </button>
          )
        )}

      </div>

      <div
        className="grid-2 section"
        style={{
          paddingTop: 35
        }}
      >

        <div className="card card-pad">

          <div className="kicker">
            Workflow
          </div>

          <h3>
            One CRM, all club operations.
          </h3>

          <p
            className="soft"
            style={{
              fontSize: 10,
              lineHeight: 1.7
            }}
          >
            Membership approval,
            member role/Board position,
            media moderation, task
            creation, meetings, events,
            comments, subscribers,
            support chat, announcements,
            board roster and social
            settings.
          </p>

        </div>

        <div className="card card-pad">

          <div className="kicker">
            Permissions
          </div>

          <h3>
            Admin-only controls.
          </h3>

          <p
            className="soft"
            style={{
              fontSize: 10,
              lineHeight: 1.7
            }}
          >
            The server checks the
            signed session for every
            /api/admin route. Students
            cannot assign themselves
            Board status, approve media
            or publish LMS content.
          </p>

        </div>

      </div>
    </>
  );
}


/* =========================================================
   MEMBERS
========================================================= */

function Members({
  requests,
  users,
  memberAction,
  updateUser,
  deleteUser
}: {
  requests: any[];
  users: any[];
  memberAction: (
    id: number,
    a: string
  ) => void;
  updateUser: (
    u: any
  ) => void;
  deleteUser: (
    id: number
  ) => Promise<void>;
}) {
  const [
    localUsers,
    setLocalUsers
  ] = useState<any[]>(
    users
  );

  useEffect(() => {
    setLocalUsers(users);
  }, [users]);

  function changeUser(
    id: number,
    field: string,
    value: string
  ) {
    setLocalUsers(
      prev =>
        prev.map(
          user =>
            user.id === id
              ? {
                  ...user,
                  [field]:
                    value
                }
              : user
        )
    );
  }

  function value(
    obj: any,
    ...keys: string[]
  ) {
    for (const key of keys) {
      if (
        obj?.[key] !==
          undefined &&
        obj?.[key] !== null &&
        String(
          obj[key]
        ).trim() !== ''
      ) {
        return String(
          obj[key]
        );
      }
    }

    return 'Not provided';
  }

  function profileImage(
    user: any
  ) {
    const path =
      value(
        user,
        'pfp_url',
        'pfp_path',
        'profilePicture',
        'profile_picture'
      );

    if (
      path ===
      'Not provided'
    ) {
      return '';
    }

    return path;
  }

  function studentName(
    user: any
  ) {
    return value(
      user,
      'full_name',
      'fullName',
      'student_name',
      'name'
    );
  }

  function surname(
    user: any
  ) {
    return value(
      user,
      'surname'
    );
  }

  return (
    <div className="grid-2">

      {/* REGISTRATION QUEUE */}

      <section className="card card-pad">

        <div className="kicker">
          Registration queue
        </div>

        <h3>
          Approve students.
        </h3>

        <p
          className="soft"
          style={{
            fontSize: 9,
            lineHeight: 1.6,
            marginBottom: 18
          }}
        >
          Complete student
          registration information
          is shown here. Passwords are
          never displayed.
        </p>

        {requests.map(
          (r: any) => (
            <div
              className="admin-row"
              key={r.id}
              style={{
                alignItems:
                  'flex-start',
                flexDirection:
                  'column',
                gap: 14
              }}
            >

              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems:
                    'flex-start',
                  gap: 15
                }}
              >

                <div
                  style={{
                    display:
                      'flex',
                    gap: 12,
                    alignItems:
                      'flex-start'
                  }}
                >

                  {profileImage(
                    r
                  ) ? (
                    <img
                      src={profileImage(
                        r
                      )}
                      alt={studentName(
                        r
                      )}
                      style={{
                        width: 52,
                        height: 52,
                        objectFit:
                          'cover',
                        borderRadius: 10,
                        border:
                          '1px solid rgba(255,255,255,.10)'
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 10,
                        border:
                          '1px solid rgba(255,255,255,.10)',
                        display:
                          'flex',
                        alignItems:
                          'center',
                        justifyContent:
                          'center',
                        fontSize: 18,
                        background:
                          'rgba(255,255,255,.03)'
                      }}
                    >
                      👤
                    </div>
                  )}

                  <div>

                    <strong
                      style={{
                        fontSize: 12,
                        color: '#fff'
                      }}
                    >
                      {studentName(
                        r
                      )}

                      {surname(
                        r
                      ) !==
                      'Not provided'
                        ? ` ${surname(
                            r
                          )}`
                        : ''}
                    </strong>

                    <div
                      className="soft"
                      style={{
                        fontSize: 8,
                        marginTop: 4
                      }}
                    >
                      Registration ID:{' '}
                      {r.id}
                    </div>

                  </div>

                </div>

                <div
                  className="action-row"
                  style={{
                    flexShrink: 0
                  }}
                >

                  <button
                    type="button"
                    className="tiny-btn gold"
                    onClick={() =>
                      memberAction(
                        Number(
                          r.id
                        ),
                        'approve'
                      )
                    }
                  >
                    <Check
                      size={
                        10
                      }
                    />
                    Approve
                  </button>

                  <button
                    type="button"
                    className="tiny-btn danger"
                    onClick={() =>
                      memberAction(
                        Number(
                          r.id
                        ),
                        'reject'
                      )
                    }
                  >
                    Reject
                  </button>

                </div>

              </div>

              <div
                style={{
                  width:
                    '100%',
                  display:
                    'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit,minmax(180px,1fr))',
                  gap: 10
                }}
              >

                {[
                  [
                    'Full name',
                    studentName(
                      r
                    )
                  ],
                  [
                    'Surname',
                    surname(
                      r
                    )
                  ],
                  [
                    'Student ID',
                    value(
                      r,
                      'student_id',
                      'studentId'
                    )
                  ],
                  [
                    'Grade',
                    value(
                      r,
                      'grade',
                      'student_grade',
                      'grade_name'
                    )
                  ],
                  [
                    'Class',
                    value(
                      r,
                      'class_name',
                      'className',
                      'class',
                      'student_class'
                    )
                  ],
                  [
                    'Parent / Guardian phone',
                    value(
                      r,
                      'parent_phone',
                      'parentPhone',
                      'parent_guardian_phone',
                      'guardian_phone'
                    )
                  ],
                  [
                    'Email',
                    value(
                      r,
                      'email'
                    )
                  ],
                  [
                    'Address',
                    value(
                      r,
                      'address',
                      'home_address'
                    )
                  ],
                  [
                    'Status',
                    value(
                      r,
                      'status'
                    )
                  ],
                  [
                    'Membership type',
                    value(
                      r,
                      'membership_type',
                      'membershipType'
                    )
                  ]
                ].map(
                  ([
                    label,
                    item
                  ]) => (
                    <div
                      key={
                        label
                      }
                      className="card"
                      style={{
                        padding:
                          10
                      }}
                    >
                      <div className="kicker">
                        {
                          label
                        }
                      </div>

                      <div
                        style={{
                          fontSize:
                            10,
                          marginTop:
                            5,
                          lineHeight:
                            1.5,
                          wordBreak:
                            label ===
                            'Email'
                              ? 'break-word'
                              : undefined
                        }}
                      >
                        {
                          item
                        }
                      </div>
                    </div>
                  )
                )}

              </div>

              <div
                style={{
                  width:
                    '100%',
                  padding:
                    '9px 11px',
                  borderRadius: 8,
                  background:
                    'rgba(255,255,255,.025)',
                  border:
                    '1px solid rgba(255,255,255,.06)',
                  fontSize: 8,
                  color: '#777'
                }}
              >
                🔒 Password: protected
                and never displayed.
              </div>

            </div>
          )
        )}

        {!requests.length && (
          <p
            className="soft"
            style={{
              fontSize: 10
            }}
          >
            No pending requests.
          </p>
        )}

      </section>

      {/* MEMBER DIRECTORY */}

      <section className="card card-pad">

        <div className="kicker">
          Member directory
        </div>

        <h3>
          Membership + Board.
        </h3>

        <div className="table-wrap">

          <table className="table">

            <thead>
              <tr>
                <th>Student</th>
                <th>Student ID</th>
                <th>Grade</th>
                <th>Class</th>
                <th>Parent Phone</th>
                <th>Status</th>
                <th>Type</th>
                <th>Position</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>

              {localUsers
                .filter(
                  (u: any) =>
                    u.role ===
                    'student'
                )
                .slice(0, 100)
                .map(
                  (u: any) => (
                    <tr
                      key={
                        u.id
                      }
                    >

                      <td>
                        <strong>
                          {studentName(
                            u
                          )}
                        </strong>

                        <br />

                        <small>
                          {surname(
                            u
                          )}
                        </small>

                        <br />

                        <small>
                          {value(
                            u,
                            'email'
                          )}
                        </small>
                      </td>

                      <td>
                        {value(
                          u,
                          'student_id',
                          'studentId'
                        )}
                      </td>

                      <td>
                        {value(
                          u,
                          'grade',
                          'student_grade'
                        )}
                      </td>

                      <td>
                        {value(
                          u,
                          'class_name',
                          'className',
                          'class'
                        )}
                      </td>

                      <td>
                        {value(
                          u,
                          'parent_phone',
                          'parentPhone',
                          'parent_guardian_phone',
                          'guardian_phone'
                        )}
                      </td>

                      <td>

                        <select
                          className="input"
                          value={
                            u.status ||
                            ''
                          }
                          onChange={e =>
                            changeUser(
                              u.id,
                              'status',
                              e.target
                                .value
                            )
                          }
                        >

                          <option value="approved">
                            approved
                          </option>

                          <option value="suspended">
                            suspended
                          </option>

                          <option value="rejected">
                            rejected
                          </option>

                        </select>

                      </td>

                      <td>

                        <select
                          className="input"
                          value={
                            u.membershipType ||
                            u.membership_type ||
                            'member'
                          }
                          onChange={e =>
                            changeUser(
                              u.id,
                              'membershipType',
                              e.target
                                .value
                            )
                          }
                        >

                          <option value="member">
                            Member
                          </option>

                          <option value="board">
                            Board
                          </option>

                        </select>

                      </td>

                      <td>

                        <input
                          className="input"
                          type="text"
                          value={
                            u.boardPosition ||
                            ''
                          }
                          placeholder="Position"
                          autoComplete="off"
                          onChange={e =>
                            changeUser(
                              u.id,
                              'boardPosition',
                              e.target
                                .value
                            )
                          }
                        />

                      </td>

                      <td>

                        <div className="action-row">

                          <button
                            type="button"
                            className="tiny-btn gold"
                            onClick={() =>
                              updateUser(
                                u
                              )
                            }
                          >
                            Save
                          </button>

                          <button
                            type="button"
                            className="tiny-btn danger"
                            onClick={() =>
                              deleteUser(
                                Number(
                                  u.id
                                )
                              )
                            }
                          >
                            <Trash2
                              size={
                                10
                              }
                            />
                            Delete
                          </button>

                        </div>

                      </td>

                    </tr>
                  )
                )}

            </tbody>

          </table>

        </div>

      </section>

    </div>
  );
}


/* =========================================================
   MEDIA
========================================================= */

function Media({
  submissions,
  files,
  mediaAction
}: {
  submissions: any[];
  files: any[];
  mediaAction: (
    a: string,
    ids: any
  ) => void;
}) {
  function isVideo(
    file: any
  ) {
    return (
      String(
        file.kind || ''
      ).toLowerCase() ===
      'video'
    );
  }

  function isImage(
    file: any
  ) {
    return (
      String(
        file.kind || ''
      ).toLowerCase() ===
      'image'
    );
  }

  function downloadUrl(
    id: any
  ) {
    return `/api/admin/media/download?mediaId=${encodeURIComponent(
      String(id)
    )}`;
  }

  function submissionFiles(
    submissionId: any
  ) {
    return files.filter(
      (f: any) =>
        Number(
          f.submissionId
        ) ===
        Number(
          submissionId
        )
    );
  }

  /* =======================================================
     PREVIEW
  ======================================================= */

  function Preview({
    file
  }: {
    file: any;
  }) {
    if (!file?.mediaUrl) {
      return (
        <div
          style={{
            width:
              '100%',
            height:
              '100%',
            display:
              'flex',
            alignItems:
              'center',
            justifyContent:
              'center',
            color: '#777',
            fontSize: 10,
            padding: 12,
            textAlign:
              'center'
          }}
        >
          Media URL unavailable.
        </div>
      );
    }

    if (
      isVideo(file)
    ) {
      return (
        <video
          src={
            file.mediaUrl
          }
          controls
          preload="metadata"
          playsInline
          style={{
            width:
              '100%',
            height:
              '100%',
            display:
              'block',
            objectFit:
              'cover',
            background:
              '#000'
          }}
        />
      );
    }

    if (
      isImage(file)
    ) {
      return (
        <img
          src={
            file.mediaUrl
          }
          alt={
            file.title ||
            'Media preview'
          }
          loading="lazy"
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
      );
    }

    return (
      <div
        style={{
          width:
            '100%',
          height:
            '100%',
          display:
            'flex',
          alignItems:
            'center',
          justifyContent:
            'center',
          color: '#999',
          fontSize: 11,
          padding: 12,
          textAlign:
            'center'
        }}
      >
        Unsupported preview type.
      </div>
    );
  }

  /* =======================================================
     FILE CARD
  ======================================================= */

  function FileCard({
    file,
    showBest = false,
    moderation = false
  }: {
    file: any;
    showBest?: boolean;
    moderation?: boolean;
  }) {
    const status =
      String(
        file.status ||
          'pending'
      ).toLowerCase();

    return (
      <div
        style={{
          border:
            '1px solid rgba(255,255,255,.08)',
          borderRadius:
            12,
          overflow:
            'hidden',
          background:
            'rgba(255,255,255,.025)'
        }}
      >

        {/* PREVIEW */}

        <div
          style={{
            aspectRatio:
              '16 / 10',
            background:
              '#101010',
            overflow:
              'hidden'
          }}
        >

          <Preview
            file={
              file
            }
          />

        </div>

        {/* DETAILS */}

        <div
          style={{
            padding:
              10
          }}
        >

          <div
            style={{
              display:
                'flex',
              justifyContent:
                'space-between',
              gap: 8,
              alignItems:
                'flex-start'
            }}
          >

            <strong
              style={{
                fontSize:
                  10,
                lineHeight:
                  1.3,
                overflow:
                  'hidden',
                textOverflow:
                  'ellipsis'
              }}
            >
              {file.title ||
                'Untitled media'}
            </strong>

            <span
              className={
                `status ${
                  status
                }`
              }
              style={{
                fontSize:
                  8,
                flexShrink:
                  0
              }}
            >
              {status.toUpperCase()}
            </span>

          </div>

          <div
            className="soft"
            style={{
              fontSize:
                8,
              marginTop:
                5
            }}
          >
            {String(
              file.kind ||
                ''
            ).toUpperCase()}

            {' · '}

            {file.author ||
              'Unknown author'}
          </div>

          {file.description && (
            <div
              className="soft"
              style={{
                fontSize:
                  8,
                marginTop:
                  6,
                lineHeight:
                  1.4
              }}
            >
              {
                file.description
              }
            </div>
          )}

          {/* ACTIONS */}

          <div
            className="action-row"
            style={{
              marginTop:
                10,
              flexWrap:
                'wrap'
            }}
          >

            {/* OPEN */}

            {file.mediaUrl && (
              <a
                className="tiny-btn"
                href={
                  file.mediaUrl
                }
                target="_blank"
                rel="noreferrer"
              >
                Open
              </a>
            )}

            {/* DOWNLOAD */}

            <a
              className="tiny-btn"
              href={downloadUrl(
                file.id
              )}
            >
              Download
            </a>

            {/* INDIVIDUAL APPROVAL */}

            {moderation &&
              status ===
                'pending' && (
                <>
                  <button
                    type="button"
                    className="tiny-btn gold"
                    onClick={() =>
                      mediaAction(
                        'media_status',
                        {
                          mediaId:
                            file.id,
                          status:
                            'approved'
                        }
                      )
                    }
                  >
                    <Check
                      size={
                        10
                      }
                    />
                    Approve
                  </button>

                  <button
                    type="button"
                    className="tiny-btn danger"
                    onClick={() =>
                      mediaAction(
                        'media_status',
                        {
                          mediaId:
                            file.id,
                          status:
                            'rejected'
                        }
                      )
                    }
                  >
                    Reject
                  </button>
                </>
              )}

            {/* WEEKLY BEST */}

            {showBest &&
              status ===
                'approved' && (
                <button
                  type="button"
                  className={
                    `tiny-btn ${
                      file.weeklyBest
                        ? 'gold'
                        : ''
                    }`
                  }
                  onClick={() =>
                    mediaAction(
                      'weekly_best',
                      {
                        mediaId:
                          file.id,
                        weeklyBest:
                          !Boolean(
                            file.weeklyBest
                          )
                      }
                    )
                  }
                >
                  {file.weeklyBest
                    ? '★ Weekly Best'
                    : 'Weekly Best'}
                </button>
              )}

            {/* DELETE */}

            <button
              type="button"
              className="tiny-btn danger"
              onClick={() =>
                mediaAction(
                  'delete_media',
                  {
                    mediaId:
                      file.id
                  }
                )
              }
            >
              <Trash2
                size={
                  10
                }
              />
              Delete
            </button>

          </div>

        </div>

      </div>
    );
  }

  /* =======================================================
     PENDING SUBMISSIONS
  ======================================================= */

  const pendingSubmissionRows =
    submissions
      .map((s: any) => {
        const all =
          submissionFiles(
            s.id
          );

        const pending =
          all.filter(
            (f: any) =>
              String(
                f.status ||
                  'pending'
              ).toLowerCase() ===
              'pending'
          );

        return {
          submission:
            s,
          files:
            pending
        };
      })
      .filter(
        row =>
          row.files.length >
          0
      );

  const approvedFiles =
    files.filter(
      (f: any) =>
        String(
          f.status || ''
        ).toLowerCase() ===
        'approved'
    );

  const rejectedFiles =
    files.filter(
      (f: any) =>
        String(
          f.status || ''
        ).toLowerCase() ===
        'rejected'
    );

  const pendingFiles =
    files.filter(
      (f: any) =>
        String(
          f.status ||
            'pending'
        ).toLowerCase() ===
        'pending'
    );

  return (
    <section className="card card-pad">

      <div className="kicker">
        Media moderation
      </div>

      <h3>
        Review student submissions.
      </h3>

      <p
        className="soft"
        style={{
          fontSize:
            10,
          lineHeight:
            1.6
        }}
      >
        ZIP max 5 GB · each
        photo &lt;50 MB · each
        video ≤4 GB · description
        required. Each photo or
        video is reviewed separately
        before publication.
      </p>

      {/* ===================================================
          PENDING
      =================================================== */}

      <div
        style={{
          marginTop:
            24,
          marginBottom:
            10
        }}
      >

        <div className="kicker">
          Pending media
        </div>

        <h3
          style={{
            marginTop:
              5
          }}
        >
          Review each file individually.
        </h3>

      </div>

      {!pendingFiles.length && (
        <div
          className="notice"
          style={{
            marginBottom:
              18
          }}
        >
          No pending media.
        </div>
      )}

      {pendingSubmissionRows.map(
        ({
          submission,
          files:
            pendingList
        }: any) => (
          <div
            className="admin-row"
            key={
              submission.id
            }
            style={{
              display:
                'block',
              marginBottom:
                18
            }}
          >

            {/* SUBMISSION HEADER */}

            <div
              style={{
                display:
                  'flex',
                justifyContent:
                  'space-between',
                gap: 14,
                alignItems:
                  'flex-start',
                flexWrap:
                  'wrap'
              }}
            >

              <div>

                <strong
                  style={{
                    fontSize:
                      11
                  }}
                >
                  {
                    submission.student
                  }

                  {' · '}

                  {
                    submission.taskTitle ||
                    'General'
                  }
                </strong>

                <div
                  className="soft"
                  style={{
                    fontSize:
                      9,
                    marginTop:
                      5
                  }}
                >

                  {String(
                    submission.uploadType ||
                      ''
                  ).toUpperCase()}

                  {' · '}

                  {(
                    Number(
                      submission.zipSize
                    ) /
                    1024 /
                    1024
                  ).toFixed(
                    1
                  )}

                  {' MB · '}

                  {
                    submission.description
                  }

                </div>

              </div>

              <div
                style={{
                  fontSize:
                    8,
                  color:
                    '#888'
                }}
              >
                {
                  pendingList.length
                }{' '}
                file
                {
                  pendingList.length !==
                  1
                    ? 's'
                    : ''
                } waiting
              </div>

            </div>

            {/* PENDING FILES */}

            <div
              style={{
                display:
                  'grid',
                gridTemplateColumns:
                  'repeat(auto-fill,minmax(210px,1fr))',
                gap: 12,
                marginTop:
                  15
              }}
            >

              {pendingList.map(
                (
                  file: any
                ) => (
                  <FileCard
                    key={
                      file.id
                    }
                    file={
                      file
                    }
                    moderation
                  />
                )
              )}

            </div>

          </div>
        )
      )}

      {/* ===================================================
          APPROVED / PUBLISHED
      =================================================== */}

      <div
        style={{
          marginTop:
            30,
          marginBottom:
            10
        }}
      >

        <div className="kicker">
          Published media
        </div>

        <h3
          style={{
            marginTop:
              5
          }}
        >
          Approved photos & videos.
        </h3>

      </div>

      {!approvedFiles.length && (
        <div
          className="notice"
          style={{
            marginBottom:
              16
          }}
        >
          No approved media yet.
        </div>
      )}

      {approvedFiles.length >
        0 && (
        <div
          style={{
            display:
              'grid',
            gridTemplateColumns:
              'repeat(auto-fill,minmax(210px,1fr))',
            gap: 14
          }}
        >

          {approvedFiles.map(
            (file: any) => (
              <FileCard
                key={
                  file.id
                }
                file={
                  file
                }
                showBest
              />
            )
          )}

        </div>
      )}

      {/* ===================================================
          REJECTED
      =================================================== */}

      {rejectedFiles.length >
        0 && (
        <>
          <div
            style={{
              marginTop:
                30,
              marginBottom:
                10
            }}
          >

            <div className="kicker">
              Rejected media
            </div>

            <h3
              style={{
                marginTop:
                  5
              }}
            >
              Previously rejected files.
            </h3>

          </div>

          <div
            style={{
              display:
                'grid',
              gridTemplateColumns:
                'repeat(auto-fill,minmax(210px,1fr))',
              gap: 12
            }}
          >

            {rejectedFiles.map(
              (file: any) => (
                <FileCard
                  key={
                    file.id
                  }
                  file={
                    file
                  }
                />
              )
            )}

          </div>
        </>
      )}

    </section>
  );
}


/* =========================================================
   TASKS
========================================================= */

function Tasks({
  task,
  setTask,
  tasks,
  post,
  act
}: {
  task: any;
  setTask: any;
  tasks: any[];
  post: any;
  act: any;
}) {
  return (
    <div className="grid-2">

      <section className="card card-pad">

        <div className="kicker">
          Create assignment
        </div>

        <h3>
          Give students work.
        </h3>

        <div className="form">

          <input
            className="input"
            placeholder="Task title"
            value={
              task.title
            }
            onChange={e =>
              setTask({
                ...task,
                title:
                  e.target
                    .value
              })
            }
          />

          <textarea
            className="input"
            placeholder="Task description / instructions"
            value={
              task.description
            }
            onChange={e =>
              setTask({
                ...task,
                description:
                  e.target
                    .value
              })
            }
          />

          <input
            className="input"
            type="datetime-local"
            value={
              task.dueDate
            }
            onChange={e =>
              setTask({
                ...task,
                dueDate:
                  e.target
                    .value
              })
            }
          />

          <select
            className="input"
            value={
              task.uploadType
            }
            onChange={e =>
              setTask({
                ...task,
                uploadType:
                  e.target
                    .value
              })
            }
          >

            <option value="photo">
              Photo
            </option>

            <option value="video">
              Video
            </option>

            <option value="both">
              Photo + Video
            </option>

          </select>

          <button
            type="button"
            className="btn primary"
            onClick={() =>
              post(
                '/api/admin/tasks',
                task,
                'Task published.'
              )
            }
          >
            <Plus
              size={14}
            />
            Publish task
          </button>

        </div>

      </section>

      <section className="card card-pad">

        <div className="kicker">
          Published assignments
        </div>

        <h3>
          Task library.
        </h3>

        {tasks.map(
          (t: any) => (
            <div
              className="admin-row"
              key={
                t.id
              }
            >

              <div>

                <strong
                  style={{
                    fontSize:
                      10
                  }}
                >
                  {
                    t.title
                  }
                </strong>

                <div
                  className="soft"
                  style={{
                    fontSize:
                      9
                  }}
                >

                  {String(
                    t.upload_type ||
                      ''
                  ).toUpperCase()}

                  {' · '}

                  Due {
                    t.due_date
                  }

                </div>

              </div>

              <button
                type="button"
                className="tiny-btn danger"
                onClick={() =>
                  act(
                    () =>
                      api(
                        '/api/admin/tasks',
                        {
                          method:
                            'POST',

                          headers: {
                            'Content-Type':
                              'application/json'
                          },

                          body:
                            JSON.stringify(
                              {
                                action:
                                  'delete',
                                id:
                                  t.id
                              }
                            )
                        }
                      ),
                    'Task deleted.'
                  )
                }
              >
                Delete
              </button>

            </div>
          )
        )}

        {!tasks.length && (
          <p
            className="soft"
            style={{
              fontSize:
                10
            }}
          >
            No tasks published yet.
          </p>
        )}

      </section>

    </div>
  );
}


/* =========================================================
   MEETINGS
========================================================= */

function Meetings({
  meeting,
  setMeeting,
  meetings,
  post
}: {
  meeting: any;
  setMeeting: any;
  meetings: any[];
  post: any;
}) {
  return (
    <div className="grid-2">

      <section className="card card-pad">

        <div className="kicker">
          LMS meeting
        </div>

        <h3>
          Publish Zoom room.
        </h3>

        <div className="form">

          <input
            className="input"
            placeholder="Meeting title"
            value={
              meeting.title
            }
            onChange={e =>
              setMeeting({
                ...meeting,
                title:
                  e.target
                    .value
              })
            }
          />

          <input
            className="input"
            type="datetime-local"
            value={
              meeting.startTime
            }
            onChange={e =>
              setMeeting({
                ...meeting,
                startTime:
                  e.target
                    .value
              })
            }
          />

          <input
            className="input"
            placeholder="Zoom URL"
            value={
              meeting.zoomUrl
            }
            onChange={e =>
              setMeeting({
                ...meeting,
                zoomUrl:
                  e.target
                    .value
              })
            }
          />

          <textarea
            className="input"
            placeholder="Agenda"
            value={
              meeting.agenda
            }
            onChange={e =>
              setMeeting({
                ...meeting,
                agenda:
                  e.target
                    .value
              })
            }
          />

          <button
            type="button"
            className="btn primary"
            onClick={() =>
              post(
                '/api/admin/meetings',
                meeting,
                'Meeting published.'
              )
            }
          >
            <CalendarDays
              size={
                14
              }
            />
            Publish meeting
          </button>

        </div>

      </section>

      <section className="card card-pad">

        <div className="kicker">
          Meeting schedule
        </div>

        <h3>
          Upcoming / archive.
        </h3>

        {meetings.map(
          (m: any) => (
            <div
              className="admin-row"
              key={
                m.id
              }
            >

              <div>

                <strong
                  style={{
                    fontSize:
                      10
                  }}
                >
                  {m.title}
                </strong>

                <div
                  className="soft"
                  style={{
                    fontSize:
                      9
                  }}
                >
                  {new Date(
                    m.startTime
                  ).toLocaleString()}
                </div>

              </div>

              <div className="action-row">

                <a
                  href={
                    m.zoomUrl
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="tiny-btn"
                >
                  Zoom ↗
                </a>

                <button
                  type="button"
                  className="tiny-btn danger"
                  onClick={() =>
                    post(
                      '/api/admin/meetings',
                      {
                        action:
                          'delete',
                        id:
                          m.id
                      },
                      'Meeting deleted.'
                    )
                  }
                >
                  Delete
                </button>

              </div>

            </div>
          )
        )}

        {!meetings.length && (
          <p
            className="soft"
            style={{
              fontSize:
                10
            }}
          >
            No meetings published yet.
          </p>
        )}

      </section>

    </div>
  );
}


/* =========================================================
   EVENTS
========================================================= */

function Events({
  event,
  setEvent,
  events,
  post
}: {
  event: any;
  setEvent: any;
  events: any[];
  post: any;
}) {
  const fields = [
    [
      'title',
      'Title'
    ],
    [
      'date',
      'Date'
    ],
    [
      'location',
      'Location'
    ],
    [
      'description',
      'Description'
    ],
    [
      'trailerUrl',
      'Trailer URL'
    ],
    [
      'aftermovieUrl',
      'After Movie URL'
    ],
    [
      'albumUrl',
      'Album URL'
    ],
    [
      'coverUrl',
      'Cover image URL'
    ]
  ];

  return (
    <div className="grid-2">

      <section className="card card-pad">

        <div className="kicker">
          Event builder
        </div>

        <h3>
          Create event story.
        </h3>

        <div className="form">

          {fields.map(
            ([
              k,
              l
            ]) => (
              <input
                key={
                  k
                }
                className="input"
                placeholder={
                  l
                }
                value={
                  event[
                    k
                  ]
                }
                onChange={e =>
                  setEvent({
                    ...event,
                    [k]:
                      e.target
                        .value
                  })
                }
              />
            )
          )}

          <button
            type="button"
            className="btn primary"
            onClick={() =>
              post(
                '/api/admin/events',
                event,
                'Event published.'
              )
            }
          >
            <Plus
              size={14}
            />
            Publish event
          </button>

        </div>

      </section>

      <section className="card card-pad">

        <div className="kicker">
          Event archive
        </div>

        <h3>
          Published stories.
        </h3>

        {events.map(
          (e: any) => (
            <div
              className="admin-row"
              key={
                e.id
              }
            >

              <div>

                <strong
                  style={{
                    fontSize:
                      10
                  }}
                >
                  {e.title}
                </strong>

                <div
                  className="soft"
                  style={{
                    fontSize:
                      9
                  }}
                >
                  {e.date}
                  {' · '}
                  {e.location}
                </div>

              </div>

              <button
                type="button"
                className="tiny-btn danger"
                onClick={() =>
                  post(
                    '/api/admin/events',
                    {
                      action:
                        'delete',
                      id:
                        e.id
                    },
                    'Event deleted.'
                  )
                }
              >
                Delete
              </button>

            </div>
          )
        )}

        {!events.length && (
          <p
            className="soft"
            style={{
              fontSize:
                10
            }}
          >
            No events published yet.
          </p>
        )}

      </section>

    </div>
  );
}


/* =========================================================
   COMMUNITY
========================================================= */

function Community({
  comments,
  subs,
  announcements,
  announcement,
  setAnnouncement,
  post,
  act
}: {
  comments: any[];
  subs: any[];
  announcements: any[];
  announcement: any;
  setAnnouncement: any;
  post: any;
  act: any;
}) {
  return (
    <div className="grid-2">

      {/* COMMENTS */}

      <section className="card card-pad">

        <div className="kicker">
          Gallery comments
        </div>

        <h3>
          Moderate discussion.
        </h3>

        {comments
          .slice(0, 50)
          .map(
            (c: any) => (
              <div
                className="admin-row"
                key={
                  c.id
                }
              >

                <div>

                  <strong
                    style={{
                      fontSize:
                        9
                    }}
                  >
                    {
                      c.author
                    }
                  </strong>

                  <div
                    style={{
                      fontSize:
                        10,
                      color:
                        '#bbb'
                    }}
                  >
                    {
                      c.body
                    }
                  </div>

                  <small className="soft">
                    On {
                      c.mediaTitle
                    }
                  </small>

                </div>

                <div className="action-row">

                  <button
                    type="button"
                    className="tiny-btn"
                    onClick={() =>
                      post(
                        '/api/admin/comments',
                        {
                          id:
                            c.id,
                          action:
                            c.status ===
                            'hidden'
                              ? 'show'
                              : 'hide'
                        },
                        c.status ===
                        'hidden'
                          ? 'Comment shown.'
                          : 'Comment hidden.'
                      )
                    }
                  >
                    {c.status ===
                    'hidden' ? (
                      <Check
                        size={
                          10
                        }
                      />
                    ) : (
                      <EyeOff
                        size={
                          10
                        }
                      />
                    )}
                  </button>

                  <button
                    type="button"
                    className="tiny-btn danger"
                    onClick={() =>
                      act(
                        () =>
                          api(
                            '/api/admin/comments',
                            {
                              method:
                                'POST',
                              headers:
                                {
                                  'Content-Type':
                                    'application/json'
                                },
                              body:
                                JSON.stringify(
                                  {
                                    id:
                                      c.id,
                                    action:
                                      'delete'
                                  }
                                )
                            }
                          ),
                        'Comment deleted.'
                      )
                    }
                  >
                    <Trash2
                      size={
                        10
                      }
                    />
                  </button>

                </div>

              </div>
            )
          )}

        {!comments.length && (
          <p
            className="soft"
            style={{
              fontSize:
                10
            }}
          >
            No comments yet.
          </p>
        )}

      </section>

      {/* ANNOUNCEMENTS */}

      <section className="card card-pad">

        <div className="kicker">
          Announcements
        </div>

        <h3>
          Publish notice.
        </h3>

        <div className="form">

          <input
            className="input"
            placeholder="Title"
            value={
              announcement.title
            }
            onChange={e =>
              setAnnouncement({
                ...announcement,
                title:
                  e.target
                    .value
              })
            }
          />

          <textarea
            className="input"
            placeholder="Announcement"
            value={
              announcement.body
            }
            onChange={e =>
              setAnnouncement({
                ...announcement,
                body:
                  e.target
                    .value
              })
            }
          />

          <button
            type="button"
            className="btn primary"
            onClick={() =>
              post(
                '/api/admin/announcements',
                announcement,
                'Announcement published.'
              )
            }
          >
            Publish announcement
          </button>

        </div>

        <div className="divider" />

        {announcements.map(
          (a: any) => (
            <div
              className="admin-row"
              key={
                a.id
              }
            >

              <div>

                <strong
                  style={{
                    fontSize:
                      10
                  }}
                >
                  {a.title}
                </strong>

                <div
                  className="soft"
                  style={{
                    fontSize:
                      9
                  }}
                >
                  {a.active
                    ? 'Live'
                    : 'Hidden'}
                </div>

              </div>

              <div className="action-row">

                <button
                  type="button"
                  className="tiny-btn"
                  onClick={() =>
                    post(
                      '/api/admin/announcements',
                      {
                        action:
                          'toggle',
                        id:
                          a.id
                      },
                      'Announcement status changed.'
                    )
                  }
                >
                  {a.active
                    ? 'Hide'
                    : 'Show'}
                </button>

                <button
                  type="button"
                  className="tiny-btn danger"
                  onClick={() =>
                    post(
                      '/api/admin/announcements',
                      {
                        action:
                          'delete',
                        id:
                          a.id
                      },
                      'Announcement deleted.'
                    )
                  }
                >
                  Delete
                </button>

              </div>

            </div>
          )
        )}

        <div className="divider" />

        <div className="kicker">
          Email subscribers
        </div>

        {subs
          .slice(0, 30)
          .map(
            (s: any) => (
              <div
                className="admin-row"
                key={
                  s.id
                }
              >

                <span
                  style={{
                    fontSize:
                      9
                  }}
                >
                  {
                    s.email
                  }
                </span>

                <button
                  type="button"
                  className="tiny-btn danger"
                  onClick={() =>
                    post(
                      '/api/admin/subscribers',
                      {
                        id:
                          s.id,
                        action:
                          'delete'
                      },
                      'Subscriber removed.'
                    )
                  }
                >
                  Remove
                </button>

              </div>
            )
          )}

      </section>

    </div>
  );
}


/* =========================================================
   CHAT
========================================================= */

function Chat({
  threads,
  messages,
  selected,
  setSelected,
  text,
  setText,
  post
}: {
  threads: any[];
  messages: any[];
  selected:
    | number
    | null;
  setSelected: (
    n:
      | number
      | null
  ) => void;
  text: string;
  setText: (
    s: string
  ) => void;
  post: any;
}) {
  return (
    <div className="grid-2">

      {/* THREADS */}

      <section className="card card-pad">

        <div className="kicker">
          Support inbox
        </div>

        <h3>
          Student conversations.
        </h3>

        {threads.map(
          (t: any) => (
            <button
              key={
                t.id
              }
              type="button"
              className="chat-thread"
              onClick={() =>
                setSelected(
                  Number(
                    t.id
                  )
                )
              }
              style={{
                width:
                  '100%',
                textAlign:
                  'left',
                color:
                  'inherit'
              }}
            >

              <strong
                style={{
                  fontSize:
                    10
                }}
              >
                {
                  t.student
                }
              </strong>

              <div
                className="soft"
                style={{
                  fontSize:
                    8
                }}
              >
                {t.email}
                {' · '}
                {t.status}
              </div>

            </button>
          )
        )}

        {!threads.length && (
          <p
            className="soft"
            style={{
              fontSize:
                10
            }}
          >
            No support conversations.
          </p>
        )}

      </section>

      {/* CONVERSATION */}

      <section className="card card-pad">

        <div className="kicker">
          Conversation
        </div>

        <h3>
          {selected
            ? threads.find(
                (t: any) =>
                  Number(
                    t.id
                  ) ===
                  Number(
                    selected
                  )
              )?.student ||
              'Student'
            : 'Select a student'}
        </h3>

        {selected ? (
          <>

            <div className="chat-list">

              {messages.map(
                (m: any) => (
                  <div
                    key={
                      m.id
                    }
                    className={
                      `chat-msg ${
                        m.senderRole ===
                        'admin'
                          ? 'me'
                          : ''
                      }`
                    }
                  >
                    {
                      m.message
                    }

                    <div
                      style={{
                        fontSize:
                          7,
                        opacity:
                          0.6,
                        marginTop:
                          4
                      }}
                    >
                      {new Date(
                        m.createdAt
                      ).toLocaleString()}
                    </div>

                  </div>
                )
              )}

            </div>

            <form
              className="chat-compose"
              onSubmit={e => {
                e.preventDefault();

                if (
                  !text.trim()
                ) {
                  return;
                }

                post(
                  '/api/admin/chat',
                  {
                    threadId:
                      selected,
                    message:
                      text.trim()
                  },
                  'Reply sent.'
                );

                setText('');
              }}
            >

              <input
                className="input"
                value={
                  text
                }
                onChange={e =>
                  setText(
                    e.target
                      .value
                  )
                }
                placeholder="Reply to student…"
              />

              <button
                type="submit"
                className="btn primary"
              >
                <Send
                  size={
                    13
                  }
                />
              </button>

            </form>

            <button
              type="button"
              className="tiny-btn"
              style={{
                marginTop:
                  8
              }}
              onClick={() =>
                post(
                  '/api/admin/chat',
                  {
                    threadId:
                      selected,
                    close:
                      true
                  },
                  'Chat closed.'
                )
              }
            >
              Close conversation
            </button>

          </>
        ) : (
          <p
            className="soft"
            style={{
              fontSize:
                10
            }}
          >
            Select a conversation
            to reply.
          </p>
        )}

      </section>

    </div>
  );
}


/* =========================================================
   BOARD
========================================================= */

function Board({
  board,
  users,
  boardForm,
  setBoardForm,
  post,
  act
}: {
  board: any[];
  users: any[];
  boardForm: any;
  setBoardForm: any;
  post: any;
  act: any;
}) {
  return (
    <div className="grid-2">

      {/* BOARD LIST */}

      <section className="card card-pad">

        <div className="kicker">
          Board roster
        </div>

        <h3>
          Manage official positions.
        </h3>

        {board.map(
          (b: any) => (
            <div
              className="admin-row"
              key={
                b.id
              }
            >

              <div>

                <strong
                  style={{
                    fontSize:
                      10
                  }}
                >
                  {
                    b.position
                  }
                </strong>

                <div
                  className="soft"
                  style={{
                    fontSize:
                      9
                  }}
                >
                  {
                    b.person_name
                  }

                  {b.user_id
                    ? ' · linked to member'
                    : ''}
                </div>

              </div>

              <button
                type="button"
                className="tiny-btn danger"
                onClick={() =>
                  post(
                    '/api/admin/board',
                    {
                      action:
                        'delete',
                      id:
                        b.id
                    },
                    'Board position removed.'
                  )
                }
              >
                Delete
              </button>

            </div>
          )
        )}

        {!board.length && (
          <p
            className="soft"
            style={{
              fontSize:
                10
            }}
          >
            No board positions yet.
          </p>
        )}

      </section>

      {/* ASSIGN BOARD */}

      <section className="card card-pad">

        <div className="kicker">
          Assign board
        </div>

        <h3>
          Link an approved student.
        </h3>

        <div className="form">

          <input
            className="input"
            placeholder="Position"
            value={
              boardForm.position
            }
            onChange={e =>
              setBoardForm({
                ...boardForm,
                position:
                  e.target.value
              })
            }
          />

          <input
            className="input"
            placeholder="Display name"
            value={
              boardForm.personName
            }
            onChange={e =>
              setBoardForm({
                ...boardForm,
                personName:
                  e.target.value
              })
            }
          />

          <select
            className="input"
            value={
              boardForm.userId
            }
            onChange={e =>
              setBoardForm({
                ...boardForm,
                userId:
                  e.target.value
              })
            }
          >

            <option value="">
              No linked student
            </option>

            {users
              .filter(
                (u: any) =>
                  u.status ===
                    'approved' &&
                  u.role ===
                    'student'
              )
              .map(
                (u: any) => (
                  <option
                    key={
                      u.id
                    }
                    value={
                      u.id
                    }
                  >
                    {u.fullName ||
                      u.full_name ||
                      'Student'}
                    {' · '}
                    {
                      u.email
                    }
                  </option>
                )
              )}

          </select>

          <input
            className="input"
            type="number"
            min="1"
            value={
              boardForm.displayOrder
            }
            onChange={e =>
              setBoardForm({
                ...boardForm,
                displayOrder:
                  e.target.value
              })
            }
          />

          <button
            type="button"
            className="btn primary"
            onClick={() =>
              post(
                '/api/admin/board',
                boardForm,
                'Board position saved.'
              )
            }
          >
            Save board position
          </button>

        </div>

      </section>

    </div>
  );
}


/* =========================================================
   SETTINGS
========================================================= */

function SettingsPanel({
  settings,
  setting,
  setSetting,
  post
}: {
  settings: any[];
  setting: any;
  setSetting: any;
  post: any;
}) {
  return (
    <div className="grid-2">

      {/* FORM */}

      <section className="card card-pad">

        <div className="kicker">
          Website settings
        </div>

        <h3>
          Social / public links.
        </h3>

        <div className="form">

          <input
            className="input"
            placeholder="Setting key"
            value={
              setting.key
            }
            onChange={e =>
              setSetting({
                ...setting,
                key:
                  e.target.value
              })
            }
          />

          <input
            className="input"
            placeholder="Value"
            value={
              setting.value
            }
            onChange={e =>
              setSetting({
                ...setting,
                value:
                  e.target.value
              })
            }
          />

          <button
            type="button"
            className="btn primary"
            onClick={() =>
              post(
                '/api/admin/settings',
                setting,
                'Setting saved.'
              )
            }
          >
            Save setting
          </button>

        </div>

        <div className="divider" />

        <p
          className="soft"
          style={{
            fontSize:
              9
          }}
        >
          Suggested keys:
          instagram_url,
          facebook_url,
          youtube_url,
          tiktok_url,
          contact_email,
          copyright_text.
        </p>

      </section>

      {/* CURRENT SETTINGS */}

      <section className="card card-pad">

        <div className="kicker">
          Current settings
        </div>

        <h3>
          Saved values.
        </h3>

        {settings.map(
          (s: any) => (
            <div
              className="admin-row"
              key={
                s.key
              }
            >

              <div>

                <strong
                  style={{
                    fontSize:
                      9
                  }}
                >
                  {
                    s.key
                  }
                </strong>

                <div
                  className="soft"
                  style={{
                    fontSize:
                      9,
                    wordBreak:
                      'break-all'
                  }}
                >
                  {
                    s.value
                  }
                </div>

              </div>

            </div>
          )
        )}

        {!settings.length && (
          <p
            className="soft"
            style={{
              fontSize:
                10
            }}
          >
            No settings saved yet.
          </p>
        )}

      </section>

    </div>
  );
}