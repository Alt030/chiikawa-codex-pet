const STATE_PRIORITY = {
  failed: 35,
  waiting: 40,
  running: 50,
  review: 20,
  waving: 10,
  jumping: 10,
  idle: 0
};

const MAX_RECENT_EVENTS = 12;

function nowIso(now) {
  return new Date(now()).toISOString();
}

function createIdleSnapshot() {
  return {
    state: "idle",
    message: "",
    sessionId: null,
    source: null,
    updatedAt: new Date().toISOString()
  };
}

function compareSessions(left, right) {
  const leftPriority = STATE_PRIORITY[left.state] || 0;
  const rightPriority = STATE_PRIORITY[right.state] || 0;
  if (leftPriority !== rightPriority) return rightPriority - leftPriority;
  return right.updatedAtMs - left.updatedAtMs;
}

class SessionManager {
  constructor(options = {}) {
    this.now = typeof options.now === "function" ? options.now : Date.now;
    this.sessions = new Map();
  }

  apply(decision) {
    const atMs = this.now();
    const updatedAt = nowIso(this.now);
    const sessionId = decision.sessionId;

    if (decision.terminal) {
      this.sessions.delete(sessionId);
    } else if (decision.persistentState) {
      const existing = this.sessions.get(sessionId);
      this.sessions.set(sessionId, {
        sessionId,
        source: decision.source,
        state: decision.persistentState,
        message: decision.message || "",
        event: decision.event,
        editingFiles: decision.editingFiles || [],
        updatedAt,
        updatedAtMs: atMs,
        recentEvents: pushRecentEvent(existing, decision, updatedAt)
      });
    } else if (decision.visualState && !this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        sessionId,
        source: decision.source,
        state: "idle",
        message: "",
        event: decision.event,
        updatedAt,
        updatedAtMs: atMs,
        recentEvents: [{ event: decision.event, state: decision.visualState, updatedAt }]
      });
      this.sessions.delete(sessionId);
    }

    const aggregate = this.getAggregate();
    const showDecision = aggregate.state === 'idle' || aggregate.sessionId === sessionId;
    const display = {
      state: showDecision ? decision.visualState || aggregate.state : aggregate.state,
      message: showDecision ? decision.message || aggregate.message || '' : aggregate.message,
      source: showDecision ? decision.source : aggregate.source,
      sessionId: showDecision ? sessionId : aggregate.sessionId,
      agentEvent: showDecision ? decision.event : aggregate.event,
      editingFiles: showDecision ? decision.editingFiles || [] : aggregate.editingFiles || [],
      durationMs: showDecision ? Math.max(0, Math.min(Number(decision.durationMs) || 0, 60_000)) : 0,
      returnState: aggregate
    };

    return {
      display,
      aggregate,
      sessions: this.list()
    };
  }

  getAggregate() {
    const active = this.list().filter((session) => session.state !== "idle");
    if (active.length === 0) return createIdleSnapshot();

    const top = active.sort(compareSessions)[0];
    return {
      state: top.state,
      message: top.message || "",
      sessionId: top.sessionId,
      source: top.source,
      event: top.event,
      editingFiles: top.editingFiles || [],
      updatedAt: top.updatedAt
    };
  }

  list() {
    return Array.from(this.sessions.values())
      .sort(compareSessions)
      .map((session) => ({
        sessionId: session.sessionId,
        source: session.source,
        state: session.state,
        message: session.message,
        event: session.event,
        editingFiles: session.editingFiles || [],
        updatedAt: session.updatedAt,
        recentEvents: session.recentEvents
      }));
  }

  snapshot() {
    return {
      aggregate: this.getAggregate(),
      sessions: this.list()
    };
  }

  clear() {
    this.sessions.clear();
    return this.snapshot();
  }
}

function pushRecentEvent(existing, decision, updatedAt) {
  const previous = Array.isArray(existing?.recentEvents) ? existing.recentEvents : [];
  return [
    ...previous.slice(-(MAX_RECENT_EVENTS - 1)),
    {
      event: decision.event,
      state: decision.visualState || decision.persistentState || "idle",
      updatedAt
    }
  ];
}

module.exports = {
  STATE_PRIORITY,
  SessionManager
};
