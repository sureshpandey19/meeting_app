const API_BASE = "/meeting_app/api";

const createInstantBtn = document.getElementById("create-instant-btn");
const createScheduledBtn = document.getElementById("create-scheduled-btn");
const scheduleToggleBtn = document.getElementById("schedule-toggle-btn");
const scheduleForm = document.getElementById("schedule-form");
const joinBtn = document.getElementById("join-btn");
const joinMeetingInput = document.getElementById("join-meetingid");
const joinHostTokenInput = document.getElementById("join-hosttoken");
const joinPasswordInput = document.getElementById("join-password");
const joinHostBanner = document.getElementById("host-banner");
const joinForm = document.getElementById("join-form");
const joinSummary = document.getElementById("join-summary");
const joinSummaryTitle = document.getElementById("join-summary-title");
const joinSummaryDetails = document.getElementById("join-summary-details");
const joinFormToggle = document.getElementById("join-form-toggle");
const leaveBtn = document.getElementById("av-leave-btn");
const hostPanel = document.getElementById("host-panel");
const participantsList = document.getElementById("participants-list");
const guestPanel = document.getElementById("guest-panel");
const participantsCount = document.getElementById("participants-count");
const participantsPublic = document.getElementById("participants-public");
const requestPanel = document.getElementById("request-panel");
const requestCount = document.getElementById("request-count");
const requestList = document.getElementById("request-list");
const copyButtons = document.querySelectorAll(".copy-btn");
const toast = document.getElementById("toast");
const avPanel = document.getElementById("av-panel");
const avMicBtn = document.getElementById("av-mic-btn");
const avCameraBtn = document.getElementById("av-camera-btn");
const avStatus = document.getElementById("av-status");
const meetingTimer = document.getElementById("meeting-timer");
const avLocal = document.getElementById("av-local");
const avGrid = document.getElementById("av-grid");
const avLocalTile = document.getElementById("av-local-tile");
const avLocalName = document.getElementById("av-local-name");
const avLocalOverlay = document.getElementById("av-local-overlay");
const avLocalPlaceholder = document.getElementById("av-local-placeholder");
const avTileMic = document.getElementById("av-tile-mic");
const avTileCamera = document.getElementById("av-tile-camera");
const sideToggleBtn = document.getElementById("side-toggle-btn");
const meetingLayout = document.getElementById("meeting-layout");
const meetingSide = document.querySelector(".meeting-side");
const createLinks = document.getElementById("create-links");
const scheduleLinks = document.getElementById("schedule-links");
const debugPanel = document.getElementById("debug-panel");
const debugOutput = document.getElementById("debug-output");
const debugToggleBtn = document.getElementById("debug-toggle-btn");

let meetingPoll = null;
let participantsPoll = null;
let publicPoll = null;
let sessionToken = "";
let isHost = false;
let removedNoticeShown = false;
let livekitRoom = null;
let localAudioTrack = null;
let localVideoTrack = null;
let restoreAvState = null;
let previewMode = false;
let localPreviewAudioTrack = null;
let localPreviewVideoTrack = null;
const remoteTiles = new Map();
let lastPendingCount = 0;
let meetingTimerInterval = null;
let scheduledStart = null;
let scheduledDuration = null;
let hostNames = new Set();
let sidePanelPinned = false;
const debugLines = [];
let debugEnabled = false;
let debugVisible = false;

const STORAGE_KEY = "meeting_app_last_join";
 
if (createLinks) createLinks.hidden = true;
if (scheduleLinks) scheduleLinks.hidden = true;
updateAvGridLayout();
window.addEventListener("resize", updateAvGridLayout);
loadUiConfig();

function normalizeName(name) {
  return (name || "").trim().toLowerCase();
}

function formatDisplayName(name) {
  const base = name || "Participant";
  if (!base) return "Participant";
  return hostNames.has(normalizeName(base)) ? `${base} (host)` : base;
}

function refreshTileNamesFromRoster() {
  if (!avGrid) return;
  avGrid.querySelectorAll(".av-tile").forEach((tile) => {
    const name = tile.dataset.displayName || "";
    const isHost = hostNames.has(normalizeName(name));
    const label = formatDisplayName(name);
    const nameEl = tile.querySelector(".av-name");
    const overlayEl = tile.querySelector(".av-name-overlay");
    const placeholderEl = tile.querySelector(".av-name-placeholder");
    if (nameEl) nameEl.textContent = label;
    if (overlayEl) overlayEl.textContent = label;
    if (placeholderEl) placeholderEl.textContent = label;
    tile.classList.toggle("is-host", isHost);
  });
}

function setSidePanelVisible(visible, pinned) {
  if (!meetingLayout) return;
  meetingLayout.classList.toggle("hide-side", !visible);
  if (typeof pinned === "boolean") {
    sidePanelPinned = pinned;
  }
  window.requestAnimationFrame(updateAvGridLayout);
}

function logDebug(message) {
  if (!debugEnabled || !debugPanel || !debugOutput) return;
  const stamp = new Date().toISOString().slice(11, 19);
  debugLines.push(`${stamp} ${message}`);
  while (debugLines.length > 20) {
    debugLines.shift();
  }
  if (debugVisible) {
    debugOutput.textContent = debugLines.join("\n");
  }
}

function renderDebugPanel() {
  if (!debugPanel || !debugOutput) return;
  debugPanel.hidden = !debugVisible;
  if (debugVisible) {
    debugOutput.textContent = debugLines.join("\n");
  }
}

function setTileStatusIcons(tile, micOn, camOn) {
  if (!tile) return;
  const micEl = tile.querySelector(".av-status-icon.mic");
  const camEl = tile.querySelector(".av-status-icon.cam");
  if (micEl) micEl.dataset.state = micOn ? "on" : "off";
  if (camEl) camEl.dataset.state = camOn ? "on" : "off";
}

function updateAvGridLayout() {
  if (!avGrid) return;
  const tiles = avGrid.querySelectorAll(".av-tile");
  const count = tiles.length;
  const stage = document.querySelector(".av-stage");
  if (!stage) return;
  const gap = 12;
  const padding = 8 * 2;
  const minTile = 220;
  const gridWidth = Math.max(0, avGrid.clientWidth - padding);
  const maxCols = Math.max(1, Math.floor((gridWidth + gap) / (minTile + gap)));
  const cols = Math.max(1, Math.min(count || 1, maxCols));
  avGrid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  const rows = Math.max(1, Math.ceil(count / cols));
  const stageHeight = stage.clientHeight;
  const tileHeight = Math.floor((stageHeight - padding - gap * (rows - 1)) / rows);
  const mediaMin = Math.max(120, tileHeight - 64);
  avGrid.style.setProperty("--tile-media-min", `${mediaMin}px`);
}

async function loadUiConfig() {
  try {
    const res = await fetch(`${API_BASE}/ui_config.php`);
    const data = await res.json();
    debugEnabled = !!(data && data.livekit_debug);
    if (debugToggleBtn) {
      debugToggleBtn.hidden = !debugEnabled;
    }
    if (!debugEnabled) {
      debugVisible = false;
      renderDebugPanel();
    }
  } catch (_err) {
    debugEnabled = false;
  }
}

function loadStoredJoin() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_err) {
    return null;
  }
}

function storeJoin(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_err) {
    return;
  }
}

function clearStoredJoin() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (_err) {
    return;
  }
}

function setCopyStatus(statusEl, message, isError) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#9b1c1c" : "#2f5d2f";
}

function scheduleStatusClear(statusEl) {
  if (!statusEl) return;
  if (statusEl.dataset.clearTimer) {
    clearTimeout(Number(statusEl.dataset.clearTimer));
  }
  const timer = window.setTimeout(() => {
    statusEl.textContent = "";
    delete statusEl.dataset.clearTimer;
  }, 3000);
  statusEl.dataset.clearTimer = String(timer);
}

function showToast(message, isError) {
  if (!toast) return;
  toast.textContent = message;
  toast.style.background = isError ? "#7f1d1d" : "#111827";
  toast.classList.add("show");
  if (toast.dataset.hideTimer) {
    clearTimeout(Number(toast.dataset.hideTimer));
  }
  const timer = window.setTimeout(() => {
    toast.classList.remove("show");
    delete toast.dataset.hideTimer;
  }, 2400);
  toast.dataset.hideTimer = String(timer);
}

function setAvStatus(message, isError) {
  if (!avStatus) return;
  avStatus.textContent = message;
  avStatus.style.color = isError ? "#9b1c1c" : "#52606d";
}

function syncAvStatus() {
  if (!avStatus) return;
  const micOn = !!localAudioTrack || !!localPreviewAudioTrack;
  const camOn = !!localVideoTrack || !!localPreviewVideoTrack;
  setTileStatusIcons(avLocalTile, micOn, camOn);
  if (!livekitRoom && !previewMode) {
    setAvStatus("AV is ready after joining.", false);
    return;
  }
  if (camOn && micOn) {
    setAvStatus("Camera and microphone on.", false);
    return;
  }
  if (camOn && !micOn) {
    setAvStatus("Camera on. Mic off.", false);
    return;
  }
  if (!camOn && micOn) {
    setAvStatus("Microphone on. Camera off.", false);
    return;
  }
  setAvStatus("Camera and microphone off.", false);
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

function updateMeetingTimer() {
  if (!meetingTimer || !scheduledStart || !scheduledDuration) {
    if (meetingTimer) meetingTimer.hidden = true;
    return;
  }
  const startMs = new Date(scheduledStart).getTime();
  const endMs = startMs + scheduledDuration * 60 * 1000;
  const now = Date.now();
  if (now < startMs) {
    meetingTimer.textContent = `Starts in ${formatCountdown(startMs - now)}`;
    meetingTimer.hidden = false;
    return;
  }
  if (now < endMs) {
    meetingTimer.textContent = `Ends in ${formatCountdown(endMs - now)}`;
    meetingTimer.hidden = false;
    return;
  }
  meetingTimer.textContent = "Meeting ended";
  meetingTimer.hidden = false;
}

function startMeetingTimer() {
  if (meetingTimerInterval) {
    clearInterval(meetingTimerInterval);
  }
  updateMeetingTimer();
  meetingTimerInterval = setInterval(updateMeetingTimer, 1000);
}

function setAvToggleState(button, isOn, label) {
  if (!button) return;
  button.classList.toggle("is-active", isOn);
  button.setAttribute("aria-pressed", isOn ? "true" : "false");
  const text = button.querySelector(".av-toggle-text");
  if (text) {
    text.textContent = `${label} ${isOn ? "On" : "Off"}`;
  }
}

function setTileToggleState(button, isOn) {
  if (!button) return;
  button.classList.toggle("is-active", isOn);
  button.setAttribute("aria-pressed", isOn ? "true" : "false");
}

function setTileControlsEnabled(enabled) {
  if (avTileMic) avTileMic.disabled = !enabled;
  if (avTileCamera) avTileCamera.disabled = !enabled;
  if (leaveBtn) leaveBtn.disabled = !enabled;
}

function resetAvToggles() {
  setAvToggleState(avMicBtn, false, "Mic");
  setAvToggleState(avCameraBtn, false, "Camera");
  if (avMicBtn) avMicBtn.disabled = true;
  if (avCameraBtn) avCameraBtn.disabled = true;
  setTileToggleState(avTileMic, false);
  setTileToggleState(avTileCamera, false);
  setTileControlsEnabled(false);
  if (avLocalTile) {
    avLocalTile.classList.remove("has-video");
    setTileStatusIcons(avLocalTile, false, false);
  }
}

function stopPreviewTracks() {
  if (localPreviewAudioTrack) {
    detachTrack(localPreviewAudioTrack, avLocal);
    localPreviewAudioTrack.stop();
    localPreviewAudioTrack = null;
  }
  if (localPreviewVideoTrack) {
    detachTrack(localPreviewVideoTrack, avLocal);
    localPreviewVideoTrack.stop();
    localPreviewVideoTrack = null;
  }
}

function attachTrack(track, container) {
  if (!container) return;
  const element = track.attach();
  container.appendChild(element);
}

function detachTrack(track, container) {
  if (!container) return;
  const elements = track.detach();
  elements.forEach((el) => el.remove());
}

function clearMediaContainer(container) {
  if (!container) return;
  container.querySelectorAll("video, audio").forEach((el) => el.remove());
}

function setTileVideoState(tile, hasVideo) {
  if (!tile) return;
  tile.classList.toggle("has-video", hasVideo);
}

function updateLocalName(displayName) {
  const name = displayName || "You";
  const label = formatDisplayName(name);
  if (avLocalTile) {
    avLocalTile.dataset.displayName = name;
  }
  if (avLocalName) avLocalName.textContent = label;
  if (avLocalOverlay) avLocalOverlay.textContent = label;
  if (avLocalPlaceholder) avLocalPlaceholder.textContent = label;
}

function getParticipantKey(participant) {
  if (!participant) return "unknown";
  return participant.sid || participant.identity || participant.name || "unknown";
}

function getParticipantLabel(participant) {
  if (!participant) return "Participant";
  return formatDisplayName(participant.name || participant.identity || "Participant");
}

function getOrCreateRemoteTile(participant) {
  if (!avGrid || !participant) return null;
  const key = getParticipantKey(participant);
  if (remoteTiles.has(key)) {
    return remoteTiles.get(key);
  }
  const tile = document.createElement("div");
  tile.className = "av-tile";
  tile.dataset.participant = key;
  tile.innerHTML = `
    <div class="av-tile-header">
      <span class="av-name"></span>
    </div>
    <div class="av-media">
      <div class="av-media-track"></div>
      <div class="av-media-status">
        <span class="av-status-icon mic" data-state="off" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/>
          </svg>
        </span>
        <span class="av-status-icon cam" data-state="off" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M15 8l4-3v14l-4-3v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2z"/>
          </svg>
        </span>
      </div>
      <div class="av-name-overlay"></div>
      <div class="av-name-placeholder"></div>
    </div>
  `;
  const name = getParticipantLabel(participant);
  const nameEl = tile.querySelector(".av-name");
  const overlayEl = tile.querySelector(".av-name-overlay");
  const placeholderEl = tile.querySelector(".av-name-placeholder");
  if (nameEl) nameEl.textContent = name;
  if (overlayEl) overlayEl.textContent = name;
  if (placeholderEl) placeholderEl.textContent = name;
  tile.dataset.displayName = participant.name || participant.identity || "";
  const media = tile.querySelector(".av-media-track");
  avGrid.appendChild(tile);
  updateAvGridLayout();
  const info = { key, tile, media, participant };
  remoteTiles.set(key, info);
  return info;
}

function updateRemoteTileState(participant) {
  if (!participant) return;
  const key = getParticipantKey(participant);
  const info = remoteTiles.get(key);
  if (!info) return;
  let micOn = false;
  let camOn = false;
  const audioTracks = participant.audioTracks;
  const videoTracks = participant.videoTracks;
  if (audioTracks && typeof audioTracks.forEach === "function") {
    audioTracks.forEach((pub) => {
      if (pub && pub.track) {
        micOn = true;
      }
    });
  }
  if (videoTracks && typeof videoTracks.forEach === "function") {
    videoTracks.forEach((pub) => {
      if (pub && pub.track) {
        camOn = true;
      }
    });
  }
  if (!audioTracks || !videoTracks) {
    const tracks = participant.tracks;
    if (tracks && typeof tracks.forEach === "function") {
      tracks.forEach((pub) => {
        const kind = pub && (pub.kind || (pub.track && pub.track.kind));
        if (!kind) return;
        if (kind === "audio" && pub && pub.track) {
          micOn = true;
        }
        if (kind === "video" && pub && pub.track) {
          camOn = true;
        }
      });
    }
  }
  if (!camOn && info.media) {
    camOn = !!info.media.querySelector("video");
  }
  if (!micOn && info.media) {
    micOn = !!info.media.querySelector("audio");
  }
  setTileVideoState(info.tile, camOn);
  setTileStatusIcons(info.tile, micOn, camOn);
}

function removeRemoteTile(participant) {
  if (!participant) return;
  const key = getParticipantKey(participant);
  const info = remoteTiles.get(key);
  if (!info) return;
  info.tile.remove();
  remoteTiles.delete(key);
  updateAvGridLayout();
}

function clearRemoteTiles() {
  remoteTiles.forEach((info) => {
    info.tile.remove();
  });
  remoteTiles.clear();
  updateAvGridLayout();
}

function setJoinFormVisibility(show) {
  if (joinForm) joinForm.hidden = !show;
  if (joinSummary) joinSummary.hidden = show;
}

function updateJoinSummary(meetingId, displayName, host) {
  if (!joinSummaryTitle || !joinSummaryDetails) return;
  joinSummaryTitle.textContent = host ? "Host" : "Guest";
  joinSummaryDetails.textContent = `Meeting ${meetingId} • ${displayName}`;
}

function updateJoinButtonLabel() {
  if (!joinBtn) return;
  const hostToken = joinHostTokenInput ? joinHostTokenInput.value.trim() : "";
  joinBtn.textContent = hostToken ? "Join as Host" : "Request to Join";
}

 

function renderJoinRequests(meetingId, hostToken, pending) {
  if (!requestPanel || !requestList || !requestCount) return;
  const hasPending = pending.length > 0;
  document.body.classList.toggle("has-requests", hasPending);
  if (!hasPending) {
    requestPanel.hidden = true;
    requestList.textContent = "";
    requestCount.textContent = "0";
    lastPendingCount = 0;
    if (!sidePanelPinned) {
      setSidePanelVisible(false, false);
    }
    return;
  }
  requestPanel.hidden = false;
  requestList.textContent = "";
  requestCount.textContent = String(pending.length);
  setSidePanelVisible(true, false);
  if (pending.length > lastPendingCount) {
    showToast("New join request waiting for approval.", false);
  }
  lastPendingCount = pending.length;
  pending.forEach((participant) => {
    const item = document.createElement("li");
    item.className = "request-item";
    const name = document.createElement("span");
    name.textContent = participant.display_name || "Guest";
    const actions = document.createElement("div");
    actions.className = "request-actions";

    const approveBtn = document.createElement("button");
    approveBtn.className = "btn-approve";
    approveBtn.textContent = "Approve";
    approveBtn.addEventListener("click", () => {
      updateApproval(meetingId, hostToken, participant.session_token, "approve");
    });

    const denyBtn = document.createElement("button");
    denyBtn.className = "btn-deny";
    denyBtn.textContent = "Deny";
    denyBtn.addEventListener("click", () => {
      updateApproval(meetingId, hostToken, participant.session_token, "deny");
    });

    actions.appendChild(approveBtn);
    actions.appendChild(denyBtn);
    item.appendChild(name);
    item.appendChild(actions);
    requestList.appendChild(item);
  });
}

async function leaveLiveKit() {
  if (!livekitRoom) {
    resetAvToggles();
    stopPreviewTracks();
    previewMode = false;
    localAudioTrack = null;
    localVideoTrack = null;
    return;
  }
  const room = livekitRoom;
  livekitRoom = null;
  resetAvToggles();
  try {
    const localParticipant = room.localParticipant;
    const localTracks = localParticipant ? localParticipant.tracks : null;
    if (localTracks && typeof localTracks.forEach === "function") {
      localTracks.forEach((pub) => {
        if (pub && pub.track) {
          detachTrack(pub.track, avLocal);
          pub.track.stop();
        }
        if (localParticipant && typeof localParticipant.unpublishTrack === "function") {
          if (pub && pub.track) {
            localParticipant.unpublishTrack(pub.track);
          } else if (pub && pub.trackSid) {
            localParticipant.unpublishTrack(pub.trackSid);
          }
        }
      });
    }
    const remoteParticipants = room.remoteParticipants;
    if (remoteParticipants && typeof remoteParticipants.forEach === "function") {
      remoteParticipants.forEach((participant) => {
        const remoteTracks = participant ? participant.tracks : null;
        if (remoteTracks && typeof remoteTracks.forEach === "function") {
          remoteTracks.forEach((pub) => {
            if (pub && pub.track) {
              const key = getParticipantKey(participant);
              const info = remoteTiles.get(key);
              if (info && info.media) {
                detachTrack(pub.track, info.media);
              }
            }
          });
        }
      });
    }
    await room.disconnect();
    setAvStatus("AV disconnected.", false);
  } catch (err) {
    setAvStatus(`AV disconnect error: ${err.message}`, true);
  } finally {
    clearMediaContainer(avLocal);
    clearRemoteTiles();
    setTileVideoState(avLocalTile, false);
    stopPreviewTracks();
    previewMode = false;
    localAudioTrack = null;
    localVideoTrack = null;
    resetAvToggles();
  }
}

async function joinLiveKit(meetingId) {
  if (!window.LivekitClient) {
    setAvStatus("LiveKit client not loaded.", true);
    return;
  }
  if (!sessionToken) {
    setAvStatus("Join the meeting first.", true);
    return;
  }
  if (livekitRoom) {
    return;
  }
  setAvStatus("Connecting to AV...", false);
  resetAvToggles();
  stopPreviewTracks();
  previewMode = false;

  try {
    const res = await fetch(`${API_BASE}/livekit_token.php?meeting_id=${encodeURIComponent(meetingId)}&session_token=${encodeURIComponent(sessionToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device: "web" })
    });
    const data = await res.json();
    if (!res.ok) {
      setAvStatus(data.error || "Unable to get AV token.", true);
      return;
    }

    const { Room, RoomEvent } = LivekitClient;
    livekitRoom = new Room({ autoSubscribe: true });
    logDebug(`token ok room=${data.room || "?"} identity=${data.participant || "?"}`);
    livekitRoom
      .on(RoomEvent.ParticipantConnected, (participant) => {
        if (participant && participant.isLocal) {
          return;
        }
        logDebug(`participant connected ${participant && (participant.name || participant.identity || participant.sid)}`);
        const info = getOrCreateRemoteTile(participant);
        if (info) {
          updateRemoteTileState(participant);
        }
      })
      .on(RoomEvent.TrackPublished, (publication, participant) => {
        if (!participant || participant.isLocal || !publication) {
          return;
        }
        logDebug(`track published ${publication.kind || "?"} by ${participant.name || participant.identity || "?"}`);
        if (typeof publication.setSubscribed === "function") {
          publication.setSubscribed(true);
        }
      })
      .on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
        if (participant && participant.isLocal) {
          return;
        }
        logDebug(`track subscribed ${track.kind} from ${participant && (participant.name || participant.identity || "?")}`);
        const info = getOrCreateRemoteTile(participant);
        if (info && info.media) {
          attachTrack(track, info.media);
          if (track && track.kind === "video") {
            setTileVideoState(info.tile, true);
          }
          updateRemoteTileState(participant);
        }
      })
      .on(RoomEvent.TrackUnsubscribed, (track, _publication, participant) => {
        if (participant && participant.isLocal) {
          return;
        }
        logDebug(`track unsubscribed ${track.kind} from ${participant && (participant.name || participant.identity || "?")}`);
        const info = getOrCreateRemoteTile(participant);
        if (info && info.media) {
          detachTrack(track, info.media);
          if (track && track.kind === "video") {
            setTileVideoState(info.tile, false);
          }
          updateRemoteTileState(participant);
        }
      })
      .on(RoomEvent.ParticipantDisconnected, (participant) => {
        logDebug(`participant disconnected ${participant && (participant.name || participant.identity || "?")}`);
        removeRemoteTile(participant);
      });

    await livekitRoom.connect(data.url, data.token);
    logDebug(`connected url=${data.url}`);
    const remoteParticipants = livekitRoom.remoteParticipants;
    if (remoteParticipants && typeof remoteParticipants.forEach === "function") {
      remoteParticipants.forEach((participant) => {
        const remoteTracks = participant ? participant.tracks : null;
        if (remoteTracks && typeof remoteTracks.forEach === "function") {
          const info = getOrCreateRemoteTile(participant);
          remoteTracks.forEach((pub) => {
            if (pub && typeof pub.setSubscribed === "function") {
              pub.setSubscribed(true);
            }
            if (pub && pub.track && info && info.media) {
              attachTrack(pub.track, info.media);
            }
          });
          updateRemoteTileState(participant);
        } else {
          const info = getOrCreateRemoteTile(participant);
          if (info) {
            updateRemoteTileState(participant);
          }
        }
      });
    }
    logDebug(`remote participants ${remoteParticipants ? remoteParticipants.size : 0}`);
    if (avMicBtn) avMicBtn.disabled = false;
    if (avCameraBtn) avCameraBtn.disabled = false;
    setTileControlsEnabled(true);
    setAvToggleState(avMicBtn, false, "Mic");
    setAvToggleState(avCameraBtn, false, "Camera");
    setTileToggleState(avTileMic, false);
    setTileToggleState(avTileCamera, false);
    setAvStatus("AV connected. Mic and camera are off.", false);
    if (restoreAvState) {
      if (restoreAvState.micOn) {
        await toggleMicrophone();
      }
      if (restoreAvState.cameraOn) {
        await toggleCamera();
      }
      restoreAvState = null;
    }
    syncAvStatus();
  } catch (err) {
    setAvStatus(`AV error: ${err.message}`, true);
    if (livekitRoom) {
      await leaveLiveKit();
    }
  }
}

async function toggleMicrophone() {
  try {
    if (!livekitRoom) {
      if (!previewMode) {
        setAvStatus("AV is not connected.", true);
        return;
      }
      if (localPreviewAudioTrack) {
        detachTrack(localPreviewAudioTrack, avLocal);
        localPreviewAudioTrack.stop();
        localPreviewAudioTrack = null;
        setAvToggleState(avMicBtn, false, "Mic");
        setTileToggleState(avTileMic, false);
        syncAvStatus();
        const stored = loadStoredJoin();
        if (stored) {
          storeJoin({ ...stored, micOn: false });
        }
        return;
      }
      const { createLocalAudioTrack } = LivekitClient;
      localPreviewAudioTrack = await createLocalAudioTrack();
      attachTrack(localPreviewAudioTrack, avLocal);
      setAvToggleState(avMicBtn, true, "Mic");
      setTileToggleState(avTileMic, true);
      syncAvStatus();
      const stored = loadStoredJoin();
      if (stored) {
        storeJoin({ ...stored, micOn: true });
      }
      return;
    }
    if (localAudioTrack) {
      livekitRoom.localParticipant.unpublishTrack(localAudioTrack);
      detachTrack(localAudioTrack, avLocal);
      localAudioTrack.stop();
      localAudioTrack = null;
      setAvToggleState(avMicBtn, false, "Mic");
      setTileToggleState(avTileMic, false);
      syncAvStatus();
      const stored = loadStoredJoin();
      if (stored) {
        storeJoin({ ...stored, micOn: false });
      }
      return;
    }
    const { createLocalAudioTrack } = LivekitClient;
    localAudioTrack = await createLocalAudioTrack();
    livekitRoom.localParticipant.publishTrack(localAudioTrack);
    attachTrack(localAudioTrack, avLocal);
    setAvToggleState(avMicBtn, true, "Mic");
    setTileToggleState(avTileMic, true);
    syncAvStatus();
    const stored = loadStoredJoin();
    if (stored) {
      storeJoin({ ...stored, micOn: true });
    }
  } catch (err) {
    setAvStatus(`Microphone error: ${err.message}`, true);
  }
}

async function toggleCamera() {
  try {
    if (!livekitRoom) {
      if (!previewMode) {
        setAvStatus("AV is not connected.", true);
        return;
      }
      if (localPreviewVideoTrack) {
        detachTrack(localPreviewVideoTrack, avLocal);
        localPreviewVideoTrack.stop();
        localPreviewVideoTrack = null;
        clearMediaContainer(avLocal);
        setAvToggleState(avCameraBtn, false, "Camera");
        setTileToggleState(avTileCamera, false);
        setTileVideoState(avLocalTile, false);
        syncAvStatus();
        const stored = loadStoredJoin();
        if (stored) {
          storeJoin({ ...stored, cameraOn: false });
        }
        return;
      }
      const { createLocalVideoTrack } = LivekitClient;
      localPreviewVideoTrack = await createLocalVideoTrack();
      attachTrack(localPreviewVideoTrack, avLocal);
      setAvToggleState(avCameraBtn, true, "Camera");
      setTileToggleState(avTileCamera, true);
      setTileVideoState(avLocalTile, true);
      syncAvStatus();
      const stored = loadStoredJoin();
      if (stored) {
        storeJoin({ ...stored, cameraOn: true });
      }
      return;
    }
    if (localVideoTrack) {
      livekitRoom.localParticipant.unpublishTrack(localVideoTrack);
      detachTrack(localVideoTrack, avLocal);
      localVideoTrack.stop();
      localVideoTrack = null;
      clearMediaContainer(avLocal);
      setAvToggleState(avCameraBtn, false, "Camera");
      setTileToggleState(avTileCamera, false);
      setTileVideoState(avLocalTile, false);
      syncAvStatus();
      const stored = loadStoredJoin();
      if (stored) {
        storeJoin({ ...stored, cameraOn: false });
      }
      return;
    }
    const { createLocalVideoTrack } = LivekitClient;
    localVideoTrack = await createLocalVideoTrack();
    livekitRoom.localParticipant.publishTrack(localVideoTrack);
    attachTrack(localVideoTrack, avLocal);
    setAvToggleState(avCameraBtn, true, "Camera");
    setTileToggleState(avTileCamera, true);
    setTileVideoState(avLocalTile, true);
    syncAvStatus();
    const stored = loadStoredJoin();
    if (stored) {
      storeJoin({ ...stored, cameraOn: true });
    }
  } catch (err) {
    setAvStatus(`Camera error: ${err.message}`, true);
  }
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return { ok: true };
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  return { ok: copied, text };
}

if (copyButtons.length) {
  copyButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const targetId = button.getAttribute("data-copy-target");
      const statusId = button.getAttribute("data-status-target");
      const target = targetId ? document.getElementById(targetId) : null;
      const statusEl = statusId ? document.getElementById(statusId) : null;
      let text = "";
      if (target) {
        text = typeof target.value === "string" ? target.value.trim() : target.textContent.trim();
      }

      if (!text) {
        setCopyStatus(statusEl, "No details to copy.", true);
        return;
      }

      try {
        const result = await copyTextToClipboard(text);
        if (result && result.ok) {
          setCopyStatus(statusEl, "Copied to clipboard.", false);
          scheduleStatusClear(statusEl);
          showToast("Copied to clipboard.", false);
          return;
        }
        setCopyStatus(statusEl, "Copy blocked on HTTP. Click output and press Ctrl+C.", true);
        scheduleStatusClear(statusEl);
        showToast("Copy blocked on HTTP. Press Ctrl+C.", true);
        if (target && typeof target.select === "function") {
          target.focus();
          target.select();
        } else if (target) {
          const range = document.createRange();
          range.selectNodeContents(target);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } catch (err) {
        setCopyStatus(statusEl, "Copy blocked on HTTP. Click output and press Ctrl+C.", true);
        scheduleStatusClear(statusEl);
        showToast("Copy blocked on HTTP. Press Ctrl+C.", true);
      }
    });
  });
}

if (joinMeetingInput) {
  const urlParams = new URLSearchParams(window.location.search);
  const meetingIdFromUrl = urlParams.get("meetingId");
  const hostTokenFromUrl = urlParams.get("hostToken");
  if (meetingIdFromUrl) {
    joinMeetingInput.value = meetingIdFromUrl;
  }
  if (hostTokenFromUrl && joinHostTokenInput) {
    joinHostTokenInput.value = hostTokenFromUrl;
    if (joinPasswordInput) {
      joinPasswordInput.value = "";
      joinPasswordInput.placeholder = "Not required for host";
      joinPasswordInput.disabled = true;
    }
    if (joinHostBanner) {
      joinHostBanner.textContent = "Host link detected. Join as host.";
    }
    updateJoinButtonLabel();
  }

  const stored = loadStoredJoin();
  if (stored) {
    if (!joinMeetingInput.value && stored.meetingId) {
      joinMeetingInput.value = stored.meetingId;
    }
    if (joinHostTokenInput && !joinHostTokenInput.value && stored.hostToken) {
      joinHostTokenInput.value = stored.hostToken;
    }
    const displayInput = document.getElementById("join-display");
    if (displayInput && !displayInput.value && stored.displayName) {
      displayInput.value = stored.displayName;
    }
  }
}

function renderLinks(output, data) {
  let joinLink = data.join_link;
  let hostLink = data.host_link;
  if (joinLink && joinLink.startsWith("/")) {
    joinLink = `${window.location.origin}${joinLink}`;
  }
  if (hostLink && hostLink.startsWith("/")) {
    hostLink = `${window.location.origin}${hostLink}`;
  }
  if (output) {
    output.hidden = false;
  }
  const prefix = output && output.id ? output.id.replace("-output", "") : "";
  const linkBlock = prefix ? document.getElementById(`${prefix}-links`) : null;
  const joinField = prefix ? document.getElementById(`${prefix}-join-link`) : null;
  const hostField = prefix ? document.getElementById(`${prefix}-host-link`) : null;
  const joinOpen = prefix ? document.getElementById(`${prefix}-join-open`) : null;
  const hostOpen = prefix ? document.getElementById(`${prefix}-host-open`) : null;
  const details = [
    `Meeting ID: ${data.meeting_id}`,
    `Title: ${data.title || "-"}`
  ];
  if (data.meeting_type === "scheduled" && data.scheduled_start) {
    details.push(`Scheduled Start: ${data.scheduled_start}`);
    if (data.duration_minutes) {
      details.push(`Duration: ${data.duration_minutes} minutes`);
    }
  }
  const joinDetails = joinLink ? [...details, `Join Link: ${joinLink}`] : details;
  const hostDetails = hostLink ? [...details, `Host Link: ${hostLink}`] : details;
  if (joinField) joinField.value = joinDetails.join("\n");
  if (hostField) hostField.value = hostDetails.join("\n");
  if (joinOpen) {
    joinOpen.href = joinLink || "#";
    joinOpen.hidden = !joinLink;
  }
  if (hostOpen) {
    hostOpen.href = hostLink || "#";
    hostOpen.hidden = !hostLink;
  }
  if (linkBlock) {
    linkBlock.hidden = !joinLink && !hostLink;
  }
  const lines = details;
  output.textContent = lines.join("\n");
}

if (createInstantBtn) {
  createInstantBtn.addEventListener("click", async () => {
    const output = document.getElementById("create-output");
    const linkBlock = document.getElementById("create-links");

    const payload = { type: "instant" };

    try {
      const res = await fetch(`${API_BASE}/meetings.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        output.textContent = JSON.stringify(data, null, 2);
        output.hidden = false;
        if (linkBlock) linkBlock.hidden = true;
        return;
      }

      renderLinks(output, data);
    } catch (err) {
      output.textContent = `Error: ${err.message}`;
      output.hidden = false;
      if (linkBlock) linkBlock.hidden = true;
    }
  });
}

if (createScheduledBtn) {
  createScheduledBtn.addEventListener("click", async () => {
    const title = document.getElementById("schedule-title").value.trim();
    const date = document.getElementById("schedule-date").value.trim();
    const time = document.getElementById("schedule-time").value.trim();
    const duration = document.getElementById("schedule-duration").value.trim();
    const password = document.getElementById("schedule-password").value.trim();
    const createdBy = document.getElementById("schedule-createdby").value.trim();
    const output = document.getElementById("schedule-output");
    const linkBlock = document.getElementById("schedule-links");

    if (!title || !date || !time || !duration) {
      output.textContent = "Title, date, time, and duration are required.";
      output.hidden = false;
      if (linkBlock) linkBlock.hidden = true;
      return;
    }

    const payload = {
      type: "scheduled",
      title,
      scheduled_date: date,
      scheduled_time: time,
      duration_minutes: Number(duration),
      password: password || "",
      created_by: createdBy || null
    };

    try {
      const res = await fetch(`${API_BASE}/meetings.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        output.textContent = JSON.stringify(data, null, 2);
        output.hidden = false;
        if (linkBlock) linkBlock.hidden = true;
        return;
      }

      renderLinks(output, data);
    } catch (err) {
      output.textContent = `Error: ${err.message}`;
      output.hidden = false;
      if (linkBlock) linkBlock.hidden = true;
    }
  });
}

if (scheduleToggleBtn && scheduleForm) {
  scheduleToggleBtn.addEventListener("click", () => {
    const isHidden = scheduleForm.hidden;
    scheduleForm.hidden = !isHidden;
    scheduleToggleBtn.textContent = isHidden ? "Hide Scheduled Form" : "Create Scheduled Meeting";
  });
}

async function handleJoin(isAuto) {
  const meetingId = document.getElementById("join-meetingid").value.trim();
  const password = joinPasswordInput ? joinPasswordInput.value.trim() : "";
  const hostToken = joinHostTokenInput ? joinHostTokenInput.value.trim() : "";
  const displayName = document.getElementById("join-display").value.trim();
  const output = document.getElementById("join-output");
  const stored = loadStoredJoin();
  const isHostLink = hostToken !== "";
  const storedSessionToken = stored && stored.meetingId === meetingId ? stored.sessionToken : "";

  if (!meetingId || !displayName) {
    if (!isAuto) {
      const missing = [];
      if (!meetingId) missing.push("Meeting ID");
      if (!displayName) missing.push("Name");
      output.textContent = `Missing: ${missing.join(", ")}.`;
    }
    return;
  }

  const payload = {
    password,
    display_name: displayName,
    session_token: stored && stored.isHost !== isHostLink ? "" : (storedSessionToken || "")
  };

  try {
    const hostQuery = hostToken ? `&host_token=${encodeURIComponent(hostToken)}` : "";
    const res = await fetch(`${API_BASE}/join.php?meeting_id=${encodeURIComponent(meetingId)}${hostQuery}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 403 && data.error) {
        if (data.error === "Meeting not started yet") {
          const start = data.scheduled_start ? ` Starts at ${data.scheduled_start}.` : "";
          output.textContent = `Meeting not started yet.${start}`;
          setJoinFormVisibility(true);
          if (hostPanel) hostPanel.hidden = true;
          if (guestPanel) guestPanel.hidden = true;
      if (avPanel) avPanel.hidden = true;
      if (meetingTimerInterval) {
        clearInterval(meetingTimerInterval);
        meetingTimerInterval = null;
      }
      scheduledStart = null;
      scheduledDuration = null;
          if (joinBtn) {
            updateJoinButtonLabel();
            joinBtn.disabled = false;
          }
          return;
        }
        output.textContent = `Waiting for host to join.`;
        return;
      }
      output.textContent = JSON.stringify(data, null, 2);
      return;
    }

    const approvalStatus = data.approval_status || (data.pending ? "pending" : "approved");
    const isPending = approvalStatus === "pending";
    output.textContent = isPending ? "Request sent. Waiting for host approval." : `Joined meeting ${data.meeting_id}.`;
    setJoinFormVisibility(false);
    if (!isPending) {
      document.body.classList.add("in-meeting");
    } else {
      document.body.classList.remove("in-meeting");
    }
    updateJoinSummary(meetingId, displayName, data.is_host);
    updateLocalName(displayName);
    if (data.is_host) {
      hostNames.add(normalizeName(displayName));
      refreshTileNamesFromRoster();
    }
    if (hostPanel) {
      hostPanel.hidden = !data.is_host;
    }
    if (guestPanel) {
      guestPanel.hidden = isPending;
    }
    setSidePanelVisible(false, false);
    if (avPanel) {
      avPanel.hidden = false;
      if (isPending) {
        setAvStatus("Waiting for host approval. You can preview your mic/camera.", false);
      } else {
        setAvStatus("Connecting to AV...", false);
      }
    }
    if (joinBtn) {
      joinBtn.textContent = isPending ? "Requested" : "Joined";
      joinBtn.disabled = true;
    }
    sessionToken = data.session_token || "";
    isHost = !!data.is_host;
    resetAvToggles();

    restoreAvState = { micOn: true, cameraOn: true };
    storeJoin({
      meetingId,
      displayName,
      hostToken: isHost ? hostToken : "",
      sessionToken,
      isHost,
      approvalStatus,
      micOn: true,
      cameraOn: true
    });
    if (isPending) {
      previewMode = true;
      setTileControlsEnabled(true);
    } else {
      joinLiveKit(meetingId);
    }

    if (meetingPoll) {
      clearInterval(meetingPoll);
    }
    meetingPoll = setInterval(() => {
      checkMeetingStatus(meetingId);
      checkSelfStatus(meetingId);
    }, 5000);
    checkSelfStatus(meetingId);

    if (data.is_host && hostToken) {
      if (participantsPoll) {
        clearInterval(participantsPoll);
      }
      participantsPoll = setInterval(() => {
        fetchParticipants(meetingId, hostToken);
      }, 5000);
      fetchParticipants(meetingId, hostToken);
    }
    if (publicPoll) {
      clearInterval(publicPoll);
    }
    publicPoll = setInterval(() => {
      fetchPublicParticipants(meetingId);
    }, 5000);
    fetchPublicParticipants(meetingId);
  } catch (err) {
    output.textContent = `Error: ${err.message}`;
  }
}

if (joinBtn) {
  joinBtn.addEventListener("click", async () => {
    await handleJoin(false);
  });
}

if (joinFormToggle) {
  joinFormToggle.addEventListener("click", () => {
    setJoinFormVisibility(true);
  });
}

if (joinMeetingInput) {
  const stored = loadStoredJoin();
  const urlParams = new URLSearchParams(window.location.search);
  const hostTokenFromUrl = urlParams.get("hostToken");
  const isHostLink = !!hostTokenFromUrl;
  if (stored && stored.meetingId && stored.displayName) {
    if (stored.isHost === isHostLink && !joinMeetingInput.value) {
      joinMeetingInput.value = stored.meetingId;
    }
    if (stored.isHost) {
      if (joinHostTokenInput && !joinHostTokenInput.value && stored.hostToken) {
        joinHostTokenInput.value = stored.hostToken;
      }
      handleJoin(true);
    } else if (stored.approvalStatus === "approved") {
      handleJoin(true);
    }
  }
}

async function checkMeetingStatus(meetingId) {
  const output = document.getElementById("join-output");
  try {
    const res = await fetch(`${API_BASE}/meeting.php?meeting_id=${encodeURIComponent(meetingId)}`);
    const data = await res.json();
    if (!res.ok) {
      output.textContent = JSON.stringify(data, null, 2);
      return;
    }
    if (data.meeting_type === "scheduled" && data.scheduled_start && data.duration_minutes) {
      scheduledStart = data.scheduled_start;
      scheduledDuration = Number(data.duration_minutes) || null;
      if (scheduledDuration) {
        startMeetingTimer();
      }
    }
    if (data.status && data.status !== "active") {
      output.textContent = "Meeting ended.";
      setJoinFormVisibility(true);
      if (hostPanel) {
        hostPanel.hidden = true;
      }
      if (guestPanel) {
        guestPanel.hidden = true;
      }
      if (meetingPoll) {
        clearInterval(meetingPoll);
      }
      if (participantsPoll) {
        clearInterval(participantsPoll);
      }
      if (publicPoll) {
        clearInterval(publicPoll);
      }
      if (avPanel) {
        avPanel.hidden = true;
      }
      await leaveLiveKit();
      clearStoredJoin();
      if (joinBtn) {
        updateJoinButtonLabel();
        joinBtn.disabled = false;
      }
    }
  } catch (err) {
    output.textContent = `Error: ${err.message}`;
  }
}

async function checkSelfStatus(meetingId) {
  if (!sessionToken) {
    return;
  }
  const output = document.getElementById("join-output");
  try {
    const res = await fetch(`${API_BASE}/status.php?meeting_id=${encodeURIComponent(meetingId)}&session_token=${encodeURIComponent(sessionToken)}`);
    const data = await res.json();
    if (!res.ok) {
      return;
    }
    if (data.left_at && !removedNoticeShown) {
      removedNoticeShown = true;
      output.textContent = "You have been removed from the meeting.";
      setJoinFormVisibility(true);
      if (hostPanel) {
        hostPanel.hidden = true;
      }
      if (guestPanel) {
        guestPanel.hidden = true;
      }
      if (joinBtn) {
        updateJoinButtonLabel();
        joinBtn.disabled = false;
      }
      if (meetingPoll) {
        clearInterval(meetingPoll);
      }
      if (participantsPoll) {
        clearInterval(participantsPoll);
      }
      if (publicPoll) {
        clearInterval(publicPoll);
      }
      if (avPanel) {
        avPanel.hidden = true;
      }
      await leaveLiveKit();
      clearStoredJoin();
      return;
    }
    const approvalStatus = data.approval_status || "approved";
    if (approvalStatus === "pending") {
      output.textContent = "Waiting for host approval.";
      document.body.classList.remove("in-meeting");
      if (avPanel) {
        avPanel.hidden = false;
        setAvStatus("Waiting for host approval. You can preview your mic/camera.", false);
      }
      if (guestPanel) {
        guestPanel.hidden = true;
      }
      if (joinBtn) {
        joinBtn.textContent = "Requested";
        joinBtn.disabled = true;
      }
      previewMode = true;
      setTileControlsEnabled(true);
      return;
    }
    if (approvalStatus === "approved" && !livekitRoom) {
      document.body.classList.add("in-meeting");
      if (avPanel) {
        avPanel.hidden = false;
        setAvStatus("Connecting to AV...", false);
      }
      if (guestPanel) {
        guestPanel.hidden = false;
      }
      if (joinBtn) {
        joinBtn.textContent = "Joined";
        joinBtn.disabled = true;
      }
      if (previewMode) {
        stopPreviewTracks();
        previewMode = false;
      }
      joinLiveKit(meetingId);
    }
  } catch (_err) {
    return;
  }
}

async function fetchParticipants(meetingId, hostToken) {
  if (!participantsList) {
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/participants.php?meeting_id=${encodeURIComponent(meetingId)}&host_token=${encodeURIComponent(hostToken)}`);
    const data = await res.json();
    if (!res.ok) {
      return;
    }
    participantsList.textContent = "";
    const pending = [];
    data.participants.forEach((participant) => {
      const approvalStatus = participant.approval_status || "approved";
      if (approvalStatus === "pending") {
        pending.push(participant);
        return;
      }
      const item = document.createElement("li");
      const isHostFlag = Number(participant.is_host) === 1;
      const label = isHostFlag ? `${participant.display_name} (host)` : `${participant.display_name} (user)`;
      let status = "active";
      if (participant.left_at) {
        status = participant.left_reason || "left";
      }
      const line = document.createElement("span");
      line.textContent = `${label} - ${status}`;
      item.appendChild(line);
      if (!isHostFlag && !participant.left_at) {
        const removeBtn = document.createElement("button");
        removeBtn.className = "icon-btn icon-only btn-remove";
        removeBtn.setAttribute("aria-label", "Remove participant");
        removeBtn.innerHTML = `
          <span class="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M7 5h10l-1 14H8L7 5zm3-3h4l1 2H9l1-2z"/>
            </svg>
          </span>
        `;
        removeBtn.addEventListener("click", () => {
          removeParticipant(meetingId, hostToken, participant.session_token);
        });
        item.appendChild(removeBtn);
      }
      participantsList.appendChild(item);
    });
    renderJoinRequests(meetingId, hostToken, pending);
  } catch (_err) {
    return;
  }
}

async function fetchPublicParticipants(meetingId) {
  if (!participantsPublic || !participantsCount) {
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/participants_public.php?meeting_id=${encodeURIComponent(meetingId)}`);
    const data = await res.json();
    if (!res.ok) {
      return;
    }
    participantsCount.textContent = `Active: ${data.active_count}`;
    participantsPublic.textContent = "";
    const nextHostNames = new Set();
    data.participants.forEach((participant) => {
      const item = document.createElement("li");
      const isHostFlag = Number(participant.is_host) === 1;
      if (isHostFlag) {
        nextHostNames.add(normalizeName(participant.display_name));
      }
      const label = isHostFlag ? `${participant.display_name} (host)` : `${participant.display_name} (user)`;
      let status = "active";
      if (participant.left_at) {
        status = participant.left_reason || "left";
      }
      item.textContent = `${label} - ${status}`;
      participantsPublic.appendChild(item);
    });
    hostNames = nextHostNames;
    refreshTileNamesFromRoster();
  } catch (_err) {
    return;
  }
}

async function updateApproval(meetingId, hostToken, sessionTokenValue, action) {
  try {
    await fetch(`${API_BASE}/approve.php?meeting_id=${encodeURIComponent(meetingId)}&host_token=${encodeURIComponent(hostToken)}&session_token=${encodeURIComponent(sessionTokenValue)}&action=${encodeURIComponent(action)}`, {
      method: "POST"
    });
  } catch (_err) {
    return;
  }
}

async function removeParticipant(meetingId, hostToken, sessionTokenValue) {
  try {
    await fetch(`${API_BASE}/remove.php?meeting_id=${encodeURIComponent(meetingId)}&host_token=${encodeURIComponent(hostToken)}&session_token=${encodeURIComponent(sessionTokenValue)}`, {
      method: "POST"
    });
  } catch (_err) {
    return;
  }
}

if (leaveBtn) {
  leaveBtn.addEventListener("click", () => {
    const meetingId = joinMeetingInput ? joinMeetingInput.value.trim() : "";
    const output = document.getElementById("join-output");
    if (meetingId && sessionToken) {
      if (isHost) {
        fetch(`${API_BASE}/stop.php?meeting_id=${encodeURIComponent(meetingId)}&host_token=${encodeURIComponent(joinHostTokenInput ? joinHostTokenInput.value.trim() : "")}`, {
          method: "POST"
        }).then(() => {
          output.textContent = "Meeting ended.";
        }).catch(() => {
          output.textContent = "Meeting ended.";
        });
      } else {
        fetch(`${API_BASE}/leave.php?meeting_id=${encodeURIComponent(meetingId)}&session_token=${encodeURIComponent(sessionToken)}`, {
          method: "POST"
        }).then(() => {
          output.textContent = "You left the meeting.";
        }).catch(() => {
          output.textContent = "You left the meeting.";
        });
      }
    }
    if (meetingPoll) {
      clearInterval(meetingPoll);
    }
    if (participantsPoll) {
      clearInterval(participantsPoll);
    }
    if (publicPoll) {
      clearInterval(publicPoll);
    }
    if (hostPanel) {
      hostPanel.hidden = true;
    }
    if (guestPanel) {
      guestPanel.hidden = true;
    }
    if (avPanel) {
      avPanel.hidden = true;
    }
    leaveLiveKit();
    clearStoredJoin();
    setJoinFormVisibility(true);
    setSidePanelVisible(false, false);
    if (joinBtn) {
      updateJoinButtonLabel();
      joinBtn.disabled = false;
    }
    document.body.classList.remove("in-meeting");
    if (!isHost) {
      window.location.href = "/meeting_app/thankyou.html";
    }
  });
}

if (avMicBtn) {
  avMicBtn.addEventListener("click", async () => {
    await toggleMicrophone();
  });
}

if (avCameraBtn) {
  avCameraBtn.addEventListener("click", async () => {
    await toggleCamera();
  });
}

if (avTileMic) {
  avTileMic.addEventListener("click", async () => {
    await toggleMicrophone();
  });
}

if (avTileCamera) {
  avTileCamera.addEventListener("click", async () => {
    await toggleCamera();
  });
}

if (sideToggleBtn && meetingLayout) {
  sideToggleBtn.addEventListener("click", () => {
    const isHidden = meetingLayout.classList.contains("hide-side");
    if (isHidden) {
      setSidePanelVisible(true, true);
    } else {
      setSidePanelVisible(false, false);
    }
  });
}

if (debugToggleBtn) {
  debugToggleBtn.addEventListener("click", () => {
    if (!debugEnabled) return;
    debugVisible = !debugVisible;
    renderDebugPanel();
  });
}

 
