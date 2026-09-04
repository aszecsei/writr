import type { CollabClient } from "./client";

export interface WebSocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: "open", listener: () => void): void;
  addEventListener(
    type: "message",
    listener: (event: { data: string | ArrayBuffer | Blob }) => void,
  ): void;
  addEventListener(
    type: "close",
    listener: (event: { code: number; reason: string }) => void,
  ): void;
  addEventListener(type: "error", listener: () => void): void;
  removeEventListener(type: "open", listener: () => void): void;
  removeEventListener(
    type: "message",
    listener: (event: { data: string | ArrayBuffer | Blob }) => void,
  ): void;
  removeEventListener(
    type: "close",
    listener: (event: { code: number; reason: string }) => void,
  ): void;
  removeEventListener(type: "error", listener: () => void): void;
}

/**
 * Decodes a raw WebSocket message payload to a string. Blob payloads
 * aren't supported (callers should set `binaryType = "arraybuffer"`) and
 * decode to "", same as an empty message.
 */
export function decodeWsData(data: string | ArrayBuffer | Blob): string {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  return "";
}

export function wireWebSocketToClient(
  ws: WebSocketLike,
  client: CollabClient,
): void {
  ws.addEventListener("open", () => {
    client.handleOpen();
  });
  ws.addEventListener("message", (event) => {
    const raw = decodeWsData(event.data);
    if (!raw) return;
    void client.handleMessage(raw);
  });
  ws.addEventListener("close", (event) => {
    client.handleClose(event.code, event.reason);
  });
  ws.addEventListener("error", () => {
    client.handleTransportError(new Error("WebSocket transport error"));
  });
}
