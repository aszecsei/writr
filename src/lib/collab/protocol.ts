/**
 * Re-exports the collab wire protocol from its single source of truth in
 * `collab/src/protocol.ts`. The relay is built and Dockerised from
 * `collab/` alone, so the shared module lives there; the Next app reaches
 * it through the `@collab/*` path alias (see `tsconfig.json`).
 */
export * from "@collab/protocol";
