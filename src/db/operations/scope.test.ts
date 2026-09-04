import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../database";
import type { ProjectId } from "../schemas";
import {
  createGuardrailEntry,
  setGuardrailDisabledInProject,
} from "./guardrails";
import {
  appliesToProject,
  isActiveInProject,
  isDisabledInProject,
} from "./scope";
import {
  createStyleGuideEntry,
  getStyleGuideEntry,
  listStyleGuideForProject,
  setStyleGuideDisabledInProject,
} from "./style-guide";

const projectA = "11111111-1111-4111-8111-111111111111" as ProjectId;
const projectB = "22222222-2222-4222-8222-222222222222" as ProjectId;

function resetTables() {
  return Promise.all([
    db.styleGuideEntries.clear(),
    db.guardrailEntries.clear(),
  ]);
}

describe("scope predicates", () => {
  it("appliesToProject covers globals and the matching project only", () => {
    const global = { projectId: null };
    const scopedA = { projectId: projectA };
    expect(appliesToProject(global, projectA)).toBe(true);
    expect(appliesToProject(global, projectB)).toBe(true);
    expect(appliesToProject(scopedA, projectA)).toBe(true);
    expect(appliesToProject(scopedA, projectB)).toBe(false);
  });

  it("isDisabledInProject checks the per-project disable list", () => {
    const entry = { projectId: null, disabledProjectIds: [projectA] };
    expect(isDisabledInProject(entry, projectA)).toBe(true);
    expect(isDisabledInProject(entry, projectB)).toBe(false);
    expect(isDisabledInProject(entry, null)).toBe(false);
  });

  it("isActiveInProject requires scope membership and not disabled", () => {
    const global = { projectId: null, disabledProjectIds: [projectA] };
    // Global disabled in A is inactive in A but active in B.
    expect(isActiveInProject(global, projectA)).toBe(false);
    expect(isActiveInProject(global, projectB)).toBe(true);
  });
});

describe("style guide scope operations", () => {
  beforeEach(resetTables);

  it("merges globals with project entries and excludes other projects", async () => {
    await createStyleGuideEntry({ title: "Global" });
    await createStyleGuideEntry({ title: "For A", projectId: projectA });
    await createStyleGuideEntry({ title: "For B", projectId: projectB });

    const titles = (await listStyleGuideForProject(projectA)).map(
      (e) => e.title,
    );
    expect(titles).toContain("Global");
    expect(titles).toContain("For A");
    expect(titles).not.toContain("For B");
  });

  it("assigns distinct incrementing order within the global scope", async () => {
    const first = await createStyleGuideEntry({ title: "G1" });
    const second = await createStyleGuideEntry({ title: "G2" });
    expect(first.order).toBe(0);
    expect(second.order).toBe(1);
  });

  it("keeps separate order sequences per scope", async () => {
    const globalFirst = await createStyleGuideEntry({ title: "G1" });
    const projectFirst = await createStyleGuideEntry({
      title: "P1",
      projectId: projectA,
    });
    expect(globalFirst.order).toBe(0);
    expect(projectFirst.order).toBe(0);
  });

  it("toggles per-project disable for a global entry without affecting others", async () => {
    const entry = await createStyleGuideEntry({ title: "Global" });
    await setStyleGuideDisabledInProject(entry.id, projectA, true);

    const reloaded = await getStyleGuideEntry(entry.id);
    if (!reloaded) throw new Error("entry should exist after disable toggle");
    expect(reloaded.disabledProjectIds).toEqual([projectA]);
    expect(isActiveInProject(reloaded, projectA)).toBe(false);
    expect(isActiveInProject(reloaded, projectB)).toBe(true);

    await setStyleGuideDisabledInProject(entry.id, projectA, false);
    const cleared = await getStyleGuideEntry(entry.id);
    expect(cleared?.disabledProjectIds).toEqual([]);
  });
});

describe("guardrail scope operations", () => {
  beforeEach(resetTables);

  it("toggles per-project disable for a guardrail", async () => {
    const entry = await createGuardrailEntry({ label: "No clichés" });
    await setGuardrailDisabledInProject(entry.id, projectA, true);
    const reloaded = await db.guardrailEntries.get(entry.id);
    expect(reloaded?.disabledProjectIds).toEqual([projectA]);
  });
});
