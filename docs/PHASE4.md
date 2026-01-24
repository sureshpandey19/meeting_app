Phase 4 - Collaboration, Admin, and AI Assist

Goals
- Add collaboration features (chat, screen share, recording).
- Provide an admin dashboard for monitoring and moderation.
- Introduce AI-assisted features for meeting insights.

Planned Outcomes
- In-meeting chat with moderation controls.
- Screen share support (host/guest permissions).
- Recording controls and storage policy.
- Admin dashboard for meetings, participants, and audit logs.
- AI features:
  - Live captions (optional, per meeting).
  - Post-meeting summary with key points.
  - Action items extraction with timestamps.
  - Searchable transcript per meeting.
  - Speaker diarization and per-speaker highlights.
  - Smart chapters and topic timeline.
  - Follow-up email draft from summary.
  - Sentiment or engagement insights (optional).

Scope Notes
- AI features should be opt-in and respect privacy settings.
- Recording and transcription storage must define retention and access control.
- Keep API keys and audit logs aligned with admin actions.

Backend Tasks
- Add endpoints for chat messages and moderation actions.
- Add recording lifecycle endpoints (start/stop/status).
- Add transcript and summary retrieval endpoints.
- Store AI artifacts with meeting_id and access rules.

Frontend Tasks
- Chat panel with unread indicator.
- Screen share controls with active-share state.
- Recording indicator and permission prompts.
- Admin dashboard UI views.
- AI summary and transcript views in meeting details.

Acceptance Criteria
- Chat works with basic moderation (delete/flag).
- Screen share works across desktop browsers.
- Recordings can be started/stopped by host and are accessible per policy.
- Admin dashboard shows live meetings and recent audits.
- AI summary and action items render per meeting when enabled.
