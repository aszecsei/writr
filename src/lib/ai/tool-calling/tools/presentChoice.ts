import { z } from "zod";
import { defineTool } from "../types";
import { fail, ok } from "./helpers";

export const presentChoiceTool = defineTool({
  id: "present_choice",
  name: "Present Choice",
  description:
    "Pause and ask the user to pick one of several options before continuing. " +
    "Use this when a decision is genuinely the user's to make and you cannot " +
    "resolve it yourself. Returns the option the user selected. Works from both " +
    "the top-level agent and sub-agents — the prompt always surfaces to the user.",
  inputSchema: z.object({
    question: z.string().min(1).describe("The decision to put to the user."),
    options: z
      .array(z.string().min(1))
      .min(2)
      .max(8)
      .describe("Between 2 and 8 distinct options for the user to choose."),
  }),
  requiresApproval: false,
  async execute(params, context) {
    const host = context.delegation;
    if (!host) {
      return fail("present_choice is only available in interactive chat.");
    }
    const chosen = await host.requestChoice({
      question: params.question,
      options: params.options,
    });
    return ok(`User chose: ${chosen}`, { chosen });
  },
});
