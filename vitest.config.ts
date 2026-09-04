import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@collab": resolve(__dirname, "collab/src"),
    },
  },
  test: {
    // Default environment is node. Component / hook tests opt into jsdom
    // by adding `// @vitest-environment jsdom` to the file header. Both
    // setup files load globally; they're harmless in either environment.
    environment: "node",
    // lib0 (a yjs dependency) probes `typeof localStorage` at module load to
    // pick between real storage and its polyfill. Node 26 exposes localStorage
    // as an experimental getter that warns on every access unless
    // --localstorage-file is passed, so every worker that imports the collab
    // code prints a warning. The polyfill fallback is the behaviour we want in
    // tests; only the warning is unwanted.
    execArgv: ["--disable-warning=ExperimentalWarning"],
    setupFiles: ["./src/test/setup.ts", "./src/test/setup-dom.ts"],
    exclude: ["node_modules", "dist", ".next", "collab/**"],
  },
});
