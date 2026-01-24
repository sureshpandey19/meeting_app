Phase 3 - AV Layout & UX Enhancements

Goals
- Improve AV layout to keep tiles aligned at the top and avoid page growth.
- Streamline join flow by hiding the input form once a user is joined.
- Add window controls for maximize/restore of the AV area.
- Improve in-tile controls and identity display for users.
- Separate host and guest join links to prevent host link reuse by guests.

Planned Outcomes
- Video grid aligned at the top of the page with a fixed-height AV stage.
- Scrollable tile area when participants exceed the visible grid.
- Join form auto-hides after successful join (host or guest).
- AV stage can be maximized/restored without leaving the meeting.
- Mic/camera controls shown on each user tile (small icons).
- User name shown on tile:
  - If camera off: show name prominently.
  - If camera on: show name overlay on video.
- Distinct host and guest join URLs with clear labeling in the UI.

Scope Notes
- Keep existing meeting flow and tokens unchanged.
- Layout changes should not break mobile view; ensure responsive behavior.
- Only UI/UX changes; no new backend endpoints required.
- Host link should not be usable by guests even if shared.

UI/UX Tasks
- Create a fixed AV stage container with top alignment.
- Use a grid that wraps within the stage and scrolls when full.
- Move or duplicate mic/camera toggles into per-user tiles.
- Add a maximize/restore toggle for the AV stage.
- Auto-hide join form after join; provide a minimal status line instead.
- Add name overlays on video tiles with readable contrast.
- Show separate copy buttons/fields for host vs guest join links.

Acceptance Criteria
- Video tiles stay aligned at top without pushing the page down.
- Participant count increase does not expand page height beyond the AV stage.
- Join form hides after join and can be re-opened if needed.
- Maximize/restore works on desktop and mobile.
- Mic/camera icons are visible in each tile and reflect state.
- User name display behaves as specified for camera on/off.
- Host link cannot be used to join as a guest; guest link enforces guest role.
