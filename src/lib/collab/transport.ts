import type { CollabClient, CollabTransport } from "./client";

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
}

export function createWebSocketTransport(ws: WebSocketLike): CollabTransport {
  return {
    send: (data) => ws.send(data),
    close: (code, reason) => ws.close(code, reason),
  };
}

export function wireWebSocketToClient(
  ws: WebSocketLike,
  client: CollabClient,
): void {
  ws.addEventListener("open", () => {
    client.handleOpen();
  });
  ws.addEventListener("message", (event) => {
    const raw =
      typeof event.data === "string"
        ? event.data
        : event.data instanceof ArrayBuffer
          ? new TextDecoder().decode(event.data)
          : "";
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
