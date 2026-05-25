# Mutation tools require approval

Every AI tool that mutates project state must be gated on user approval (`requiresApproval: true`). Only read-only / non-mutating tools may be auto-approved. This is enforced by [[AgenticWriter]] hard-coding the flag — it is not a per-tool option.

The trade-off is latency: an agent that wants to write 10 entities triggers 10 approval prompts. We accept that cost because (a) silent mutations by agents would erode user trust irreversibly, and (b) the per-tool boilerplate that would tempt a "trusted: skip approval" escape hatch is exactly what AgenticWriter eliminates — so the temptation to add one disappears with this refactor.

If a future tool genuinely needs to bypass approval (e.g. a low-stakes structural update during an autonomous pipeline phase), it must reopen this ADR rather than passing `requiresApproval: false`.
