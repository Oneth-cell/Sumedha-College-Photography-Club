# Project map

## Public
- `/` — animated Home; guest view hides private LMS meeting details.
- `/gallery` — approved photo/video gallery; likes, ratings and comments for logged-in members.
- `/events` — event trailer / after-movie / album links.
- `/board` — executive committee roster.

## Student auth
- `/register` — registration request + first-time registration tutorial + optional profile picture.
- `/login` — email/password step.
- `/verify` — 6-digit email confirmation step and secure session cookie.
- `/lms` — member-only LMS and first-use LMS tutorial.

## LMS functions
- Dashboard and private meeting countdown + Zoom.
- Admin-assigned daily tasks.
- ZIP-only project submission.
- Max ZIP 5 GB.
- Photo file inside ZIP: strictly less than 50 MB.
- Video file inside ZIP: 4 GB or less.
- Required description.
- Profile picture/basic profile editing.
- Admin support chat.
- Announcements and submission history.

## Admin CRM
- Overview metrics.
- Membership requests: approve/reject.
- Member directory: activate/suspend and assign Member vs Board + official position.
- Media moderation: approve/reject submissions; Weekly Best control.
- Task creation/deletion with Photo / Video / Both requirements.
- Meeting publishing/deletion and Zoom links.
- Event publishing/deletion with trailer / after movie / album.
- Gallery comment moderation.
- Announcements and email subscribers.
- Student support chat inbox and replies.
- Board roster management and member linking.
- Public/social settings.

## API security
All `/api/admin/*` routes call `requireAdmin()`. Student routes call `requireUser()`.

## Upload safety
ZIP paths are checked for traversal. Only supported image/video extensions are accepted. The server validates the ZIP and media file sizes before publishing media rows. The ZIP is stored and media extracted into the local upload directory.
