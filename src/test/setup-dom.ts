import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Tear down any rendered DOM between tests so getByText / getByRole queries
// don't accidentally match nodes left by a prior test in the same file.
afterEach(() => {
  cleanup();
});
