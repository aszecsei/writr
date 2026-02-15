# AI Adapter Structure

This folder implements provider-specific adapters behind a shared
`ProviderAdapter` interface.

## Design Notes

- `types.ts` defines the shared contract used by the rest of the AI layer.
- Each provider adapter (`openai`, `anthropic`, `google`) is responsible for:
  - Translating shared messages to provider request formats.
  - Mapping provider responses back into `AiResponse` / `AiStreamChunk`.
  - Normalizing provider-specific finish reasons to shared `FinishReason`.
- `helpers.ts` contains cross-provider helper utilities that should stay
  provider-agnostic.

## Refactoring Guideline

When adding providers or extending existing ones:

- Keep request building in private helper functions inside the adapter to avoid
  duplicate logic between `complete` and `stream`.
- Reuse shared utilities from `helpers.ts` when logic is provider-agnostic.
- Preserve adapter-level tests to verify translation behavior and finish reason
  normalization.
