// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccordionSection } from "./AccordionSection";

describe("AccordionSection", () => {
  it("renders open by default with the description", () => {
    render(
      <AccordionSection
        title="Sentence Length"
        description="How it breaks down."
      >
        <p>content</p>
      </AccordionSection>,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("How it breaks down.")).toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("renders collapsed when defaultOpen is false", () => {
    render(
      <AccordionSection title="Sentence Length" defaultOpen={false}>
        <p>content</p>
      </AccordionSection>,
    );
    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByText("content")).toBeNull();
  });

  it("toggles content on header click", () => {
    render(
      <AccordionSection title="Sentence Length" defaultOpen={false}>
        <p>content</p>
      </AccordionSection>,
    );
    const header = screen.getByRole("button");

    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("content")).toBeInTheDocument();

    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("content")).toBeNull();
  });
});
