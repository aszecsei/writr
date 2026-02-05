"use client";

import { forwardRef, useLayoutEffect, useRef, useState } from "react";
import { ASPECT_RATIOS, TEMPLATES } from "@/lib/preview-card/templates";
import type { CardAspectRatio, CardTemplate } from "@/lib/preview-card/types";

const MIN_FONT_SIZE = 24;
const MAX_FONT_SIZE = 96;
const PADDING = 96;
const BRUSHSTROKE_WIDTH = 32;
const BRUSHSTROKE_EXTEND = 40;
const ATTRIBUTION_MARGIN = 80;

interface PreviewCardCanvasProps {
  selectedHtml: string;
  projectTitle: string;
  chapterTitle: string;
  template: CardTemplate;
  aspectRatio: CardAspectRatio;
  fontFamily: string;
  showWorkTitle: boolean;
  showChapterTitle: boolean;
}

export const PreviewCardCanvas = forwardRef<
  HTMLDivElement,
  PreviewCardCanvasProps
>(function PreviewCardCanvas(
  {
    selectedHtml,
    projectTitle,
    chapterTitle,
    template,
    aspectRatio,
    fontFamily,
    showWorkTitle,
    showChapterTitle,
  },
  ref,
) {
  const style = TEMPLATES[template];
  const ratio = ASPECT_RATIOS[aspectRatio];
  const textRef = useRef<HTMLQuoteElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(MAX_FONT_SIZE);
  const [wrapperHeight, setWrapperHeight] = useState(0);

  const scaleFactor = 0.35;
  const displayWidth = ratio.width * scaleFactor;
  const displayHeight = ratio.height * scaleFactor;

  const hasAttribution = showWorkTitle || showChapterTitle;
  const availableWidth = ratio.width - PADDING * 2 - BRUSHSTROKE_WIDTH;
  const availableHeight =
    ratio.height -
    PADDING * 2 -
    (hasAttribution ? ATTRIBUTION_MARGIN : 0) -
    BRUSHSTROKE_EXTEND * 2;

  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedHtml and fontFamily affect text measurement
  useLayoutEffect(() => {
    const textEl = textRef.current;
    if (!textEl) return;

    let low = MIN_FONT_SIZE;
    let high = MAX_FONT_SIZE;
    let bestFit = MIN_FONT_SIZE;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      textEl.style.fontSize = `${mid}px`;

      const fits =
        textEl.scrollWidth <= availableWidth &&
        textEl.scrollHeight <= availableHeight;

      if (fits) {
        bestFit = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    setFontSize(bestFit);

    if (wrapperRef.current) {
      setWrapperHeight(wrapperRef.current.offsetHeight);
    }
  }, [selectedHtml, availableWidth, availableHeight, fontFamily]);

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: displayWidth,
        height: displayHeight,
      }}
    >
      <div
        ref={ref}
        style={{
          width: ratio.width,
          height: ratio.height,
          background: style.background,
          border: style.borderStyle,
          transform: `scale(${scaleFactor})`,
          transformOrigin: "top left",
          boxSizing: "border-box",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Quote content */}
        <div
          style={{
            position: "absolute",
            top: PADDING,
            left: PADDING,
            right: PADDING,
            bottom: PADDING + (hasAttribution ? ATTRIBUTION_MARGIN : 0),
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            ref={wrapperRef}
            style={{
              position: "relative",
              maxWidth: availableWidth + BRUSHSTROKE_WIDTH,
              paddingLeft: BRUSHSTROKE_WIDTH,
              paddingTop: BRUSHSTROKE_EXTEND,
              paddingBottom: BRUSHSTROKE_EXTEND,
              ...(style.textBackground && {
                background: style.textBackground,
                paddingRight: BRUSHSTROKE_WIDTH,
                borderRadius: 16,
              }),
            }}
          >
            {!style.textBackground && (
              <svg
                viewBox="0 0 40 200"
                preserveAspectRatio="none"
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 0,
                  top: BRUSHSTROKE_EXTEND / 3,
                  width: 14,
                  height: wrapperHeight || "100%",
                  opacity: 0.55,
                }}
              >
                <path
                  d={`
                    M20 0
                    C12 8, 6 20, 8 40
                    C10 60, 2 80, 10 100
                    C18 120, 4 140, 12 160
                    C16 175, 8 185, 20 200
                    C32 185, 24 175, 28 160
                    C36 140, 22 120, 30 100
                    C38 80, 30 60, 32 40
                    C34 20, 28 8, 20 0
                    Z
                  `}
                  fill={style.accentColor}
                />
              </svg>
            )}
            <blockquote
              ref={textRef}
              style={{
                color: style.textColor,
                fontSize,
                lineHeight: 1.5,
                margin: 0,
                fontFamily,
              }}
              // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is generated from TipTap's document model via generateHTML, not external user input
              dangerouslySetInnerHTML={{ __html: selectedHtml }}
              className="[&_p]:mb-4 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_em]:italic"
            />
          </div>
        </div>

        {/* Attribution overlay */}
        {hasAttribution && (
          <div
            style={{
              position: "absolute",
              bottom: PADDING,
              left: PADDING,
              right: PADDING,
              color: style.accentColor,
              fontSize: "24px",
              letterSpacing: "0.05em",
              textAlign: "center",
              fontFamily,
            }}
          >
            {showWorkTitle && (
              <div style={{ fontWeight: 600 }}>{projectTitle}</div>
            )}
            {showChapterTitle && chapterTitle && (
              <div style={{ marginTop: "8px", fontSize: "20px" }}>
                {chapterTitle}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
