import { afterEach, beforeEach } from "vitest";
import type {
  Chapter,
  ChapterId,
  Character,
  CharacterId,
  Project,
  ProjectId,
} from "@/db/schemas";
import { makeChapter, makeCharacter, makeProject } from "@/test/helpers";
import type { CollabTransport } from "./client";
import type { ProjectSnapshot } from "./projectMirror";
import type { ClientMessage, ServerMessage } from "./protocol";
import type { WebSocketLike } from "./transport";

export const PROJECT_ID = "00000000-0000-4000-8000-0000000000aa" as ProjectId;

export function project(overrides: Partial<Project> = {}): Project {
  return makeProject({ id: PROJECT_ID, title: "Project", ...overrides });
}

export function chapter(
  id: ChapterId,
  overrides: Partial<Chapter> = {},
): Chapter {
  return makeChapter({
    id,
    projectId: PROJECT_ID,
    title: `Ch ${id.slice(-1)}`,
    ...overrides,
  });
}

export function character(
  id: CharacterId,
  overrides: Partial<Character> = {},
): Character {
  return makeCharacter({
    id,
    projectId: PROJECT_ID,
    name: "Alice",
    ...overrides,
  });
}

export function emptySnapshot(): ProjectSnapshot {
  return {
    project: project(),
    activeChapterId: null,
    chapters: [],
    characters: [],
    characterRels: [],
    locations: [],
    worldbuilding: [],
    timeline: [],
    styleGuide: [],
    guardrails: [],
    outlineColumns: [],
    outlineRows: [],
    outlineCells: [],
  };
}

/**
 * Fake WebSocket driven by hand for handshake / lifecycle / manager tests.
 * Covers both host and guest flows: `fireOpen`/`fireServer`/`fireClose`/
 * `fireError` push events to whatever listeners `wireWebSocketToClient` (or
 * a raw handshake) registered.
 */
export class FakeWebSocket {
  readonly url: string;
  sent: string[] = [];
  closed: { code?: number; reason?: string } | null = null;
  private listeners: Record<string, Array<(event: unknown) => void>> = {};

  constructor(url = "fake://socket") {
    this.url = url;
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(code?: number, reason?: string): void {
    if (this.closed) return;
    const close: { code?: number; reason?: string } = {};
    if (code !== undefined) close.code = code;
    if (reason !== undefined) close.reason = reason;
    this.closed = close;
    this.dispatch("close", { code: code ?? 1000, reason: reason ?? "" });
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const bucket = this.listeners[type] ?? [];
    bucket.push(listener);
    this.listeners[type] = bucket;
  }

  fireOpen(): void {
    this.dispatch("open", undefined);
  }
  fireMessage(data: string): void {
    this.dispatch("message", { data });
  }
  fireServer(message: ServerMessage): void {
    this.fireMessage(JSON.stringify(message));
  }
  fireClose(code: number, reason: string): void {
    this.dispatch("close", { code, reason });
  }
  fireError(): void {
    this.dispatch("error", undefined);
  }

  private dispatch(type: string, event: unknown): void {
    for (const cb of this.listeners[type] ?? []) cb(event);
  }
}

export function asWebSocketLike(fake: FakeWebSocket): WebSocketLike {
  return fake as unknown as WebSocketLike;
}

/** In-memory `CollabTransport` for client/session-level tests. */
export class MockTransport implements CollabTransport {
  sent: ClientMessage[] = [];
  closed: { code?: number; reason?: string } | null = null;

  send(data: string): void {
    this.sent.push(JSON.parse(data) as ClientMessage);
  }
  close(code?: number, reason?: string): void {
    if (!this.closed) {
      this.closed = {};
      if (code !== undefined) this.closed.code = code;
      if (reason !== undefined) this.closed.reason = reason;
    }
  }
  reset(): void {
    this.sent = [];
    this.closed = null;
  }
}

/**
 * Advances the macrotask queue `turns` times. `crypto.subtle` operations
 * and Promise chains driven by fake sockets resolve across several ticks
 * under Node, so a single `await Promise.resolve()` isn't enough.
 */
export async function flush(turns = 6): Promise<void> {
  for (let i = 0; i < turns; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/**
 * Registers `beforeEach`/`afterEach` hooks that set `NEXT_PUBLIC_COLLAB_URL`
 * to `url` for the duration of every test declared inside `fn`, restoring
 * whatever value was present before the file loaded. Call at the top of a
 * test file (outside any `describe`) so the hooks scope to the whole file.
 */
export function withCollabEnv(url: string | undefined, fn: () => void): void {
  const original = process.env.NEXT_PUBLIC_COLLAB_URL;

  beforeEach(() => {
    if (url === undefined) delete process.env.NEXT_PUBLIC_COLLAB_URL;
    else process.env.NEXT_PUBLIC_COLLAB_URL = url;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_COLLAB_URL;
    else process.env.NEXT_PUBLIC_COLLAB_URL = original;
  });

  fn();
}
