import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    // Default environment is node. Component / hook tests opt into jsdom
    // by adding `// @vitest-environment jsdom` to the file header. Both
    // setup files load globally; they're harmless in either environment.
    environment: "node",
    setupFiles: ["./src/test/setup.ts", "./src/test/setup-dom.ts"],
    exclude: ["node_modules", "dist", ".next", "collab/**"],
  },
});
