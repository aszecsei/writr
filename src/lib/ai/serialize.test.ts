import { describe, expect, it } from "vitest";
import {
  makeCharacter,
  makeLocation,
  makeRelationship,
  makeTimelineEvent,
  makeWorldbuildingDoc,
} from "@/test/helpers";
import {
  serializeCharacter,
  serializeLocation,
  serializeRelationship,
  serializeTimelineEvent,
  serializeWorldbuildingTree,
} from "./serialize";

const pid = "00000000-0000-4000-8000-000000000001";

describe("serializeCharacter", () => {
  it("serializes minimal character (no optional sub-elements)", () => {
    const c = makeCharacter({ projectId: pid, name: "Alice" });
    const xml = serializeCharacter(c);
    expect(xml).toContain('<character name="Alice" role="supporting">');
    expect(xml).toContain("</character>");
    // No optional elements when empty
    expect(xml).not.toContain("<description>");
    expect(xml).not.toContain("<aliases>");
  });

  it("includes pronouns attribute when present", () => {
    const c = makeCharacter({
      projectId: pid,
      name: "Bob",
      pronouns: "he/him",
    });
    const xml = serializeCharacter(c);
    expect(xml).toContain('pronouns="he/him"');
  });

  it("omits pronouns attribute when empty", () => {
    const c = makeCharacter({ projectId: pid, name: "NoPronouns" });
    const xml = serializeCharacter(c);
    expect(xml).not.toContain("pronouns=");
  });

  it("serializes all optional fields when populated", () => {
    const c = makeCharacter({
      projectId: pid,
      name: "Full",
      role: "protagonist",
      pronouns: "she/her",
      aliases: ["The One", "Neo"],
      description: "desc",
      personality: "pers",
      motivations: "motiv",
      strengths: "str",
      weaknesses: "weak",
      internalConflict: "conflict",
      characterArcs: "arc",
      dialogueStyle: "style",
      backstory: "back",
    });
    const xml = serializeCharacter(c);
    expect(xml).toContain("<aliases>The One, Neo</aliases>");
    expect(xml).toContain("<description>desc</description>");
    expect(xml).toContain("<personality>pers</personality>");
    expect(xml).toContain("<motivations>motiv</motivations>");
    expect(xml).toContain("<strengths>str</strengths>");
    expect(xml).toContain("<weaknesses>weak</weaknesses>");
    expect(xml).toContain("<internal-conflict>conflict</internal-conflict>");
    expect(xml).toContain("<character-arcs>arc</character-arcs>");
    expect(xml).toContain("<dialogue-style>style</dialogue-style>");
    expect(xml).toContain("<backstory>back</backstory>");
  });

  it("joins aliases with comma and space", () => {
    const c = makeCharacter({
      projectId: pid,
      name: "Multi",
      aliases: ["A", "B", "C"],
    });
    const xml = serializeCharacter(c);
    expect(xml).toContain("<aliases>A, B, C</aliases>");
  });

  it("omits aliases when empty array", () => {
    const c = makeCharacter({
      projectId: pid,
      name: "NoAlias",
      aliases: [],
    });
    const xml = serializeCharacter(c);
    expect(xml).not.toContain("<aliases>");
  });

  it("includes images block when images have captions", () => {
    const c = makeCharacter({
      projectId: pid,
      name: "Illustrated",
      images: [
        {
          id: "img-1",
          url: "https://example.com/a.jpg",
          caption: "A portrait",
          isPrimary: true,
        },
        {
          id: "img-2",
          url: "https://example.com/b.jpg",
          caption: "In battle",
          isPrimary: false,
        },
      ],
    });
    const xml = serializeCharacter(c);
    expect(xml).toContain("<images>");
    expect(xml).toContain('<image caption="A portrait" />');
    expect(xml).toContain('<image caption="In battle" />');
    expect(xml).toContain("</images>");
  });

  it("omits images with empty captions", () => {
    const c = makeCharacter({
      projectId: pid,
      name: "Partial",
      images: [
        {
          id: "img-1",
          url: "https://example.com/a.jpg",
          caption: "Visible",
          isPrimary: true,
        },
        {
          id: "img-2",
          url: "https://example.com/b.jpg",
          caption: "",
          isPrimary: false,
        },
      ],
    });
    const xml = serializeCharacter(c);
    expect(xml).toContain('<image caption="Visible" />');
    expect(xml).not.toContain('caption=""');
  });

  it("omits images block when no images have captions", () => {
    const c = makeCharacter({
      projectId: pid,
      name: "NoCaptions",
      images: [
        {
          id: "img-1",
          url: "https://example.com/a.jpg",
          caption: "",
          isPrimary: true,
        },
      ],
    });
    const xml = serializeCharacter(c);
    expect(xml).not.toContain("<images>");
  });

  it("omits images block when character has no images", () => {
    const c = makeCharacter({
      projectId: pid,
      name: "NoImages",
      images: [],
    });
    const xml = serializeCharacter(c);
    expect(xml).not.toContain("<images>");
  });
});

describe("serializeLocation", () => {
  it("resolves linked characters from charMap", () => {
    const charMap = new Map([
      ["00000000-0000-4000-8000-000000000010", "Alice"],
      ["00000000-0000-4000-8000-000000000020", "Bob"],
    ]);
    const loc = makeLocation({
      projectId: pid,
      name: "Tavern",
      linkedCharacterIds: [
        "00000000-0000-4000-8000-000000000010",
        "00000000-0000-4000-8000-000000000020",
      ],
    });
    const xml = serializeLocation(loc, charMap);
    expect(xml).toContain("<characters-here>Alice, Bob</characters-here>");
  });

  it("silently drops missing character IDs", () => {
    const charMap = new Map([
      ["00000000-0000-4000-8000-000000000010", "Alice"],
    ]);
    const loc = makeLocation({
      projectId: pid,
      name: "Castle",
      linkedCharacterIds: [
        "00000000-0000-4000-8000-000000000010",
        "00000000-0000-4000-8000-ffffffffffff",
      ],
    });
    const xml = serializeLocation(loc, charMap);
    expect(xml).toContain("<characters-here>Alice</characters-here>");
    expect(xml).not.toContain("undefined");
  });

  it("serializes all optional fields", () => {
    const loc = makeLocation({
      projectId: pid,
      name: "Forest",
      description: "dark forest",
      notes: "scary",
    });
    const xml = serializeLocation(loc, new Map());
    expect(xml).toContain('<location name="Forest">');
    expect(xml).toContain("<description>dark forest</description>");
    expect(xml).toContain("<notes>scary</notes>");
    expect(xml).toContain("</location>");
  });

  it("includes images block when images have captions", () => {
    const loc = makeLocation({
      projectId: pid,
      name: "Castle",
      images: [
        {
          id: "img-1",
          url: "https://example.com/castle.jpg",
          caption: "The main gate",
          isPrimary: true,
        },
      ],
    });
    const xml = serializeLocation(loc, new Map());
    expect(xml).toContain("<images>");
    expect(xml).toContain('<image caption="The main gate" />');
    expect(xml).toContain("</images>");
  });

  it("omits images with empty captions", () => {
    const loc = makeLocation({
      projectId: pid,
      name: "Village",
      images: [
        {
          id: "img-1",
          url: "https://example.com/a.jpg",
          caption: "",
          isPrimary: false,
        },
      ],
    });
    const xml = serializeLocation(loc, new Map());
    expect(xml).not.toContain("<images>");
  });

  it("omits images block when location has no images", () => {
    const loc = makeLocation({
      projectId: pid,
      name: "Desert",
      images: [],
    });
    const xml = serializeLocation(loc, new Map());
    expect(xml).not.toContain("<images>");
  });
});

describe("serializeTimelineEvent", () => {
  it("includes date attribute when present", () => {
    const e = makeTimelineEvent({
      projectId: pid,
      title: "Battle",
      date: "Year 100",
    });
    const xml = serializeTimelineEvent(e, new Map());
    expect(xml).toContain('<event title="Battle" date="Year 100">');
  });

  it("omits date attribute when empty", () => {
    const e = makeTimelineEvent({
      projectId: pid,
      title: "Undated",
      date: "",
    });
    const xml = serializeTimelineEvent(e, new Map());
    expect(xml).toContain('<event title="Undated">');
    expect(xml).not.toContain("date=");
  });

  it("resolves linked characters", () => {
    const charMap = new Map([["00000000-0000-4000-8000-000000000010", "Hero"]]);
    const e = makeTimelineEvent({
      projectId: pid,
      title: "Quest",
      linkedCharacterIds: ["00000000-0000-4000-8000-000000000010"],
    });
    const xml = serializeTimelineEvent(e, charMap);
    expect(xml).toContain("<characters-involved>Hero</characters-involved>");
  });
});

describe("serializeWorldbuildingTree", () => {
  it("returns empty string for empty array", () => {
    expect(serializeWorldbuildingTree([])).toBe("");
  });

  it("renders nested parent-child XML", () => {
    const parent = makeWorldbuildingDoc({
      id: "00000000-0000-4000-8000-aaaaaaaaaaaa",
      projectId: pid,
      title: "World",
      content: "Big world",
    });
    const child = makeWorldbuildingDoc({
      projectId: pid,
      title: "Region",
      content: "Small region",
      parentDocId: "00000000-0000-4000-8000-aaaaaaaaaaaa",
    });
    const xml = serializeWorldbuildingTree([parent, child]);
    expect(xml).toContain('<doc title="World">');
    expect(xml).toContain("Big world");
    expect(xml).toContain('<doc title="Region">');
    expect(xml).toContain("Small region");
    // Nested: Region's </doc> should be before World's </doc>
    const worldClose = xml.lastIndexOf("</doc>");
    const regionClose = xml.indexOf("</doc>");
    expect(regionClose).toBeLessThan(worldClose);
  });

  it("does not truncate content at exactly 2048 chars", () => {
    const content = "x".repeat(2048);
    const doc = makeWorldbuildingDoc({
      projectId: pid,
      title: "Exact",
      content,
    });
    const xml = serializeWorldbuildingTree([doc]);
    expect(xml).not.toContain("...");
    expect(xml).toContain(content);
  });

  it("truncates content at 2049 chars with ellipsis", () => {
    const content = "x".repeat(2049);
    const doc = makeWorldbuildingDoc({
      projectId: pid,
      title: "Long",
      content,
    });
    const xml = serializeWorldbuildingTree([doc]);
    expect(xml).toContain("...");
    // Should have exactly 2048 x's + ...
    expect(xml).toContain(`${"x".repeat(2048)}...`);
  });

  it("includes tags attribute when present", () => {
    const doc = makeWorldbuildingDoc({
      projectId: pid,
      title: "Tagged",
      tags: ["magic", "lore"],
    });
    const xml = serializeWorldbuildingTree([doc]);
    expect(xml).toContain('tags="magic, lore"');
  });

  it("renders multiple roots", () => {
    const a = makeWorldbuildingDoc({
      projectId: pid,
      title: "A",
    });
    const b = makeWorldbuildingDoc({
      projectId: pid,
      title: "B",
    });
    const xml = serializeWorldbuildingTree([a, b]);
    expect(xml).toContain('<doc title="A">');
    expect(xml).toContain('<doc title="B">');
  });
});

describe("serializeRelationship", () => {
  it("uses predefined type label", () => {
    const charMap = new Map([
      ["00000000-0000-4000-8000-000000000010", "Alice"],
      ["00000000-0000-4000-8000-000000000020", "Bob"],
    ]);
    const r = makeRelationship({
      projectId: pid,
      sourceCharacterId: "00000000-0000-4000-8000-000000000010",
      targetCharacterId: "00000000-0000-4000-8000-000000000020",
      type: "sibling",
    });
    const xml = serializeRelationship(r, charMap);
    expect(xml).toBe(
      '<relationship source="Alice" target="Bob" type="sibling" />',
    );
  });

  it("uses customLabel for custom type", () => {
    const charMap = new Map([
      ["00000000-0000-4000-8000-000000000010", "Alice"],
      ["00000000-0000-4000-8000-000000000020", "Bob"],
    ]);
    const r = makeRelationship({
      projectId: pid,
      sourceCharacterId: "00000000-0000-4000-8000-000000000010",
      targetCharacterId: "00000000-0000-4000-8000-000000000020",
      type: "custom",
      customLabel: "nemesis",
    });
    const xml = serializeRelationship(r, charMap);
    expect(xml).toContain('type="nemesis"');
  });

  it("returns empty string when source is missing", () => {
    const charMap = new Map([["00000000-0000-4000-8000-000000000020", "Bob"]]);
    const r = makeRelationship({
      projectId: pid,
      sourceCharacterId: "00000000-0000-4000-8000-ffffffffffff",
      targetCharacterId: "00000000-0000-4000-8000-000000000020",
      type: "sibling",
    });
    expect(serializeRelationship(r, charMap)).toBe("");
  });

  it("returns empty string when target is missing", () => {
    const charMap = new Map([
      ["00000000-0000-4000-8000-000000000010", "Alice"],
    ]);
    const r = makeRelationship({
      projectId: pid,
      sourceCharacterId: "00000000-0000-4000-8000-000000000010",
      targetCharacterId: "00000000-0000-4000-8000-ffffffffffff",
      type: "sibling",
    });
    expect(serializeRelationship(r, charMap)).toBe("");
  });
});
