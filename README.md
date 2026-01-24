Online Meeting System (Phase 1)

This repository is a phased build for a self-hosted, Linux-based group meeting system.
Phase 1 focuses on core meeting creation/joining (no media yet).

Structure
- api/ PHP REST API (Apache)
- backend/ FastAPI service (legacy, optional)
- frontend/ Simple HTML/JS UI (create/join)
- docs/ Phase docs and setup

Quick Start (Phase 1 - Apache + PHP)
1) Copy frontend/ and api/ to Apache docroot.
2) Ensure Apache + PHP are installed and running.
3) Update API base in /var/www/html/meeting_app/app.js if needed.
4) Open http://127.0.0.1/meeting_app/

Feature List (Current)
- Instant meeting: one-click link generation.
- Scheduled meeting: title, date/time, duration, optional password.
- Host link vs guest link; host must join first.
- Host can stop meeting and remove users.
- Guests see active participant list + count.
- Removed users get a removal notice.
- Expiration rules: 60 min if no join, 24h after first join.

Notes
- Instant meetings generate host + guest links.
- Guests can join only after host joins.

Note: This phase does not include audio/video.
