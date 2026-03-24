const STORAGE_KEY = 'board-of-life-sessions';

/**
 * Conversation memory manager using localStorage.
 * Stores named sessions, each with history, settings, and timestamps.
 */

function readAll() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeAll(sessions) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

/** List all saved sessions (most recent first). */
export function listSessions() {
  const sessions = readAll();
  return Object.entries(sessions)
    .map(([id, s]) => ({ id, name: s.name, updatedAt: s.updatedAt, messageCount: s.history.length }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Load a session by id. Returns null if not found. */
export function loadSession(id) {
  const sessions = readAll();
  return sessions[id] || null;
}

/** Save (create or update) a session. Returns the session id. */
export function saveSession({ id, name, history, systemPrompt, agents }) {
  const sessions = readAll();
  const sessionId = id || `session-${Date.now()}`;
  const existing = sessions[sessionId];
  sessions[sessionId] = {
    name: name || existing?.name || `Sessão ${new Date().toLocaleDateString('pt-BR')}`,
    history,
    systemPrompt: systemPrompt || '',
    agents: agents || existing?.agents || null,
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  writeAll(sessions);
  return sessionId;
}

/** Delete a session by id. */
export function deleteSession(id) {
  const sessions = readAll();
  delete sessions[id];
  writeAll(sessions);
}

/** Rename a session. */
export function renameSession(id, newName) {
  const sessions = readAll();
  if (sessions[id]) {
    sessions[id].name = newName;
    sessions[id].updatedAt = Date.now();
    writeAll(sessions);
  }
}
