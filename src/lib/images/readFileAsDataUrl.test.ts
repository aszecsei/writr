// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { estimateDataUrlBytes, readFileAsDataUrl } from "./readFileAsDataUrl";

describe("readFileAsDataUrl", () => {
  it("reads an image file into a data:image URL", async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], "cover.png", {
      type: "image/png",
    });

    const dataUrl = await readFileAsDataUrl(file);

    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("reads an empty file without hanging", async () => {
    const file = new File([], "empty.png", { type: "image/png" });

    await expect(readFileAsDataUrl(file)).resolves.toBe(
      "data:image/png;base64,",
    );
  });

  it("produces a URL whose media type reflects a non-image file, so callers can reject it", async () => {
    const file = new File(["not an image"], "notes.txt", {
      type: "text/plain",
    });

    const dataUrl = await readFileAsDataUrl(file);

    expect(dataUrl.startsWith("data:text/plain;base64,")).toBe(true);
  });
});

describe("estimateDataUrlBytes", () => {
  it("returns the decoded byte length of a base64 payload", () => {
    // "AAAA" decodes to 3 bytes, "AAA=" to 2, "AA==" to 1.
    expect(estimateDataUrlBytes("data:image/png;base64,AAAA")).toBe(3);
    expect(estimateDataUrlBytes("data:image/png;base64,AAA=")).toBe(2);
    expect(estimateDataUrlBytes("data:image/png;base64,AA==")).toBe(1);
  });

  it("returns 0 for an empty payload", () => {
    expect(estimateDataUrlBytes("data:image/png;base64,")).toBe(0);
  });

  it("returns 0 for a string with no payload separator", () => {
    expect(estimateDataUrlBytes("https://example.com/cover.jpg")).toBe(0);
  });
});
