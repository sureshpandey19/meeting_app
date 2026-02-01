Phase Progress

Overview
This document tracks phase-wise progress, what is delivered so far, and what is planned next.

Phase 1 - Core Meetings (No Media)
Status: Complete
Goals
- Backend API for meeting creation/join
- MySQL schema for meetings and participants
- Simple web UI for create/join
- JWT tokens for meeting access

Delivered
- PHP API endpoints for meeting lifecycle and participants
- MySQL schema for meetings/participants
- Frontend UI for create/join
- Expiration rules and host/guest flow

Out of Scope (Phase 1)
- Audio/video
- SFU/TURN
- Admin dashboard

Phase 2A - Core Security & Ops
Status: Complete (implementation present in repo)
Goals
- Admin API keys for protected actions (host/admin roles)
- Audit logging and rate limiting
- HTTPS setup when certificates are ready

Delivered
- Admin config page for API key creation
- Admin key validation for protected endpoints
- Audit logging for meeting actions, key creation, and rate limits
- Per-IP rate limiting on API endpoints

Pending
- HTTPS setup (certificate provisioning and server configuration)

Phase 2B - Audio/Video (LiveKit)
Status: Implemented (self-signed SSL working)
Goal
- Integrate LiveKit to enable group audio/video in meetings

Delivered
- LiveKit server config and connectivity with self-signed SSL
- LiveKit token issuance and join flow wired to meetings
- LiveKit token issuance logged in audit logs
- AV join/leave controls with video and mic icons; start on click

Planned Outcomes
- LiveKit server configuration for self-hosted deployment
- Token issuance from backend for LiveKit rooms
- UI updates to join/leave AV rooms and show participant media
- TURN/STUN configuration for NAT traversal (if required)
- Permissions/roles alignment with host/admin model

Documentation Notes (Audio/Video Data Path)
- Audio/video streaming does not use the REST API; it goes directly via LiveKit WebRTC
- REST API is used only for authentication, authorization, and issuing LiveKit JWT tokens
- Recommended endpoint: POST /api/meetings/{id}/livekit-token (or /classrooms/{id}/livekit-token)
  - Validate user session + role (host/guest)
  - Validate meeting is active and user is a participant
  - Issue short-lived LiveKit JWT with room name and grants (publish/subscribe)
- Client flow: join meeting via existing REST flow -> request LiveKit token -> connect to LiveKit SDK
- LiveKit ports (default): HTTPS/WSS 7880 (signaling), UDP 7881 + UDP 50000-60000 (media)

Scope Notes
- Keep Phase 1 meeting flow (create/join) as the entry point
- AV is enabled only after host joins (same as guest gating)

Detailed Spec (Phase 2B)
API Endpoints
- POST /api/meetings/{id}/livekit-token
  - Auth: required (existing meeting JWT/session)
  - Request: { "device": "web" | "ios" | "android" } (optional)
  - Response: { "token": "<livekit_jwt>", "url": "wss://<livekit-host>:7880", "room": "<room_name>", "participant": "<participant_identity>" }
  - Errors: 401 unauth, 403 not participant, 409 meeting not active/host not joined, 429 rate limited
- POST /api/classrooms/{id}/livekit-token (if classroom routes are separate)
  - Same behavior as meetings endpoint; choose one or alias to the other

Token Claims (LiveKit JWT)
- identity: participant_id or user_id (stable per meeting)
- name: display_name (optional)
- room: room_name (see Room Naming)
- grants:
  - roomJoin: true
  - canPublish: true for host, optional for guests (based on role)
  - canSubscribe: true for all participants
  - canPublishData: true (if using data messages)
- ttl: short-lived (5-15 minutes), refreshable via same endpoint

Room Naming
- Format: meeting_<meeting_id> (or classroom_<classroom_id>)
- Must be deterministic and URL-safe
- Keep consistent across backend, frontend, and LiveKit server logs

UI Flow
- User completes existing meeting join flow (Phase 1)
- Frontend calls /api/meetings/{id}/livekit-token after:
  - Host has joined (gating rule)
  - User is authorized for the meeting
- Frontend connects to LiveKit SDK using returned token + URL
- UI states:
  - Waiting for host (guests see placeholder)
  - Connecting to AV (loading)
  - In-room (local preview + remote tiles)
  - Reconnect flow on token expiration/network drop

Operational Notes
- LiveKit URL/ports must be configured in backend env vars
- Current deployment target: wss://192.168.25.144/livekit (self-signed SSL)
- Media traffic never passes through REST API
- Logs: record token issuance + join/leave events for audit

Installation Notes (LiveKit Server)
- Download: https://github.com/livekit/livekit/releases/download/v1.9.11/livekit_1.9.11_linux_amd64.tar.gz
- Binary: extract to repo root as livekit-server (already placed in this repo)
- Config file: livekit.yaml (repo root)
- Start command: ./livekit-server --config livekit.yaml
- Log file (example): livekit.log (use nohup if running in background)
- Firewall (firewalld):
  - Open ports: 7880/tcp, 7881/tcp, 50000-60000/udp
  - Commands: firewall-cmd --add-port=7880/tcp --add-port=7881/tcp --add-port=50000-60000/udp --permanent
  - Apply: firewall-cmd --reload

Next Steps
- Decide LiveKit deployment model (single host vs. cluster)
- Define operational requirements (ports, firewall, monitoring)
- Plan transition from self-signed SSL to CA-signed certs for production

Phase 3 - AV Layout & UX Enhancements
Status: In Progress
Goals
- Improve AV layout to keep tiles aligned at the top and avoid page growth.
- Streamline join flow by hiding the input form once a user is joined.
- Add window controls for maximize/restore of the AV area.
- Improve in-tile controls and identity display for users.

Updates (2026-01-24)
- Auto-adjusting AV grid based on participant count and container width.
- Join flow cleanup: hide join form after join and hide non-essential headers in-meeting.
- Host identification in tiles with badge and host label in names.
- Participant sidebar toggle with auto-show on pending requests.
- Per-tile mic/cam status indicators and local in-tile controls.
- Separate host/guest link fields with copy + open links; hidden until generated.
- LiveKit debug toggle added in admin UI (optional, off by default).

Planned (Phase 3)
- TBD.

Updates (2026-01-28)
- Screen sharing for local and remote participants with dedicated screen tiles.
- In-meeting chat window using LiveKit data messages.
- Screen share layout: shared screen becomes main view with top strip tiles.
- Chat file sharing (<=1MB) via LiveKit data messages.
- Screen share UI: compact icon controls over AV stage and single-share enforcement.

Updates (2026-02-01)
- Full-screen in-meeting layout: remove card framing, stretch AV stage to viewport.
- Bottom-center control bar for meeting actions; mic/cam controls restored there only.
- Side panel now docks on the right and resizes AV area instead of overlay/crop.
- Screen share tile uses object-fit: contain to avoid cropping.
- Waiting/AV status displayed as an overlay in meeting view.
- Tile UI cleanup: name/status overlays repositioned to avoid overlap; per-tile mic/cam icons removed.
- Remote tile reconciliation to reduce missing/duplicate tiles across clients.

Phase 4 - Collaboration, Admin, and AI Assist
Status: Planned
Goals
- Add chat, screen share, and recording.
- Provide an admin dashboard for monitoring and moderation.
- Introduce AI-assisted features (captions, summaries, action items, transcripts, speaker insights).

Phase 5 - Licensing, Trials, and Billing
Status: Planned
Goals
- Introduce user licensing tiers and per-user pricing.
- Support free trials with clear limits and conversion flow.
- Provide billing and subscription management for admins.

Phase 6 - Orchestration & Robust Deployments
Status: Planned
Goals
- Improve deployment robustness and scalability.
- Standardize orchestration, health checks, and monitoring.
- Enable repeatable rollouts and rollbacks.
