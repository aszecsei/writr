/**
 * Binding-spec parsing and keyboard-event matching for the shortcut registry.
 *
 * A spec is one of two shapes, distinguished by whitespace:
 *  - **Combo** — modifiers + a key joined by `+`, e.g. `"Mod+Shift+F"`, `"?"`.
 *    `Mod` resolves to ⌘ on macOS and Ctrl elsewhere (mirrors TipTap's `Mod-`).
 *  - **Sequence** — space-separated plain keys typed in order, e.g. `"g o"`.
 */

export interface ParsedCombo {
  /** Platform modifier: ⌘ on macOS, Ctrl elsewhere. */
  mod: boolean;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
  /** The non-modifier key, lowercased. */
  key: string;
}

export type ParsedBinding =
  | { kind: "combo"; combo: ParsedCombo }
  | { kind: "sequence"; tokens: string[] };

/** True when the spec is a chord sequence (contains whitespace). */
export function isSequenceSpec(spec: string): boolean {
  return /\s/.test(spec.trim());
}

export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  const id = navigator.platform || navigator.userAgent || "";
  return /mac|iphone|ipad|ipod/i.test(id);
}

function parseCombo(spec: string): ParsedCombo {
  const combo: ParsedCombo = {
    mod: false,
    ctrl: false,
    meta: false,
    alt: false,
    shift: false,
    key: "",
  };
  for (const raw of spec.split("+")) {
    const token = raw.trim();
    if (!token) continue;
    switch (token.toLowerCase()) {
      case "mod":
        combo.mod = true;
        break;
      case "ctrl":
      case "control":
        combo.ctrl = true;
        break;
      case "meta":
      case "cmd":
      case "command":
        combo.meta = true;
        break;
      case "alt":
      case "option":
        combo.alt = true;
        break;
      case "shift":
        combo.shift = true;
        break;
      default:
        combo.key = token.toLowerCase();
    }
  }
  if (!combo.key) {
    throw new Error(`Invalid binding spec "${spec}": no key`);
  }
  return combo;
}

export function parseBinding(spec: string): ParsedBinding {
  const trimmed = spec.trim();
  if (isSequenceSpec(trimmed)) {
    return {
      kind: "sequence",
      tokens: trimmed.split(/\s+/).map((t) => t.toLowerCase()),
    };
  }
  return { kind: "combo", combo: parseCombo(trimmed) };
}

/**
 * Whether a keyboard event matches a parsed combo. Ctrl/Meta/Alt are matched
 * strictly. Shift is enforced only for alphanumeric keys (or when the spec
 * lists it explicitly) so shifted symbols like `?` still match.
 */
export function matchCombo(
  combo: ParsedCombo,
  event: KeyboardEvent,
  mac: boolean = isMac(),
): boolean {
  const wantCtrl = combo.ctrl || (combo.mod && !mac);
  const wantMeta = combo.meta || (combo.mod && mac);
  if (event.ctrlKey !== wantCtrl) return false;
  if (event.metaKey !== wantMeta) return false;
  if (event.altKey !== combo.alt) return false;

  const keyIsAlnum = combo.key.length === 1 && /[a-z0-9]/.test(combo.key);
  if (keyIsAlnum || combo.shift) {
    if (event.shiftKey !== combo.shift) return false;
  }
  return event.key.toLowerCase() === combo.key;
}

/**
 * Whether an event is a candidate key in a chord sequence: a single printable
 * key with no Ctrl/Meta/Alt held (Shift is tolerated and folded away by
 * lowercasing).
 */
export function isPlainKey(event: KeyboardEvent): boolean {
  return (
    !event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1
  );
}

/** Whether `buffer` ends with the full `tokens` sequence. */
export function bufferMatches(
  buffer: readonly string[],
  tokens: readonly string[],
): boolean {
  if (tokens.length === 0 || tokens.length > buffer.length) return false;
  const tail = buffer.slice(buffer.length - tokens.length);
  return tail.every((key, i) => key === tokens[i]);
}

const DEFAULT_CHORD_TIMEOUT_MS = 1000;
const MAX_BUFFER = 8;

/**
 * Accumulates recent plain keypresses so chord sequences (`g o`) can be matched
 * against the buffer's tail. The buffer resets when the gap between presses
 * exceeds the timeout. Time is injected (`now`) so tests stay deterministic.
 */
export class ChordTracker {
  private buffer: string[] = [];
  private lastTime = 0;

  constructor(private readonly timeoutMs = DEFAULT_CHORD_TIMEOUT_MS) {}

  reset(): void {
    this.buffer = [];
  }

  /** Record a plain key (lowercased) and return the live buffer. */
  push(key: string, now: number): readonly string[] {
    if (now - this.lastTime > this.timeoutMs) {
      this.buffer = [];
    }
    this.lastTime = now;
    this.buffer.push(key.toLowerCase());
    if (this.buffer.length > MAX_BUFFER) {
      this.buffer = this.buffer.slice(-MAX_BUFFER);
    }
    return this.buffer;
  }
}

function formatKeyLabel(key: string): string {
  switch (key) {
    case "escape":
      return "Esc";
    case " ":
    case "space":
      return "Space";
    case "arrowup":
      return "↑";
    case "arrowdown":
      return "↓";
    case "arrowleft":
      return "←";
    case "arrowright":
      return "→";
    default:
      return key.length === 1 ? key.toUpperCase() : key;
  }
}

/** Human-readable label for a binding spec, used in the help overlay. */
export function formatBinding(spec: string, mac: boolean = isMac()): string {
  const parsed = parseBinding(spec);
  if (parsed.kind === "sequence") {
    return parsed.tokens.map((t) => t.toUpperCase()).join(" then ");
  }
  const { combo } = parsed;
  const parts: string[] = [];
  if (combo.mod) parts.push(mac ? "⌘" : "Ctrl");
  if (combo.ctrl) parts.push(mac ? "⌃" : "Ctrl");
  if (combo.alt) parts.push(mac ? "⌥" : "Alt");
  if (combo.shift) parts.push(mac ? "⇧" : "Shift");
  parts.push(formatKeyLabel(combo.key));
  return mac ? parts.join("") : parts.join("+");
}
