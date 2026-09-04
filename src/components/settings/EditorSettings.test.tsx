// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_EDITOR_FONT, getEditorFont } from "@/lib/fonts";
import { DEFAULT_APP_SETTINGS_DRAFT } from "./AppSettingsDialog";
import { EditorSettings } from "./EditorSettings";

const noop = vi.fn();

describe("EditorSettings", () => {
  it("renders a font option for every entry that resolves via getEditorFont", () => {
    render(
      <EditorSettings
        draft={{
          ...DEFAULT_APP_SETTINGS_DRAFT,
          editorFont: DEFAULT_EDITOR_FONT,
          editorFontSize: 16,
          autoSaveSeconds: 5,
          readingSpeedWpm: 200,
          holeOpenDelimiter: "[",
          holeCloseDelimiter: "]",
          holeHighlightOpacity: 0.5,
        }}
        setField={noop}
        onHoleHighlightOpacityChange={noop}
      />,
    );

    const options = screen.getAllByRole<HTMLOptionElement>("option", {
      name: /.+/,
    });

    expect(options.length).toBeGreaterThan(0);

    for (const option of options) {
      const resolved = getEditorFont(option.value);
      expect(resolved.id).toBe(option.value);
    }
  });
});
