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
const avStage = document.querySelector(".av-stage");
const avStrip = document.getElementById("av-strip");
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
const shareToggleBtn = document.getElementById("share-toggle-btn");
const chatToggleBtn = document.getElementById("chat-toggle-btn");
const chatPanel = document.getElementById("chat-panel");
const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatSendBtn = document.getElementById("chat-send-btn");
const chatCount = document.getElementById("chat-count");
const chatStatus = document.getElementById("chat-status");
const chatAttachBtn = document.getElementById("chat-attach-btn");
const chatFileInput = document.getElementById("chat-file");
const chatFileInfo = document.getElementById("chat-file-info");
const themeToggleBtn = document.getElementById("theme-toggle-btn");

let meetingPoll = null;
let participantsPoll = null;
let publicPoll = null;
let sessionToken = "";
let isHost = false;
let removedNoticeShown = false;
let livekitRoom = null;
let localAudioTrack = null;
let localVideoTrack = null;
let screenShareTrack = null;
let screenShareTile = null;
let screenShareMedia = null;
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
let chatUnreadCount = 0;
let pendingChatFile = null;

const STORAGE_KEY = "meeting_app_last_join";
const THEME_KEY = "meeting_app_theme";

if (createLinks) createLinks.hidden = true;
if (scheduleLinks) scheduleLinks.hidden = true;
updateAvGridLayout();
window.addEventListener("resize", updateAvGridLayout);
loadUiConfig();
setChatEnabled(false);
updateChatCount();
setShareEnabled(false);
if (themeToggleBtn) {
  applySavedTheme();
}

function applyTheme(theme) {
  const useDark = theme === "dark";
  document.body.classList.toggle("theme-dark", useDark);
  if (themeToggleBtn) {
    themeToggleBtn.textContent = useDark ? "Theme: Dark" : "Theme: Default";
  }
}

function applySavedTheme() {
  const stored = localStorage.getItem(THEME_KEY) || "default";
  applyTheme(stored === "dark" ? "dark" : "default");
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    const nextTheme = document.body.classList.contains("theme-dark") ? "default" : "dark";
    localStorage.setItem(THEME_KEY, nextTheme);
    applyTheme(nextTheme);
  });
}

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

function setChatPanelVisible(visible, pinned) {
  if (!chatPanel) return;
  chatPanel.hidden = !visible;
  if (visible) {
    setSidePanelVisible(true, pinned ?? true);
    chatUnreadCount = 0;
    updateChatCount();
  }
}

function updateChatCount() {
  if (!chatCount) return;
  chatCount.textContent = String(chatUnreadCount);
}

function appendChatMessage({ name, text, self }) {
  if (!chatMessages) return;
  const msg = document.createElement("div");
  msg.className = `chat-message${self ? " self" : ""}`;
  const meta = document.createElement("div");
  meta.className = "chat-meta";
  const label = document.createElement("span");
  label.textContent = name || (self ? "You" : "Guest");
  const time = document.createElement("span");
  time.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  meta.append(label, time);
  const body = document.createElement("div");
  body.textContent = text;
  msg.append(meta, body);
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function clearChatMessages() {
  if (chatMessages) {
    chatMessages.textContent = "";
  }
  chatUnreadCount = 0;
  updateChatCount();
}

function setChatEnabled(enabled) {
  if (chatInput) chatInput.disabled = !enabled;
  if (chatSendBtn) chatSendBtn.disabled = !enabled;
  if (chatAttachBtn) chatAttachBtn.disabled = !enabled;
  if (chatFileInput) chatFileInput.disabled = !enabled;
  if (chatStatus) {
    chatStatus.textContent = enabled ? "Chat is live." : "Chat is available after AV connects.";
    chatStatus.hidden = enabled;
  }
}

function isScreenShareTrack(publication, track) {
  const source = (publication && publication.source) || (track && track.source) || "";
  if (typeof source === "string") {
    return source.toLowerCase().includes("screen");
  }
  if (window.LivekitClient && LivekitClient.Track && LivekitClient.Track.Source) {
    return source === LivekitClient.Track.Source.ScreenShare;
  }
  return false;
}

function setShareButtonState(active) {
  if (!shareToggleBtn) return;
  shareToggleBtn.classList.toggle("is-active", active);
  shareToggleBtn.setAttribute("aria-label", active ? "Stop screen share" : "Share screen");
  shareToggleBtn.title = active ? "Stop screen share" : "Share screen";
}

function setShareEnabled(enabled) {
  if (!shareToggleBtn) return;
  shareToggleBtn.disabled = !enabled;
  if (!enabled) {
    setShareButtonState(false);
  }
}

function updateChatFileInfo() {
  if (!chatFileInfo) return;
  if (!pendingChatFile) {
    chatFileInfo.hidden = true;
    chatFileInfo.textContent = "";
    return;
  }
  chatFileInfo.hidden = false;
  chatFileInfo.textContent = `Selected: ${pendingChatFile.name} (${Math.round(pendingChatFile.size / 1024)} KB)`;
}

function clearPendingChatFile() {
  pendingChatFile = null;
  if (chatFileInput) {
    chatFileInput.value = "";
  }
  updateChatFileInfo();
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBlob(base64, mime) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function appendChatFileMessage({ name, fileName, fileSize, fileUrl, mime, self }) {
  if (!chatMessages) return;
  const msg = document.createElement("div");
  msg.className = `chat-message${self ? " self" : ""}`;
  const meta = document.createElement("div");
  meta.className = "chat-meta";
  const label = document.createElement("span");
  label.textContent = name || (self ? "You" : "Guest");
  const time = document.createElement("span");
  time.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  meta.append(label, time);

  const body = document.createElement("div");
  const link = document.createElement("a");
  link.href = fileUrl;
  link.textContent = `${fileName} (${Math.round(fileSize / 1024)} KB)`;
  link.target = "_blank";
  link.rel = "noopener";
  body.appendChild(link);

  if (mime && mime.startsWith("image/")) {
    const img = document.createElement("img");
    img.src = fileUrl;
    img.alt = fileName;
    img.style.maxWidth = "100%";
    img.style.borderRadius = "8px";
    img.style.marginTop = "6px";
    body.appendChild(img);
  }

  msg.append(meta, body);
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendChatFile(file, displayName) {
  if (!livekitRoom || !file) return;
  try {
    if (file.size > 1024 * 1024) {
      showToast("File too large (max 1MB).", true);
      clearPendingChatFile();
      return;
    }
    const buffer = await file.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    const payload = JSON.stringify({
      type: "file",
      name: file.name,
      mime: file.type || "application/octet-stream",
      size: file.size,
      data: base64,
      sender: displayName || "You"
    });
    const data = new TextEncoder().encode(payload);
    livekitRoom.localParticipant.publishData(data, { reliable: true });
    const blob = base64ToBlob(base64, file.type || "application/octet-stream");
    const url = URL.createObjectURL(blob);
    appendChatFileMessage({
      name: "You",
      fileName: file.name,
      fileSize: file.size,
      fileUrl: url,
      mime: file.type || "application/octet-stream",
      self: true
    });
    clearPendingChatFile();
  } catch (err) {
    showToast("Unable to send file.", true);
  }
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
  if (!avGrid || !avStage) return;
  const hasShare = syncShareTiles();
  const gridTiles = Array.from(avGrid.querySelectorAll(".av-tile")).filter((tile) => !tile.hidden);
  const stripTiles = avStrip
    ? Array.from(avStrip.querySelectorAll(".av-tile")).filter((tile) => !tile.hidden)
    : [];
  const allTiles = gridTiles.concat(stripTiles);
  const gap = 12;
  const padding = 8 * 2;

  if (hasShare) {
    syncShareAvailability(true);
    if (avStage) avStage.classList.add("has-share");
    avGrid.classList.add("screen-share");
    if (avStrip) avStrip.hidden = false;
    const stripCount = allTiles.filter((tile) => !tile.classList.contains("av-tile-share")).length || 1;
    const stripHeight = 120;
    if (avStage) {
      avStage.style.setProperty("--share-strip-height", `${stripHeight}px`);
      const available = Math.max(0, avStage.clientWidth - padding - gap * (stripCount - 1));
      const tileSize = Math.max(90, Math.min(140, Math.floor(available / stripCount)));
      avStage.style.setProperty("--strip-tile-size", `${tileSize}px`);
    }
    const mediaMin = Math.max(200, avStage.clientHeight - stripHeight - padding - gap);
    avGrid.style.setProperty("--tile-media-min", `${mediaMin}px`);
    return;
  }

  syncShareAvailability(false);
  if (avStage) {
    avStage.classList.remove("has-share");
    avStage.style.removeProperty("--share-strip-height");
    avStage.style.removeProperty("--strip-tile-size");
  }
  avGrid.classList.remove("screen-share");
  if (avStrip) {
    avStrip.hidden = true;
  }
  const count = allTiles.length;
  const minTile = 220;
  const gridWidth = Math.max(0, avGrid.clientWidth - padding);
  const maxCols = Math.max(1, Math.floor((gridWidth + gap) / (minTile + gap)));
  const cols = Math.max(1, Math.min(count || 1, maxCols));
  avGrid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  const rows = Math.max(1, Math.ceil(count / cols));
  const stageHeight = avStage.clientHeight;
  const tileHeight = Math.floor((stageHeight - padding - gap * (rows - 1)) / rows);
  const mediaMin = Math.max(120, tileHeight - 64);
  avGrid.style.setProperty("--tile-media-min", `${mediaMin}px`);
}

function syncShareAvailability(hasShare) {
  if (!shareToggleBtn) return;
  if (hasShare && !screenShareTrack) {
    shareToggleBtn.disabled = true;
    shareToggleBtn.title = "Another participant is sharing.";
  } else {
    shareToggleBtn.disabled = !livekitRoom;
    if (!shareToggleBtn.disabled) {
      shareToggleBtn.title = shareToggleBtn.classList.contains("is-active")
        ? "Stop screen share"
        : "Share screen";
    } else {
      shareToggleBtn.title = "";
    }
  }
}

function syncShareTiles() {
  if (!avGrid) return false;
  const gridTiles = Array.from(avGrid.querySelectorAll(".av-tile"));
  const stripTiles = avStrip ? Array.from(avStrip.querySelectorAll(".av-tile")) : [];
  const allTiles = gridTiles.concat(stripTiles);
  const shareTiles = allTiles.filter((tile) => tile.classList.contains("av-tile-share"));
  const hasShare = shareTiles.length > 0;

  if (hasShare) {
    if (!screenShareTrack && avLocalTile) {
      avLocalTile.hidden = false;
    }
    if (avStrip) avStrip.hidden = false;
    allTiles.forEach((tile) => {
      if (tile.classList.contains("av-tile-share")) {
        if (tile.parentElement !== avGrid) {
          avGrid.appendChild(tile);
        }
      } else if (avStrip && tile.parentElement !== avStrip) {
        avStrip.appendChild(tile);
      }
    });
  } else {
    if (avStrip) avStrip.hidden = true;
    allTiles.forEach((tile) => {
      if (tile.parentElement !== avGrid) {
        avGrid.appendChild(tile);
      }
    });
  }

  return hasShare;
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

function syncStageControls() {
  if (avMicBtn) {
    avMicBtn.classList.toggle("is-active", avTileMic && avTileMic.classList.contains("is-active"));
  }
  if (avCameraBtn) {
    avCameraBtn.classList.toggle("is-active", avTileCamera && avTileCamera.classList.contains("is-active"));
  }
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
  syncStageControls();
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

function getParticipantKey(participant, type = "camera") {
  if (!participant) return `unknown:${type}`;
  const base = participant.sid || participant.identity || participant.name || "unknown";
  return `${base}:${type}`;
}

function getParticipantLabel(participant) {
  if (!participant) return "Participant";
  return formatDisplayName(participant.name || participant.identity || "Participant");
}

function getOrCreateRemoteTile(participant, type = "camera") {
  if (!avGrid || !participant) return null;
  const key = getParticipantKey(participant, type);
  if (remoteTiles.has(key)) {
    return remoteTiles.get(key);
  }
  const tile = document.createElement("div");
  tile.className = type === "screen" ? "av-tile av-tile-share" : "av-tile";
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
  const nameBase = getParticipantLabel(participant);
  const name = type === "screen" ? `${nameBase} (Screen)` : nameBase;
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
  const info = { key, tile, media, participant, type };
  remoteTiles.set(key, info);
  return info;
}

function getRemoteTile(participant, type = "camera") {
  if (!participant) return null;
  const key = getParticipantKey(participant, type);
  return remoteTiles.get(key) || null;
}

function reconcileRemoteParticipants() {
  if (!livekitRoom || !avGrid) return;
  const remotes = livekitRoom.remoteParticipants;
  if (!remotes || typeof remotes.forEach !== "function") return;
  const allowedKeys = new Set();
  remotes.forEach((participant) => {
    if (!participant) return;
    allowedKeys.add(getParticipantKey(participant, "camera"));
    const info = getOrCreateRemoteTile(participant);
    if (!info || !info.media) return;
    const pubs = [];
    const videoTracks = participant.videoTracks;
    const audioTracks = participant.audioTracks;
    if (videoTracks && typeof videoTracks.forEach === "function") {
      videoTracks.forEach((pub) => pubs.push(pub));
    }
    if (audioTracks && typeof audioTracks.forEach === "function") {
      audioTracks.forEach((pub) => pubs.push(pub));
    }
    if (pubs.length === 0 && participant.tracks && typeof participant.tracks.forEach === "function") {
      participant.tracks.forEach((pub) => pubs.push(pub));
    }
    pubs.forEach((pub) => {
      if (!pub || !pub.track) return;
      const kind = pub.track.kind || pub.kind;
      if (kind === "video" && !info.media.querySelector("video")) {
        if (!isScreenShareTrack(pub, pub.track)) {
          attachTrack(pub.track, info.media);
          setTileVideoState(info.tile, true);
        } else {
          allowedKeys.add(getParticipantKey(participant, "screen"));
        }
      }
      if (kind === "audio" && !info.media.querySelector("audio")) {
        attachTrack(pub.track, info.media);
      }
      if (isScreenShareTrack(pub, pub.track)) {
        allowedKeys.add(getParticipantKey(participant, "screen"));
      }
    });
    updateRemoteTileState(participant);
  });
  const staleKeys = [];
  remoteTiles.forEach((info, key) => {
    if (!allowedKeys.has(key)) {
      info.tile.remove();
      staleKeys.push(key);
    }
  });
  staleKeys.forEach((key) => remoteTiles.delete(key));
  updateAvGridLayout();
}

function updateRemoteTileState(participant) {
  if (!participant) return;
  const key = getParticipantKey(participant, "camera");
  const info = remoteTiles.get(key);
  if (!info) return;
  let micOn = false;
  let camOn = false;
  let videoTrack = null;
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
        if (!isScreenShareTrack(pub, pub.track)) {
          camOn = true;
          if (!videoTrack) {
            videoTrack = pub.track;
          }
        }
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
        if (kind === "video" && pub && pub.track && !isScreenShareTrack(pub, pub.track)) {
          camOn = true;
          if (!videoTrack) {
            videoTrack = pub.track;
          }
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
  if (videoTrack && info.media && !info.media.querySelector("video")) {
    attachTrack(videoTrack, info.media);
  }
  setTileVideoState(info.tile, camOn);
  setTileStatusIcons(info.tile, micOn, camOn);
}

function removeRemoteTile(participant, type) {
  if (!participant) return;
  const types = type ? [type] : ["camera", "screen"];
  types.forEach((t) => {
    const key = getParticipantKey(participant, t);
    const info = remoteTiles.get(key);
    if (!info) return;
    info.tile.remove();
    remoteTiles.delete(key);
  });
  updateAvGridLayout();
}

function clearRemoteTiles() {
  remoteTiles.forEach((info) => {
    info.tile.remove();
  });
  remoteTiles.clear();
  updateAvGridLayout();
}

function ensureScreenShareTile() {
  if (!avGrid || screenShareTile) return;
  const tile = document.createElement("div");
  tile.className = "av-tile av-tile-share";
  tile.dataset.participant = "local:screen";
  tile.innerHTML = `
    <div class="av-tile-header">
      <span class="av-name">You (Screen)</span>
    </div>
    <div class="av-media">
      <div class="av-media-track"></div>
      <div class="av-name-overlay">You (Screen)</div>
      <div class="av-name-placeholder">You (Screen)</div>
    </div>
  `;
  screenShareTile = tile;
  screenShareMedia = tile.querySelector(".av-media-track");
  avGrid.appendChild(tile);
  updateAvGridLayout();
}

function clearScreenShareTile() {
  if (screenShareTrack && screenShareMedia) {
    detachTrack(screenShareTrack, screenShareMedia);
  }
  if (screenShareTile) {
    screenShareTile.remove();
  }
  screenShareTile = null;
  screenShareMedia = null;
  updateAvGridLayout();
}

function updateScreenShareLayout() {
  if (!avGrid) return;
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
    await stopScreenShare();
    setTileVideoState(avLocalTile, false);
    stopPreviewTracks();
    previewMode = false;
    localAudioTrack = null;
    localVideoTrack = null;
    resetAvToggles();
    setChatEnabled(false);
    setShareEnabled(false);
    clearChatMessages();
    clearPendingChatFile();
    setChatPanelVisible(false, false);
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
        setTimeout(reconcileRemoteParticipants, 0);
      })
      .on(RoomEvent.TrackPublished, (publication, participant) => {
        if (!participant || participant.isLocal || !publication) {
          return;
        }
        logDebug(`track published ${publication.kind || "?"} by ${participant.name || participant.identity || "?"}`);
        if (typeof publication.setSubscribed === "function") {
          publication.setSubscribed(true);
        }
        setTimeout(reconcileRemoteParticipants, 0);
      })
      .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (participant && participant.isLocal) {
          return;
        }
        const isScreen = isScreenShareTrack(publication, track);
        logDebug(`track subscribed ${track.kind} from ${participant && (participant.name || participant.identity || "?")}`);
        const info = getOrCreateRemoteTile(participant, isScreen ? "screen" : "camera");
        if (info && info.media) {
          attachTrack(track, info.media);
          if (track && track.kind === "video") {
            setTileVideoState(info.tile, true);
          }
          if (!isScreen) {
            updateRemoteTileState(participant);
          }
        }
        setTimeout(reconcileRemoteParticipants, 0);
      })
      .on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        if (participant && participant.isLocal) {
          return;
        }
        const isScreen = isScreenShareTrack(publication, track);
        logDebug(`track unsubscribed ${track.kind} from ${participant && (participant.name || participant.identity || "?")}`);
        const info = getRemoteTile(participant, isScreen ? "screen" : "camera");
        if (info && info.media) {
          detachTrack(track, info.media);
          if (track && track.kind === "video") {
            setTileVideoState(info.tile, false);
          }
          if (isScreen) {
            removeRemoteTile(participant, "screen");
          } else {
            updateRemoteTileState(participant);
          }
        }
        setTimeout(reconcileRemoteParticipants, 0);
      })
      .on(RoomEvent.ParticipantDisconnected, (participant) => {
        logDebug(`participant disconnected ${participant && (participant.name || participant.identity || "?")}`);
        removeRemoteTile(participant);
      })
      .on(RoomEvent.DataReceived, (payload, participant) => {
        try {
          const text = new TextDecoder().decode(payload);
          const data = JSON.parse(text);
          if (data && data.type === "chat") {
            const name = data.name || (participant && (participant.name || participant.identity)) || "Guest";
            appendChatMessage({ name, text: data.text || "", self: false });
            if (chatPanel && chatPanel.hidden) {
              chatUnreadCount += 1;
              updateChatCount();
              showToast("New chat message.", false);
            }
          }
          if (data && data.type === "file") {
            const name = data.sender || (participant && (participant.name || participant.identity)) || "Guest";
            const fileName = data.name || "file";
            const fileSize = Number(data.size) || 0;
            const mime = data.mime || "application/octet-stream";
            const blob = base64ToBlob(data.data || "", mime);
            const url = URL.createObjectURL(blob);
            appendChatFileMessage({ name, fileName, fileSize, fileUrl: url, mime, self: false });
            if (chatPanel && chatPanel.hidden) {
              chatUnreadCount += 1;
              updateChatCount();
              showToast("New file received.", false);
            }
          }
        } catch (_err) {
          return;
        }
      });

    await livekitRoom.connect(data.url, data.token);
    logDebug(`connected url=${data.url}`);
    const remoteParticipants = livekitRoom.remoteParticipants;
    if (remoteParticipants && typeof remoteParticipants.forEach === "function") {
      remoteParticipants.forEach((participant) => {
        const remoteTracks = participant ? participant.tracks : null;
        if (remoteTracks && typeof remoteTracks.forEach === "function") {
          remoteTracks.forEach((pub) => {
            if (pub && typeof pub.setSubscribed === "function") {
              pub.setSubscribed(true);
            }
            if (pub && pub.track) {
              const isScreen = isScreenShareTrack(pub, pub.track);
              const info = getOrCreateRemoteTile(participant, isScreen ? "screen" : "camera");
              if (info && info.media) {
                attachTrack(pub.track, info.media);
                if (!isScreen && pub.track.kind === "video") {
                  setTileVideoState(info.tile, true);
                }
              }
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
    syncStageControls();
    setAvStatus("AV connected. Mic and camera are off.", false);
    setShareButtonState(false);
    setChatEnabled(true);
    setShareEnabled(true);
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
        syncStageControls();
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
      syncStageControls();
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
      syncStageControls();
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
    syncStageControls();
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
        syncStageControls();
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
      syncStageControls();
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
      syncStageControls();
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
    syncStageControls();
    syncAvStatus();
    const stored = loadStoredJoin();
    if (stored) {
      storeJoin({ ...stored, cameraOn: true });
    }
  } catch (err) {
    setAvStatus(`Camera error: ${err.message}`, true);
  }
}

async function stopScreenShare() {
  if (!screenShareTrack || !livekitRoom) {
    clearScreenShareTile();
    screenShareTrack = null;
    setShareButtonState(false);
    if (avLocalTile) {
      avLocalTile.hidden = false;
    }
    return;
  }
  try {
    livekitRoom.localParticipant.unpublishTrack(screenShareTrack);
  } catch (_err) {
    // ignore
  }
  if (screenShareMedia) {
    detachTrack(screenShareTrack, screenShareMedia);
  }
  screenShareTrack.stop();
  screenShareTrack = null;
  clearScreenShareTile();
  setShareButtonState(false);
  setAvStatus("Screen share stopped.", false);
  if (avLocalTile) {
    avLocalTile.hidden = false;
  }
}

async function toggleScreenShare() {
  try {
    if (!livekitRoom) {
      setAvStatus("AV is not connected.", true);
      return;
    }
    if (screenShareTrack) {
      await stopScreenShare();
      return;
    }
    const { createLocalScreenTracks } = LivekitClient;
    if (!createLocalScreenTracks) {
      setAvStatus("Screen share not supported.", true);
      return;
    }
    const tracks = await createLocalScreenTracks({ audio: false });
    const videoTrack = tracks.find((t) => t.kind === "video") || tracks[0];
    if (!videoTrack) {
      setAvStatus("Unable to start screen share.", true);
      return;
    }
    screenShareTrack = videoTrack;
    ensureScreenShareTile();
    if (screenShareMedia) {
      attachTrack(screenShareTrack, screenShareMedia);
      setTileVideoState(screenShareTile, true);
    }
    if (avLocalTile) {
      avLocalTile.hidden = true;
    }
    livekitRoom.localParticipant.publishTrack(screenShareTrack);
    setShareButtonState(true);
    setAvStatus("Screen share started.", false);
    const mediaTrack = screenShareTrack.mediaStreamTrack;
    if (mediaTrack) {
      mediaTrack.onended = () => {
        stopScreenShare();
      };
    }
  } catch (err) {
    setAvStatus(`Screen share error: ${err.message}`, true);
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
    document.body.classList.add("in-meeting");
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
      document.body.classList.add("in-meeting");
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

if (shareToggleBtn) {
  shareToggleBtn.addEventListener("click", async () => {
    await toggleScreenShare();
  });
}

if (chatToggleBtn) {
  chatToggleBtn.addEventListener("click", () => {
    if (!chatPanel) return;
    const show = chatPanel.hidden;
    setChatPanelVisible(show, true);
    if (show && !livekitRoom) {
      showToast("Chat will work after AV connects.", false);
    }
  });
}

if (chatForm) {
  chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!livekitRoom || !chatInput) return;
    const text = chatInput.value.trim();
    const displayName = document.getElementById("join-display")
      ? document.getElementById("join-display").value.trim()
      : "You";
    let sentSomething = false;
    if (text) {
      const payload = JSON.stringify({ type: "chat", text, name: displayName || "You" });
      try {
        const data = new TextEncoder().encode(payload);
        livekitRoom.localParticipant.publishData(data, { reliable: true });
        appendChatMessage({ name: "You", text, self: true });
        chatInput.value = "";
        sentSomething = true;
      } catch (err) {
        showToast("Unable to send chat.", true);
      }
    }
    if (pendingChatFile) {
      sendChatFile(pendingChatFile, displayName || "You");
      sentSomething = true;
    }
    if (!sentSomething) {
      showToast("Type a message or attach a file.", true);
    }
  });
}

if (chatAttachBtn && chatFileInput) {
  chatAttachBtn.addEventListener("click", () => {
    chatFileInput.click();
  });
}

if (chatFileInput) {
  chatFileInput.addEventListener("change", () => {
    const file = chatFileInput.files && chatFileInput.files[0];
    if (!file) {
      clearPendingChatFile();
      return;
    }
    if (file.size > 1024 * 1024) {
      showToast("File too large (max 1MB).", true);
      clearPendingChatFile();
      return;
    }
    pendingChatFile = file;
    updateChatFileInfo();
  });
}

 
