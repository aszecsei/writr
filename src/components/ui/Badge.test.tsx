// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders the default variant", () => {
    const { container } = render(<Badge label="Draft" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("merges a className override", () => {
    const { container } = render(
      <Badge label="Pinned" className="bg-amber-200 text-amber-900" />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
