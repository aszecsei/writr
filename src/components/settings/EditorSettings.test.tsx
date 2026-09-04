// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_EDITOR_FONT, getEditorFont } from "@/lib/fonts";
import { EditorSettings } from "./EditorSettings";

const noop = vi.fn();

describe("EditorSettings", () => {
  it("renders a font option for every entry that resolves via getEditorFont", () => {
    render(
      <EditorSettings
        editorFont={DEFAULT_EDITOR_FONT}
        editorFontSize={16}
        autoSaveSeconds={5}
        readingSpeedWpm={200}
        autoFocusModeOnSprint={false}
        grammarCheckerEnabled={false}
        holeOpenDelimiter="["
        holeCloseDelimiter="]"
        holeHighlightOpacity={0.5}
        onEditorFontChange={noop}
        onEditorFontSizeChange={noop}
        onAutoSaveSecondsChange={noop}
        onReadingSpeedWpmChange={noop}
        onAutoFocusModeOnSprintChange={noop}
        onGrammarCheckerEnabledChange={noop}
        onHoleOpenDelimiterChange={noop}
        onHoleCloseDelimiterChange={noop}
        onHoleHighlightOpacityChange={noop}
        inputClass=""
        labelClass=""
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
