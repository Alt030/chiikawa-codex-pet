const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen, shell, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const {attachImmediateInstall,updateMenuLabel}=require('./immediate-updates');
app.setPath("userData", app.isPackaged ? require('node:path').join(app.getPath('appData'),'ChiikawaCodexPet') : require("node:path").join(__dirname, "..", "runtime"));
if(!app.requestSingleInstanceLock()) app.exit(0);
app.on('second-instance',()=>{if(win&&!win.isDestroyed())win.show();});
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const {constrainBounds}=require('./screen-bounds');
let constrainingWindow=false;
function keepPetOnScreen(persist=false){
 if(!win||win.isDestroyed()||constrainingWindow)return;
 const bounds=win.getBounds();const area=screen.getDisplayMatching(bounds).workArea;
 const safe=constrainBounds(bounds,area);
 if(Object.keys(safe).some(key=>safe[key]!==bounds[key])){
  constrainingWindow=true;try{win.setBounds(safe);}finally{constrainingWindow=false;}
 }
 if(persist){settings.windowBounds=win.getBounds();saveSettings();}
 positionBubble();
}
const { FatigueManager } = require("./fatigue-manager");
const fatigue = new FatigueManager();
const { IdleCompanion } = require('./idle-companion');
const idleCompanion=new IdleCompanion();
let idleCompanionTimer=null;
let idleBubbleReturnTimer=null;
const { AGENTS, buildDecision } = require("./agent-events");
const { AGENT_CONFIGS, doctorHooks, installHooks } = require("./hook-installer");
const {
  discoverPets: discoverPetsInRoot,
  getActivePetsRoot,
  toPetPayload
} = require("./pet-library");
const { SessionManager } = require("./session-manager");
const { ReminderManager } = require("./reminder-manager");

const API_HOST = "127.0.0.1";
const API_PORT = Number(process.env.PET_PORT || 17861);
const CODEX_HOME = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
const { CodexObserver } = require('./codex-observer');
const { CodexQuota, findCodex } = require('./codex-quota');
const quota = new CodexQuota(findCodex(), () => {
  if(currentState.agentEvent === 'done') showBubble(buildBubbleItems(currentState));
});
const { ToolDisplayGate } = require('./tool-display-gate');
const toolDisplayGate = new ToolDisplayGate(body => {
  if(getActiveHookAgent() !== 'codex') return;
  const decision=buildDecision(body);if(!decision)return;
  decision.editingFiles=body.editingFiles||[];
  decision.startedAt=body.startedAt;
  if(body.event==='tool_end') decision.persistentState='running';
  if(activePet?.id==='kurimanju') fatigue.observe(decision.event,decision.sessionId);
  applyAgentDecision(decision);
  if(decision.event==='done') quota.refresh();
});
function resumeCodexTool(body, ended=false) {
  const id='codex:'+body.session_id;
  // Short-tool filtering must not retain a completed turn or an approval wait.
  if((!ended&&currentState.agentEvent==='done') ||
    (['waiting','notification','failed','tool_failed'].includes(currentState.agentEvent)&&currentState.sessionId===id)) {
    const decision=buildDecision({source:'codex',event:ended?'tool_end':'tool_start',session_id:body.session_id,message:ended?'다음 단계 진행 중':'도구 사용 중'});
    decision.persistentState='running';
    applyAgentDecision(decision);
  }
}
const { CodexEventRouter } = require('./codex-event-router');
const codexEventRouter = new CodexEventRouter(body => {
  if(body.event==='tool_start')resumeCodexTool(body);
  if(body.event==='tool_end')resumeCodexTool(body,true);
  toolDisplayGate.push(body);
});
const codexObserver = new CodexObserver(path.join(CODEX_HOME,'sessions'), body => codexEventRouter.rollout(body), limits=>quota.update(limits));
const LOGO_PATH = path.join(__dirname, "assets", "logo.png");
const BUNDLED_PETS_ROOT = path.join(__dirname, "assets", "pets");
const RELEASES_URL = "https://github.com/Alt030/chiikawa-codex-pet/releases";
const BASE_WINDOW_WIDTH = 240;
const BASE_WINDOW_HEIGHT = 286;
const MIN_ZOOM = 0.65;
const MAX_ZOOM = 2.4;
const MIN_BUBBLE_SCALE = 0.75;
const MAX_BUBBLE_SCALE = 1.6;
const MAX_BUBBLE_ITEMS = 3;
const MAX_RECENT_HOOK_EVENTS = 40;
const DEFAULT_ACTIVE_HOOK_AGENT = "codex";
const REVIEW_AFTER_RUNNING_DEBOUNCE_MS = 1400;

const VALID_STATES = new Set([
  "idle",
  "running-right",
  "running-left",
  "waving",
  "jumping",
  "failed",
  "waiting",
  "running",
  "review",
  "start",
  "remind",
  "success",
  "done",
  "sleeping",
  "working",
  "thinking"
]);

let win;
let bubbleWin;
let settingsWin;
let tray;
let server;
let pets = [];
let activePet = null;
let settings = {};
let stateBeforeDrag = null;
let bubbleTimer = null;
let agentReturnTimer = null;
let agentReviewDebounceTimer = null;
let pendingReviewDecision = null;
let bubbleReady = false;
let pendingBubblePayload = null;
let updateCheckInProgress = false;
let updateDownloadInProgress = false;
let updateDownloaded = false;
let manualUpdateRequested = false;
let updateInstallStarted = false;
let updatePromptVisible = false;
let pendingUpdateInfo = null;
let reminderManager = null;
let updateStatus = {
  status: "idle",
  message: "尚未检查更新",
  version: app.getVersion(),
  progress: 0,
  releaseUrl: RELEASES_URL,
  updatedAt: new Date().toISOString()
};
const agentSessions = new SessionManager();
let recentHookEvents = [];
let currentState = {
  state: "idle",
  normalizedState: "idle",
  message: "Ready",
  updatedAt: new Date().toISOString()
};

const ACTIONS = [
  { state: "idle", label: "idle 待机", row: 0, hookName: "idle" },
  { state: "running-right", label: "向右拖拽移动", row: 1, hookName: "drag-right" },
  { state: "running-left", label: "向左拖拽移动", row: 2, hookName: "drag-left" },
  { state: "waving", label: "挥手/提醒", row: 3, hookName: "remind" },
  { state: "jumping", label: "done 开心跳一下", row: 4, hookName: "done" },
  { state: "failed", label: "sleeping 趴下睡觉", row: 5, hookName: "sleeping" },
  { state: "waiting", label: "waiting 等待输入", row: 6, hookName: "waiting" },
  { state: "running", label: "working 敲代码中", row: 7, hookName: "working" },
  { state: "review", label: "thinking 歪头思考", row: 8, hookName: "thinking" }
];

const STATE_ALIASES = {
  start: "waving",
  remind: "waving",
  success: "jumping",
  done: "jumping",
  sleeping: "failed",
  working: "running",
  thinking: "review"
};

function normalizeState(state) {
  const requested = String(state || "idle");
  return STATE_ALIASES[requested] || requested;
}

function clampZoom(zoom) {
  const value = Number(zoom);
  if (!Number.isFinite(value)) return 1;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

function clampBubbleScale(scale) {
  const value = Number(scale);
  if (!Number.isFinite(value)) return 1;
  return Math.max(MIN_BUBBLE_SCALE, Math.min(MAX_BUBBLE_SCALE, value));
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function createAppIcon() {
  try {
    const image = nativeImage.createFromPath(LOGO_PATH);
    if (!image.isEmpty()) return image;
  } catch (error) {
    console.warn(`Failed to load app logo: ${error.message}`);
  }

  return nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAGFBMVEUAAAAYIi9i5v9y8qaZfP/90WYfKz2xyNj28m6BAAAAB3RSTlMA///f39+fn6uU/gAAAEFJREFUeNqVj0kOwCAIBQO//2XnplkYQYJGk0BHyDKJg1xmEAjJQWYNZUdGgTYosAkfiBPwYQnKN3qHf6Snw6gudTW2DdqgAhoBA3kwAAAAAElFTkSuQmCC"
  );
}

function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function loadSettings() {
  settings = readJson(getSettingsPath()) || {};
}

function saveSettings() {
  try {
    fs.mkdirSync(path.dirname(getSettingsPath()), { recursive: true });
    fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2));
  } catch (error) {
    console.warn(`Failed to save settings: ${error.message}`);
  }
}

function discoverPets() {
  const storage = getPetStorageInfo();
  pets = discoverPetsInRoot(storage.petsRoot, { bundledPetsRoot: BUNDLED_PETS_ROOT });
  const preferred = process.env.PET_ID || settings.activePetKey || "shisa";
  activePet = pets.find((pet) => pet.id === preferred || pet.key === preferred) || pets[0] || null;
}

function getPetStorageInfo() {
  return getActivePetsRoot({
    codexHome: CODEX_HOME,
    settings
  });
}

function createWindow() {
  const savedBounds = settings.windowBounds || {};
  const area=screen.getDisplayNearestPoint({x:Number.isFinite(savedBounds.x)?savedBounds.x:40,y:Number.isFinite(savedBounds.y)?savedBounds.y:220}).workArea;
  const zoom = Math.min(clampZoom(settings.zoom || 1),area.width/BASE_WINDOW_WIDTH,area.height/BASE_WINDOW_HEIGHT);
  settings.zoom=zoom;
  win = new BrowserWindow({
    width: Math.round(BASE_WINDOW_WIDTH * zoom),
    height: Math.round(BASE_WINDOW_HEIGHT * zoom),
    x: Number.isFinite(savedBounds.x) ? savedBounds.x : 40,
    y: Number.isFinite(savedBounds.y) ? savedBounds.y : 220,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    icon: createAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.setAlwaysOnTop(true, "floating");
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  keepPetOnScreen();
  win.on('move',()=>keepPetOnScreen());
  win.once("ready-to-show", () => {keepPetOnScreen(true);win.show();});
  win.on("closed", () => {
    win = null;
  });
}

function createBubbleWindow() {
  bubbleReady = false;
  bubbleWin = new BrowserWindow({
    width: 280,
    height: 96,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    icon: createAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  bubbleWin.setAlwaysOnTop(true, "floating");
  bubbleWin.setIgnoreMouseEvents(true);
  bubbleWin.loadFile(path.join(__dirname, "renderer", "bubble.html"));
  bubbleWin.webContents.once("did-finish-load", () => {
    bubbleReady = true;
    if (pendingBubblePayload) {
      bubbleWin.webContents.send("bubble:set-message", pendingBubblePayload);
      pendingBubblePayload = null;
    }
  });
  bubbleWin.on("closed", () => {
    bubbleWin = null;
    bubbleReady = false;
  });
}

function sendToWindows(channel, payload) {
  for (const target of [win, settingsWin]) {
    if (target && !target.isDestroyed()) {
      target.webContents.send(channel, payload);
    }
  }
}

function normalizeUpdateInfo(info = {}) {
  return {
    version: info.version || "",
    releaseDate: info.releaseDate || "",
    releaseName: info.releaseName || "",
    releaseNotes: info.releaseNotes || ""
  };
}

function setUpdateStatus(nextStatus) {
  updateStatus = {
    ...updateStatus,
    ...nextStatus,
    version: app.getVersion(),
    releaseUrl: RELEASES_URL,
    updatedAt: new Date().toISOString()
  };
  sendToWindows("pet:update-status", updateStatus);
  rebuildTrayMenu();
  return updateStatus;
}

function getUpdateStatus() {
  return { ...updateStatus };
}

function configureDevUpdaterIfRequested() {
  if (app.isPackaged) return true;
  if (process.env.DESKTOP_PET_FORCE_DEV_UPDATE !== "1") return false;
  autoUpdater.forceDevUpdateConfig = true;
  autoUpdater.updateConfigPath = path.join(__dirname, "..", "dev-app-update.yml");
  return true;
}

function isUpdateAvailableInThisRuntime(manual) {
  if (configureDevUpdaterIfRequested()) return true;
  if (manual) {
    setUpdateStatus({
      status: "disabled",
      message: "개발 실행에서는 자동 업데이트를 사용할 수 없어요.",
      progress: 0
    });
  }
  return false;
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    setUpdateStatus({
      status: "checking",
      message: "업데이트 확인 중…",
      progress: 0
    });
  });

  autoUpdater.on("update-available", (info) => {
    pendingUpdateInfo = normalizeUpdateInfo(info);
    updateCheckInProgress = false;
    updateDownloadInProgress = true;
    setUpdateStatus({
      status: "downloading",
      message: `새 버전 ${pendingUpdateInfo.version || ""} 다운로드 중…`,
      progress: 0,
      updateInfo: pendingUpdateInfo
    });
  });

  autoUpdater.on("update-not-available", () => {
    updateCheckInProgress = false;
    updateDownloadInProgress = false;
    setUpdateStatus({
      status: "latest",
      message: "현재 최신 버전이에요.",
      progress: 0
    });
    if(manualUpdateRequested){tray?.displayBalloon({title:'업데이트 확인',content:'현재 최신 버전이에요.'});manualUpdateRequested=false;}
  });

  autoUpdater.on("download-progress", (progress) => {
    const percent = Number(progress?.percent) || 0;
    setUpdateStatus({
      status: "downloading",
      message: `업데이트 다운로드 중 · ${Math.round(percent)}%`,
      progress: Math.max(0, Math.min(100, percent)),
      transferred: progress?.transferred || 0,
      total: progress?.total || 0,
      bytesPerSecond: progress?.bytesPerSecond || 0,
      updateInfo: pendingUpdateInfo
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    pendingUpdateInfo = normalizeUpdateInfo(info);
    updateCheckInProgress = false;
    updateDownloadInProgress = false;
    updateDownloaded = true;
    setUpdateStatus({
      status: "ready",
      message: `새 버전 ${pendingUpdateInfo.version || ""} 다운로드 완료`,
      progress: 100,
      updateInfo: pendingUpdateInfo
    });
  });

  autoUpdater.on("error", (error) => {
    updateCheckInProgress = false;
    updateDownloadInProgress = false;
    setUpdateStatus({
      status: "error",
      message: error?.message || "업데이트 확인에 실패했어요.",
      progress: 0,
      updateInfo: pendingUpdateInfo
    });
    if(manualUpdateRequested){tray?.displayBalloon({title:'업데이트 확인 실패',content:'네트워크 연결을 확인하고 다시 시도해 주세요.'});manualUpdateRequested=false;}
  });
  attachImmediateInstall(autoUpdater,()=>installDownloadedUpdate());
}

async function checkForUpdates(manual = false) {
  if(manual)manualUpdateRequested=true;
  if (updateDownloaded) {
    return installDownloadedUpdate();
  }

  if (updateCheckInProgress || updateDownloadInProgress) {
    return setUpdateStatus({
      status: updateDownloadInProgress ? "downloading" : "checking",
      message: updateDownloadInProgress ? "업데이트 다운로드 중…" : "업데이트 확인 중…",
      updateInfo: pendingUpdateInfo
    });
  }

  if (!isUpdateAvailableInThisRuntime(manual)){if(manual){tray?.displayBalloon({title:'업데이트 확인',content:'자동 업데이트는 설치 파일로 설치한 앱에서 사용할 수 있어요.'});manualUpdateRequested=false;}return getUpdateStatus();}

  updateCheckInProgress = true;
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    updateCheckInProgress = false;
    return setUpdateStatus({
      status: "error",
      message: error?.message || "업데이트 확인에 실패했어요.",
      progress: 0
    });
  }

  return getUpdateStatus();
}

function installDownloadedUpdate() {
  if (!updateDownloaded || updateInstallStarted) return getUpdateStatus();
  updateInstallStarted = true;
  setUpdateStatus({
    status: "installing",
    message: "다시 시작하고 업데이트를 설치하는 중…",
    progress: 100,
    updateInfo: pendingUpdateInfo
  });
  setImmediate(() => autoUpdater.quitAndInstall(true, true));
  return getUpdateStatus();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function positionBubble(size = {}) {
  if (!win || win.isDestroyed() || !bubbleWin || bubbleWin.isDestroyed()) return;

  const petBounds = win.getBounds();
  const display = screen.getDisplayMatching(petBounds);
  const area = display.workArea;
  const zoom = clampZoom(settings.zoom || 1);
  const spriteScale = 0.86 * zoom;
  const spriteWidth = 192 * spriteScale;
  const spriteHeight = 208 * spriteScale;
  const spriteLeft = 36 * zoom + 1 * zoom;
  const spriteBottom = 12 * zoom;
  const spriteTop = petBounds.y + petBounds.height - spriteBottom - spriteHeight;
  const spriteCenterX = petBounds.x + spriteLeft + spriteWidth / 2;
  const gap = 6;
  const margin = 8;
  const width = Math.ceil(Number(size.width) || 280);
  const height = Math.ceil(Number(size.height) || 96);
  const topY = spriteTop - height - gap;
  const bottomY = spriteTop + spriteHeight + gap;

  const x = clamp(
    Math.round(spriteCenterX - width / 2),
    area.x + margin,
    area.x + area.width - width - margin
  );
  const y = Math.round(topY >= area.y + margin
    ? topY
    : clamp(bottomY, area.y + margin, area.y + area.height - height - margin));

  bubbleWin.setBounds({ x, y, width, height });
}

function getAgentDisplayName(source) {
  if (!source) return "";
  return AGENTS[source]?.label || source;
}

function buildBubbleItems(state = currentState) {
  const items = [];

  if (state.message) {
    items.push({
      id: state.sessionId || "current",
      source: state.source || "",
      title: getAgentDisplayName(state.source),
      state: normalizeState(state.state),
      message: String(state.message).slice(0, 120),
      persistent: Boolean(state.sessionId && state.source)
    });
  }

  return items.slice(0, MAX_BUBBLE_ITEMS);
}

function showBubble(input) {
  if (!bubbleWin || bubbleWin.isDestroyed() || !win?.isVisible()) return;
  clearTimeout(bubbleTimer);
  bubbleTimer = null;

  const items = Array.isArray(input)
    ? input
    : (typeof input === "string" && input ? [{ message: input, persistent: false }] : []);

  if (items.length === 0) {
    bubbleWin.hide();
    return;
  }

  const payload = {
    message: items[0]?.message || "",
    pet: toPetPayload(activePet),
    state: items[0]?.state || "idle",
    event: currentState.agentEvent || "",
    quotaText: currentState.agentEvent === 'done' ? quota.text() : '',
    editingFiles: currentState.agentEvent === 'tool_start' ? currentState.editingFiles || [] : [],
    startedAt: currentState.sessionId && ['running','review'].includes(currentState.normalizedState) ? currentState.startedAt || null : null,
    activeSessionCount: (currentState.sessions || []).filter(session => ['running','review'].includes(session.state)).length,
    items,
    bubbleScale: clampBubbleScale(settings.bubbleScale || 1)
  };

  positionBubble();
  bubbleWin.showInactive();

  if (bubbleReady) {
    bubbleWin.webContents.send("bubble:set-message", payload);
  } else {
    pendingBubblePayload = payload;
  }

  if (!items.some((item) => item.persistent)) {
    bubbleTimer = setTimeout(() => {
      if (bubbleWin && !bubbleWin.isDestroyed()) bubbleWin.hide();
    }, 12000);
  }
}

function broadcastZoom() {
  sendToWindows("pet:set-zoom", {
    zoom: clampZoom(settings.zoom || 1),
    bounds: win && !win.isDestroyed() ? win.getBounds() : null
  });
}

function broadcastBubbleScale() {
  sendToWindows("pet:set-bubble-scale", {
    bubbleScale: clampBubbleScale(settings.bubbleScale || 1)
  });
  if (currentState.message || agentSessions.list().some((session) => session.message)) {
    showBubble(buildBubbleItems(currentState));
  }
}

function broadcastState(nextState) {
  const requestedState = nextState.state || currentState.state;
  const normalizedState = normalizeState(requestedState);
  currentState = {
    ...currentState,
    ...nextState,
    state: requestedState,
    normalizedState,
    updatedAt: new Date().toISOString()
  };

  sendToWindows("pet:set-state", {
    ...currentState,
    actions: ACTIONS,
    activePet: toPetPayload(activePet)
  });
  showBubble(buildBubbleItems(currentState));
}

function broadcastAgentAggregate() {
  const aggregate = agentSessions.getAggregate();
  broadcastState({
    state: aggregate.state,
    message: aggregate.message,
    source: aggregate.source,
    sessionId: aggregate.sessionId,
    agentEvent: aggregate.event || "aggregate",
    editingFiles: aggregate.editingFiles || [],
    startedAt: aggregate.startedAt || null,
    sessions: agentSessions.list()
  });
}

function clearAgentReviewDebounce() {
  if (agentReviewDebounceTimer) {
    clearTimeout(agentReviewDebounceTimer);
    agentReviewDebounceTimer = null;
  }
  pendingReviewDecision = null;
}

function shouldDebounceReviewDecision(decision) {
  if (!decision || decision.terminal || decision.visualState) return false;
  if (decision.persistentState !== "review") return false;
  if (decision.event !== "tool_end" && decision.event !== "review") return false;
  if (normalizeState(currentState.state) !== "running") return false;
  if (currentState.source && decision.source && currentState.source !== decision.source) return false;
  if (currentState.sessionId && decision.sessionId && currentState.sessionId !== decision.sessionId) return false;
  return true;
}

function buildDeferredAgentResult(decision) {
  const aggregate = agentSessions.getAggregate();
  return {
    deferred: true,
    display: {
      state: currentState.state,
      message: currentState.message || aggregate.message || "",
      source: currentState.source || decision.source,
      sessionId: currentState.sessionId || decision.sessionId,
      agentEvent: decision.event,
      durationMs: 0,
      returnState: aggregate
    },
    aggregate,
    sessions: agentSessions.list()
  };
}

function commitAgentDecision(decision) {
  if (agentReturnTimer) {
    clearTimeout(agentReturnTimer);
    agentReturnTimer = null;
  }

  const result = agentSessions.apply(decision);
  broadcastState({
    state: result.display.state,
    message: result.display.message,
    source: result.display.source,
    sessionId: result.display.sessionId,
    agentEvent: result.display.agentEvent,
    editingFiles: result.display.editingFiles || [],
    startedAt: result.display.startedAt,
    sessions: result.sessions
  });

  if (result.display.durationMs > 0) {
    agentReturnTimer = setTimeout(() => {
      agentReturnTimer = null;
      broadcastAgentAggregate();
    }, result.display.durationMs);
  }

  return result;
}

function applyAgentDecision(decision) {
  idleCompanion.reset();
  clearTimeout(idleBubbleReturnTimer);
  if (shouldDebounceReviewDecision(decision)) {
    clearAgentReviewDebounce();
    pendingReviewDecision = decision;
    agentReviewDebounceTimer = setTimeout(() => {
      const queuedDecision = pendingReviewDecision;
      clearAgentReviewDebounce();
      if (queuedDecision) commitAgentDecision(queuedDecision);
    }, REVIEW_AFTER_RUNNING_DEBOUNCE_MS);
    return buildDeferredAgentResult(decision);
  }

  clearAgentReviewDebounce();
  return commitAgentDecision(decision);
}

function broadcastPet() {
  sendToWindows("pet:set-pet", toPetPayload(activePet));
}

function selectPet(idOrKey, source) {
  const nextPet = pets.find((pet) => {
    if (source && pet.source !== source) return false;
    return pet.id === idOrKey || pet.key === idOrKey;
  });

  if (!nextPet) return false;
  activePet = nextPet;
  fatigue.reset();
  sendToWindows("pet:set-fatigue", fatigue.status());
  settings.activePetKey = nextPet.key;
  saveSettings();
  broadcastPet();
  return true;
}

function selectPetStorage(storageId, customDir) {
  const requested = String(storageId || "codex");
  if (requested === "custom") {
    if (!customDir && !settings.customPetsDir) {
      return { ok: false, error: "请先选择自定义宠物文件夹", storage: getPetStorageInfo() };
    }
    if (customDir) settings.customPetsDir = path.resolve(String(customDir));
  }
  settings.petStorage = ["codex", "custom"].includes(requested) ? requested : "codex";
  settings.activePetKey = "";
  saveSettings();
  discoverPets();
  broadcastPet();
  return {
    ok: true,
    storage: getPetStorageInfo(),
    pets: pets.map(toPetPayload),
    activePet: toPetPayload(activePet)
  };
}

async function chooseCustomPetStorage() {
  const result = await dialog.showOpenDialog(settingsWin || win, {
    title: "选择宠物文件夹",
    properties: ["openDirectory", "createDirectory"]
  });
  if (result.canceled || !result.filePaths[0]) {
    return { ok: false, canceled: true, storage: getPetStorageInfo() };
  }
  return selectPetStorage("custom", result.filePaths[0]);
}

async function openPetFolder(kind = "current") {
  const storage = getPetStorageInfo();
  const options = {
    current: storage.petsRoot,
    codex: storage.codexPetsRoot,
    custom: storage.customPetsRoot
  };
  const target = options[kind] || options.current;
  if (!target) return { ok: false, error: "目录尚未配置", storage };
  fs.mkdirSync(target, { recursive: true });
  const error = await shell.openPath(target);
  return { ok: !error, error, path: target, storage };
}

function buildInitialPayload() {
  const storage = getPetStorageInfo();
  return {
    ...currentState,
    normalizedState: normalizeState(currentState.state),
    pets: pets.map(toPetPayload),
    actions: ACTIONS,
    activePet: toPetPayload(activePet),
    config: {
      apiBaseUrl: `http://${API_HOST}:${API_PORT}`,
      petsRoot: storage.petsRoot,
      petStorage: storage.petStorage,
      petStorageOptions: storage.options,
      codexPetsRoot: storage.codexPetsRoot,
      customPetsRoot: storage.customPetsRoot,
      bundledPetsRoot: BUNDLED_PETS_ROOT,
      settingsPath: getSettingsPath(),
      agents: AGENTS,
      hookStatus: getHookStatus(),
      activeHookAgent: getActiveHookAgent(),
      zoom: clampZoom(settings.zoom || 1),
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      bubbleScale: clampBubbleScale(settings.bubbleScale || 1),
      minBubbleScale: MIN_BUBBLE_SCALE,
      maxBubbleScale: MAX_BUBBLE_SCALE,
      baseWindowWidth: BASE_WINDOW_WIDTH,
      baseWindowHeight: BASE_WINDOW_HEIGHT,
      appVersion: app.getVersion(),
      releaseUrl: RELEASES_URL,
      updateStatus: getUpdateStatus(),
      reminderStatus: reminderManager ? reminderManager.getStatus() : null
    }
  };
}

function getHookStatus() {
  const lastByAgent = getLastHookEventByAgent();
  return Object.keys(AGENT_CONFIGS).map((agentId) => {
    const result = doctorHooks(agentId);
    const configuredCount = result.valid
      ? AGENT_CONFIGS[agentId].events.length - result.missing.length
      : 0;

    return {
      ...result,
      totalEvents: AGENT_CONFIGS[agentId].events.length,
      configuredCount,
      lastEvent: lastByAgent[agentId] || null,
      selected: agentId === getActiveHookAgent(),
      state: result.status === "installed" ? "ok" : (result.status === "error" ? "error" : "missing"),
      reason: describeHookStatus(result, configuredCount)
    };
  });
}

function normalizeHookAgent(agentId) {
  const id = String(agentId || "").toLowerCase();
  if (AGENT_CONFIGS[id]) return id;
  return DEFAULT_ACTIVE_HOOK_AGENT;
}

function getActiveHookAgent() {
  return normalizeHookAgent(settings.activeHookAgent || DEFAULT_ACTIVE_HOOK_AGENT);
}

function selectHookAgent(agentId) {
  const activeHookAgent = normalizeHookAgent(agentId);
  settings.activeHookAgent = activeHookAgent;
  saveSettings();
  agentSessions.clear();
  clearAgentReviewDebounce();
  broadcastState({ state: "idle", message: "", source: null, sessionId: null, agentEvent: "select-hook-agent", sessions: [] });
  return {
    ok: true,
    activeHookAgent,
    hooks: getHookStatus()
  };
}

function recordHookEvent(decision) {
  recentHookEvents = [
    {
      source: decision.source,
      event: decision.event,
      state: decision.visualState || decision.persistentState || "",
      sessionId: decision.sessionId,
      message: decision.message || "",
      receivedAt: new Date().toISOString()
    },
    ...recentHookEvents
  ].slice(0, MAX_RECENT_HOOK_EVENTS);
}

function getLastHookEventByAgent() {
  const out = {};
  for (const event of recentHookEvents) {
    if (!event.source || out[event.source]) continue;
    out[event.source] = event;
  }
  return out;
}

function describeHookStatus(result, configuredCount) {
  if (result.status === "installed") return "已接入";
  if (result.status === "error") return result.error || "配置文件无法解析";
  if (result.invalidCommands > 0) return `有 ${result.invalidCommands} 个 hook 命令不是 Node，需要修复`;
  if (result.codexFeature && result.codexFeature.enabled !== true) return "Codex hooks feature 未启用";
  if (!result.exists) return "配置文件不存在，尚未安装 hook";
  if (configuredCount > 0) return `缺少 ${result.missing.length} 个事件`;
  return "未发现本项目管理的 hook";
}

function installHookAgent(agentId) {
  const id = String(agentId || "").toLowerCase();
  if (!AGENT_CONFIGS[id]) {
    return { ok: false, error: `Unknown agent: ${agentId}`, hooks: getHookStatus() };
  }

  const result = installHooks(id);
  return {
    ok: true,
    result: {
      agent: result.agent,
      changed: result.changed,
      added: result.added,
      removed: result.removed,
      backupPath: result.backupPath || null,
      settingsPath: result.settingsPath
    },
    hooks: getHookStatus()
  };
}

function resizePetWindow(zoomInput) {
  if (!win || win.isDestroyed()) return { ok: false };
  const bounds = win.getBounds();
  const area=screen.getDisplayMatching(bounds).workArea;
  const zoom = Math.min(clampZoom(zoomInput),area.width/BASE_WINDOW_WIDTH,area.height/BASE_WINDOW_HEIGHT);
  const width = Math.round(BASE_WINDOW_WIDTH * zoom);
  const height = Math.round(BASE_WINDOW_HEIGHT * zoom);
  win.setBounds({ x: bounds.x, y: bounds.y, width, height });
  keepPetOnScreen();
  settings.zoom = zoom;
  settings.windowBounds = win.getBounds();
  saveSettings();
  broadcastZoom();
  positionBubble();
  return { ok: true, zoom, bounds: win.getBounds() };
}

function resizeBubble(scaleInput) {
  const bubbleScale = clampBubbleScale(scaleInput);
  settings.bubbleScale = bubbleScale;
  saveSettings();
  broadcastBubbleScale();
  return { ok: true, bubbleScale };
}

function getWindowPlacement() {
  if (!win || win.isDestroyed()) return null;
  const bounds = win.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const workArea = display.workArea;
  const edgeMargin = 48;

  return {
    bounds,
    workArea,
    nearLeft: bounds.x <= workArea.x + edgeMargin,
    nearRight: bounds.x + bounds.width >= workArea.x + workArea.width - edgeMargin,
    nearTop: bounds.y <= workArea.y + edgeMargin,
    nearBottom: bounds.y + bounds.height >= workArea.y + workArea.height - edgeMargin
  };
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let byteLength = 0;
    req.on("data", (chunk) => {
      chunks.push(chunk);
      byteLength += chunk.length;
      if (byteLength > 1024 * 64) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      const buffer = Buffer.concat(chunks);
      const body = decodeRequestBody(buffer, req.headers["content-type"]);
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function decodeRequestBody(buffer, contentType = "") {
  const charset = String(contentType).match(/charset=([^;]+)/i)?.[1]?.trim().toLowerCase();

  if (charset) {
    try {
      return new TextDecoder(charset).decode(buffer);
    } catch {
      // Fall through to tolerant defaults.
    }
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("gb18030").decode(buffer);
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload));
}

async function handleApiRequest(req, res) {
  const url = new URL(req.url, `http://${API_HOST}:${API_PORT}`);

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (url.pathname === "/health") {
    const storage = getPetStorageInfo();
    sendJson(res, 200, {
      ok: true,
      state: currentState,
      agentSessions: agentSessions.snapshot(),
      actions: ACTIONS,
      activePet: toPetPayload(activePet),
      petsRoot: storage.petsRoot,
      petStorage: storage.petStorage
    });
    return;
  }

  if (url.pathname === "/pets" && req.method === "GET") {
    discoverPets();
    sendJson(res, 200, {
      ok: true,
      actions: ACTIONS,
      activePet: toPetPayload(activePet),
      pets: pets.map(toPetPayload),
      storage: getPetStorageInfo()
    });
    return;
  }

  if (url.pathname === "/pets/storage" && req.method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const result = selectPetStorage(body.storage, body.customDir);
      sendJson(res, result.ok ? 200 : 400, result);
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message, storage: getPetStorageInfo() });
    }
    return;
  }

  if (url.pathname === "/actions" && req.method === "GET") {
    sendJson(res, 200, { ok: true, actions: ACTIONS });
    return;
  }

  if (url.pathname === "/hooks/status" && req.method === "GET") {
    sendJson(res, 200, { ok: true, hooks: getHookStatus() });
    return;
  }

  if (url.pathname === "/hooks/install" && req.method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const result = installHookAgent(body.agent);
      sendJson(res, result.ok ? 200 : 400, result);
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message, hooks: getHookStatus() });
    }
    return;
  }

  if (url.pathname === "/hooks/select" && req.method === "POST") {
    try {
      const body = await parseJsonBody(req);
      sendJson(res, 200, selectHookAgent(body.agent));
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message, activeHookAgent: getActiveHookAgent(), hooks: getHookStatus() });
    }
    return;
  }

  if (url.pathname === "/sessions" && req.method === "GET") {
    sendJson(res, 200, {
      ok: true,
      ...agentSessions.snapshot()
    });
    return;
  }

  if (url.pathname === "/sessions/clear" && req.method === "POST") {
    const snapshot = agentSessions.clear();
    if (agentReturnTimer) {
      clearTimeout(agentReturnTimer);
      agentReturnTimer = null;
    }
    clearAgentReviewDebounce();
    broadcastState({ state: "idle", message: "", source: null, sessionId: null, agentEvent: "clear", sessions: [] });
    sendJson(res, 200, { ok: true, ...snapshot });
    return;
  }

  if (url.pathname === "/verify-fatigue" && req.method === "GET") {const info=await win.webContents.executeJavaScript('({tired:pet.dataset.tired,usingTint:sprite.style.backgroundImage.includes("data:image/png")})');const shot=await win.webContents.capturePage();const target=path.join(__dirname,'..','fatigue-'+(fatigue.status().tired?'green':'normal')+'.png');fs.writeFileSync(target,shot.toPNG());sendJson(res,200,{...fatigue.status(),...info,screenshot:target});return;}
 if (url.pathname === "/verify-card" && req.method === "GET") {
 const info=await bubbleWin.webContents.executeJavaScript('({text:document.body.innerText,image:document.querySelector(".reaction-card")?.src||null,imageLoaded:document.querySelector(".reaction-card")?.naturalWidth||0,bounds:document.querySelector(".bubble").getBoundingClientRect().toJSON()})');
 const shot=await bubbleWin.webContents.capturePage();
 const target=path.join(__dirname,'..','verification-'+(activePet?.id||'pet')+'.png');fs.writeFileSync(target,shot.toPNG());sendJson(res,200,{ok:true,...info,screenshot:target});return;
 }
 if (url.pathname === "/settings/open") {sendJson(res,404,{ok:false,error:"Settings UI removed"});return;}

  if (url.pathname === "/window/resize" && req.method === "POST") {
    const body = await parseJsonBody(req);
    sendJson(res, 200, resizePetWindow(body.zoom));
    return;
  }

  if (url.pathname === "/bubble/resize" && req.method === "POST") {
    const body = await parseJsonBody(req);
    sendJson(res, 200, resizeBubble(body.bubbleScale || body.scale));
    return;
  }

  if (url.pathname === "/pet/select" && req.method === "POST") {
    const body = await parseJsonBody(req);
    if (!selectPet(String(body.id || body.key || ""), body.source)) {
      sendJson(res, 404, { ok: false, error: "Pet not found" });
      return;
    }
    sendJson(res, 200, { ok: true, activePet: toPetPayload(activePet) });
    return;
  }

  if (url.pathname === "/events" && req.method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const decision = buildDecision(body);

      if (!decision) {
        sendJson(res, 202, {
          ok: true,
          ignored: true,
          reason: "Unknown or unsupported event",
          received: {
            source: body.source || body.agent || body.agentId || null,
            event: body.event || body.type || body.hook_event_name || body.reaction || null
          }
        });
        return;
      }

      if (body.petId || body.petKey) {
        selectPet(String(body.petId || body.petKey), body.petSource);
      }

      recordHookEvent(decision);
      if(decision.source==='codex'&&body.hook_event_name){
        if(getActiveHookAgent()==='codex')codexEventRouter.hook(body);
        sendJson(res,202,{ok:true,reason:'Unified Codex event router'});return;
      }
      // Rollout is authoritative for Codex lifecycle. Hooks retain permissions
      // and transient failures without duplicate start/completion notifications.
      if(decision.source==='codex' && ['prompt','tool_start','tool_end','done','session_start'].includes(decision.event)) {
        sendJson(res,202,{ok:true,ignored:true,reason:'Codex rollout observer handles this event'});return;
      }
      if (decision.source !== getActiveHookAgent()) {
        sendJson(res, 202, {
          ok: true,
          ignored: true,
          reason: `Inactive hook source. Listening to ${getActiveHookAgent()}.`,
          decision,
          activeHookAgent: getActiveHookAgent(),
          hooks: getHookStatus()
        });
        return;
      }

      if(activePet?.id === "kurimanju") {fatigue.observe(decision.event,decision.sessionId);sendToWindows("pet:set-fatigue",fatigue.status());}
      const result = applyAgentDecision(decision);
      sendJson(res, 200, {
        ok: true,
        decision,
        display: result.display,
        aggregate: result.aggregate,
        sessions: result.sessions,
        activePet: toPetPayload(activePet)
      });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }

  if (url.pathname === "/permission" && req.method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const source = normalizeHookAgent(url.searchParams.get("source") || body.source || "codebuddy");
      const decision = buildDecision({
        ...body,
        source,
        hook_event_name: body.hook_event_name || body.event || "PermissionRequest"
      });

      if (decision) {
        recordHookEvent(decision);
        if (decision.source === getActiveHookAgent()) {
          applyAgentDecision(decision);
        }
      }

      sendJson(res, 200, {
        ok: true,
        decision: "allow",
        activeHookAgent: getActiveHookAgent()
      });
    } catch (error) {
      sendJson(res, 200, {
        ok: false,
        decision: "allow",
        error: error.message
      });
    }
    return;
  }

  if (url.pathname === "/state" && req.method === "GET") {
    sendJson(res, 200, {
      ...currentState,
      agentSessions: agentSessions.snapshot(),
      activePet: toPetPayload(activePet)
    });
    return;
  }

  if (url.pathname === "/state" && req.method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const state = typeof body.state === "string" ? body.state : "idle";
      const message = typeof body.message === "string" ? body.message.slice(0, 120) : "";
      const durationMs = Number.isFinite(Number(body.durationMs)) ? Number(body.durationMs) : 0;

      if (body.petId || body.petKey) {
        selectPet(String(body.petId || body.petKey), body.petSource);
      }

      if (!VALID_STATES.has(state)) {
        sendJson(res, 400, {
          ok: false,
          error: `Invalid state. Use one of: ${Array.from(VALID_STATES).join(", ")}`
        });
        return;
      }

      broadcastState({ state, message });

      if (durationMs > 0) {
        setTimeout(() => {
          if (currentState.state === state) {
            broadcastState({ state: "idle", message: "Ready" });
          }
        }, Math.min(durationMs, 60_000));
      }

      sendJson(res, 200, {
        ok: true,
        state: currentState,
        activePet: toPetPayload(activePet)
      });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }

  // ---- Reminder API ----

  if (url.pathname === "/reminders" && req.method === "GET") {
    sendJson(res, 200, { ok: true, reminders: reminderManager ? reminderManager.getStatus() : null });
    return;
  }

  if (url.pathname === "/reminders/config" && req.method === "POST") {
    try {
      const body = await parseJsonBody(req);
      if (!reminderManager) {
        sendJson(res, 503, { ok: false, error: "Reminder manager not initialized" });
        return;
      }
      const result = reminderManager.updateConfig(body);
      sendJson(res, result.ok ? 200 : 400, result);
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }

  if (url.pathname === "/reminders/trigger" && req.method === "POST") {
    try {
      const body = await parseJsonBody(req);
      if (!reminderManager) {
        sendJson(res, 503, { ok: false, error: "Reminder manager not initialized" });
        return;
      }
      const result = reminderManager.triggerNow(body.typeId || body.id);
      sendJson(res, result.ok ? 200 : 400, result);
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }

  if (url.pathname === "/reminders/reset" && req.method === "POST") {
    try {
      const body = await parseJsonBody(req);
      if (!reminderManager) {
        sendJson(res, 503, { ok: false, error: "Reminder manager not initialized" });
        return;
      }
      const result = reminderManager.reset(body.typeId || body.id);
      sendJson(res, result.ok ? 200 : 400, result);
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
}

function createApiServer() {
  server = http.createServer((req, res) => {
    handleApiRequest(req, res).catch((error) => {
      sendJson(res, 500, { ok: false, error: error.message });
    });
  });

  server.listen(API_PORT, API_HOST, () => {
    console.log(`Desktop pet API listening on http://${API_HOST}:${API_PORT}`);
  });
}

function buildTrayMenu() {
 return Menu.buildFromTemplate([
 {label:"보이기 / 숨기기",click:()=>{if(!win)return;if(win.isVisible()){win.hide();bubbleWin?.hide();}else win.show();}},
 {label:"캐릭터 선택",submenu:["shisa","kurimanju"].map(id=>({label:id==="shisa"?"시사":"쿠리만쥬",type:"radio",checked:activePet?.id===id,click:()=>{selectPet(id);rebuildTrayMenu();}}))},
 {label:'캐릭터 위치 초기화',click:resetPetPosition},
 {type:'separator'},
 {label:updateMenuLabel(updateStatus),enabled:!updateCheckInProgress&&!updateDownloadInProgress&&!updateInstallStarted,click:()=>checkForUpdates(true)}
 ]);
}

function resetPetPosition(){
 if(!win||win.isDestroyed())return;
 const area=screen.getPrimaryDisplay().workArea;
 const zoom=Math.min(clampZoom(settings.zoom||1),area.width/BASE_WINDOW_WIDTH,area.height/BASE_WINDOW_HEIGHT);
 const bounds=constrainBounds({x:area.x+40,y:area.y+220,width:Math.round(BASE_WINDOW_WIDTH*zoom),height:Math.round(BASE_WINDOW_HEIGHT*zoom)},area);
 win.setBounds(bounds);settings.zoom=zoom;settings.windowBounds=win.getBounds();saveSettings();
 broadcastZoom();win.show();positionBubble();
 if(currentState.message)showBubble(buildBubbleItems(currentState));
}

function rebuildTrayMenu() {
  if (!tray || tray.isDestroyed()) return;
  tray.setContextMenu(buildTrayMenu());
}

function createTray() {
  const icon = createAppIcon().resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip("Desktop Pet Agent");
  tray.setContextMenu(buildTrayMenu());
}

function configureMacMenuBarMode() {
  if (process.platform !== "darwin") return;
  app.setActivationPolicy("accessory");
  app.dock.hide();
}

app.whenReady().then(() => {
  app.setName("Chiikawa Codex Pet");
  configureMacMenuBarMode();
  if (process.platform === "win32") app.setAppUserModelId("io.github.alt030.chiikawa-codex-pet");
  loadSettings();
  discoverPets();
  setupAutoUpdater();
  createWindow();
  createBubbleWindow();
  createTray();
  createApiServer();
  for(const event of ['display-added','display-removed','display-metrics-changed'])screen.on(event,()=>{resizePetWindow(settings.zoom||1);keepPetOnScreen(true);});
  codexObserver.start();
  quota.refresh();
  idleCompanionTimer=setInterval(()=>{
    const busy=agentSessions.list().some(s=>s.state!=='idle') || [...codexObserver.files.values()].some(t=>t.active&&!t.ignored);
    const stage=idleCompanion.tick({busy,visible:Boolean(win?.isVisible())});if(!stage)return;
    if(stage==='sleep'){
      broadcastState({state:'sleeping',message:'',source:null,sessionId:null,agentEvent:'idle_sleep',editingFiles:[]});return;
    }
    const kuri=activePet?.id==='kurimanju';
    const message=kuri?'흠...':stage==='first'?'샤부님~ 잠깐 쉬고 계세요? (궁금한 시사)':'샤부님~ 저도 공부하고 있을게요! (공부하는 시사)';
    broadcastState({state:stage==='first'?'waving':'review',message,source:null,sessionId:null,agentEvent:'idle_chatter_'+stage,editingFiles:[]});
    idleBubbleReturnTimer=setTimeout(()=>{
      if(currentState.agentEvent?.startsWith('idle_chatter_'))broadcastState({state:'idle',message:'',source:null,sessionId:null,agentEvent:'idle_rest'});
    },12000);
  },5000);
  setInterval(()=>sendToWindows("pet:set-fatigue",fatigue.status()),5000);

  reminderManager = new ReminderManager({
    reminders: settings.reminders,
    save: (config) => {
      settings.reminders = config;
      saveSettings();
      rebuildTrayMenu();
    },
    onTrigger: ({ typeId, label, state, message, durationSeconds }) => {
      broadcastState({ state, message });
      if (durationSeconds > 0) {
        setTimeout(() => {
          broadcastState({ state: "idle", message: "" });
        }, durationSeconds * 1000);
      }
    }
  });
  reminderManager.start();

  ipcMain.handle("pet:get-initial-state", () => buildInitialPayload());
  ipcMain.handle("pet:list-pets", () => {
    discoverPets();
    return {
      ok: true,
      pets: pets.map(toPetPayload),
      activePet: toPetPayload(activePet),
      actions: ACTIONS,
      storage: getPetStorageInfo()
    };
  });
  ipcMain.handle("pet:get-hook-status", () => {
    return { ok: true, hooks: getHookStatus() };
  });
  ipcMain.handle("pet:get-update-status", () => {
    return { ok: true, update: getUpdateStatus() };
  });
  ipcMain.handle("pet:check-for-updates", async () => {
    return { ok: true, update: await checkForUpdates(true) };
  });
  ipcMain.handle("pet:install-update", () => {
    return { ok: true, update: installDownloadedUpdate() };
  });
  ipcMain.handle("pet:open-releases", async () => {
    await shell.openExternal(RELEASES_URL);
    return { ok: true };
  });
  ipcMain.handle("pet:install-hooks", (_event, payload) => {
    try {
      return installHookAgent(payload?.agent);
    } catch (error) {
      return { ok: false, error: error.message, hooks: getHookStatus() };
    }
  });
  ipcMain.handle("pet:select-hook-agent", (_event, payload) => {
    try {
      return selectHookAgent(payload?.agent);
    } catch (error) {
      return { ok: false, error: error.message, activeHookAgent: getActiveHookAgent(), hooks: getHookStatus() };
    }
  });
  ipcMain.handle("pet:select-pet", (_event, payload) => {
    const ok = selectPet(String(payload?.id || payload?.key || ""), payload?.source);
    return { ok, activePet: toPetPayload(activePet), pets: pets.map(toPetPayload) };
  });
  ipcMain.handle("pet:select-storage", (_event, payload) => {
    try {
      return selectPetStorage(payload?.storage, payload?.customDir);
    } catch (error) {
      return { ok: false, error: error.message, storage: getPetStorageInfo(), pets: pets.map(toPetPayload), activePet: toPetPayload(activePet) };
    }
  });
  ipcMain.handle("pet:choose-custom-storage", async () => {
    try {
      return await chooseCustomPetStorage();
    } catch (error) {
      return { ok: false, error: error.message, storage: getPetStorageInfo(), pets: pets.map(toPetPayload), activePet: toPetPayload(activePet) };
    }
  });
  ipcMain.handle("pet:open-folder", async (_event, payload) => {
    try {
      return await openPetFolder(payload?.kind);
    } catch (error) {
      return { ok: false, error: error.message, storage: getPetStorageInfo() };
    }
  });
  ipcMain.handle("pet:set-state", (_event, payload) => {
    const state = String(payload?.state || "idle");
    if (!VALID_STATES.has(state)) return { ok: false, error: "Invalid state" };
    const durationMs = Number.isFinite(Number(payload?.durationMs)) ? Number(payload.durationMs) : 0;
    broadcastState({
      state,
      message: typeof payload?.message === "string" ? payload.message.slice(0, 120) : ""
    });
    if (durationMs > 0) {
      const returnState = typeof payload?.returnState === "string" && VALID_STATES.has(payload.returnState)
        ? payload.returnState
        : "idle";
      setTimeout(() => {
        if (currentState.state === state) {
          broadcastState({ state: returnState, message: "" });
        }
      }, Math.min(durationMs, 60_000));
    }
    return { ok: true, state: currentState };
  });
  ipcMain.handle("pet:get-window-bounds", () => {
    if (!win || win.isDestroyed()) return null;
    return win.getBounds();
  });
  ipcMain.handle("pet:get-window-placement", () => getWindowPlacement());
  ipcMain.handle("pet:move-window", (_event, point) => {
    if (!win || win.isDestroyed() || !point) return false;
    const x = Math.round(Number(point.x));
    const y = Math.round(Number(point.y));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const proposed={...win.getBounds(),x,y};
    const safe=constrainBounds(proposed,screen.getDisplayMatching(proposed).workArea);
    win.setPosition(safe.x, safe.y);
    positionBubble();
    return true;
  });
  ipcMain.handle("pet:resize-window", (_event, payload) => {
    return resizePetWindow(payload?.zoom);
  });
  ipcMain.handle("pet:resize-bubble", (_event, payload) => {
    return resizeBubble(payload?.bubbleScale || payload?.scale);
  });
  ipcMain.handle("bubble:measure", (_event, size) => {
    positionBubble(size);
    if (bubbleWin && !bubbleWin.isDestroyed() && currentState.message) {
      bubbleWin.showInactive();
    }
    return true;
  });
  ipcMain.handle("pet:finish-drag", () => {
    keepPetOnScreen();
    if (win && !win.isDestroyed()) {
      settings.windowBounds = win.getBounds();
      saveSettings();
    }

    if (stateBeforeDrag) {
      broadcastState(stateBeforeDrag);
      stateBeforeDrag = null;
    } else {
      broadcastState({ state: "idle", message: "" });
    }
    return true;
  });
  ipcMain.on("pet:drag-direction", (_event, state) => {
    if (!["running-left", "running-right"].includes(state)) return;
    if (!stateBeforeDrag) stateBeforeDrag = { ...currentState };
    if (normalizeState(currentState.state) !== state) {
      broadcastState({ state, message: "" });
    }
  });


  ipcMain.handle("pet:get-reminders", () => {
    return { ok: true, reminders: reminderManager ? reminderManager.getStatus() : null };
  });
  ipcMain.handle("pet:update-reminder-config", (_event, payload) => {
    if (!reminderManager) return { ok: false, error: "Reminder engine not ready" };
    return reminderManager.updateConfig(payload);
  });
  ipcMain.handle("pet:trigger-reminder", (_event, payload) => {
    if (!reminderManager) return { ok: false, error: "Reminder engine not ready" };
    return reminderManager.triggerNow(payload?.typeId || payload?.id);
  });
  ipcMain.handle("pet:reset-reminders", (_event, payload) => {
    if (!reminderManager) return { ok: false, error: "Reminder engine not ready" };
    return reminderManager.reset(payload?.typeId || payload?.id);
  });

  setTimeout(() => {
    checkForUpdates(false).catch((error) => {
      console.warn(`Silent update check failed: ${error.message}`);
    });
  }, 1000);
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
});

app.on("before-quit", () => {
  clearInterval(idleCompanionTimer);
  clearTimeout(idleBubbleReturnTimer);
  codexObserver.stop();
  toolDisplayGate.stop();
  quota.stop();
  if (reminderManager) reminderManager.stop();
  if (server) server.close();
});


