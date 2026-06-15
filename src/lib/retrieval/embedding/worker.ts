import { embedTexts } from "./pipeline";

export interface EmbedRequest {
  type: "embed";
  id: number;
  texts: string[];
}
type Outbound =
  | { type: "result"; id: number; vectors: number[][] }
  | { type: "error"; id: number; message: string };

self.onmessage = async (e: MessageEvent<EmbedRequest>) => {
  const msg = e.data;
  if (msg.type !== "embed") return;
  try {
    const vectors = await embedTexts(msg.texts);
    (self as unknown as Worker).postMessage({
      type: "result",
      id: msg.id,
      vectors,
    } satisfies Outbound);
  } catch (err) {
    (self as unknown as Worker).postMessage({
      type: "error",
      id: msg.id,
      message: err instanceof Error ? err.message : String(err),
    } satisfies Outbound);
  }
};
