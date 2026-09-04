import { describe, expect, it } from "vitest";
import type { ColumnRefNode, OptionalNode } from "./brainstorm-ast";
import { parseAst } from "./brainstorm-parser";

describe("parseAst — literals and references", () => {
  it("parses plain prose as a single literal", () => {
    expect(parseAst("just prose")).toEqual([
      { kind: "literal", text: "just prose" },
    ]);
  });

  it("parses a bare column reference (one field)", () => {
    expect(parseAst("[color]")).toEqual([
      {
        kind: "columnRef",
        name: "color",
        label: null,
        constraints: [],
        raw: "[color]",
      },
    ]);
  });

  it("trims the column name but preserves raw", () => {
    const [node] = parseAst("[  color  ]") as [ColumnRefNode];
    expect(node.name).toBe("color");
    expect(node.raw).toBe("[  color  ]");
  });

  it("parses a label (two fields)", () => {
    expect(parseAst("[color:a]")).toEqual([
      {
        kind: "columnRef",
        name: "color",
        label: "a",
        constraints: [],
        raw: "[color:a]",
      },
    ]);
  });

  it("parses an empty label with constraints (three fields)", () => {
    const [node] = parseAst("[color::a]") as [ColumnRefNode];
    expect(node.label).toBeNull();
    expect(node.constraints).toEqual([{ ref: "a", negated: false }]);
  });

  it("parses negated and bare constraints", () => {
    const [node] = parseAst("[color:b:!a]") as [ColumnRefNode];
    expect(node.label).toBe("b");
    expect(node.constraints).toEqual([{ ref: "a", negated: true }]);
  });

  it("parses multiple comma-separated constraints", () => {
    const [node] = parseAst("[color::!a,!b]") as [ColumnRefNode];
    expect(node.constraints).toEqual([
      { ref: "a", negated: true },
      { ref: "b", negated: true },
    ]);
  });

  it("ignores empty constraint entries and trims refs", () => {
    const [node] = parseAst("[color:: a , , !b ]") as [ColumnRefNode];
    expect(node.constraints).toEqual([
      { ref: "a", negated: false },
      { ref: "b", negated: true },
    ]);
  });

  it("treats a fourth colon as literal text inside the constraints field", () => {
    const [node] = parseAst("[color:a:b:c]") as [ColumnRefNode];
    expect(node.name).toBe("color");
    expect(node.label).toBe("a");
    expect(node.constraints).toEqual([{ ref: "b:c", negated: false }]);
  });

  it("keeps literal text around references", () => {
    expect(parseAst("a [x] b")).toEqual([
      { kind: "literal", text: "a " },
      {
        kind: "columnRef",
        name: "x",
        label: null,
        constraints: [],
        raw: "[x]",
      },
      { kind: "literal", text: " b" },
    ]);
  });
});

describe("parseAst — optionals", () => {
  it("defaults probability to 0.5 with no |p", () => {
    const [node] = parseAst("{maybe}") as [OptionalNode];
    expect(node.kind).toBe("optional");
    expect(node.probability).toBe(0.5);
    expect(node.children).toEqual([{ kind: "literal", text: "maybe" }]);
  });

  it("reads an explicit probability", () => {
    const [node] = parseAst("{, [color]|0.3}") as [OptionalNode];
    expect(node.probability).toBeCloseTo(0.3);
    expect(node.children).toEqual([
      { kind: "literal", text: ", " },
      {
        kind: "columnRef",
        name: "color",
        label: null,
        constraints: [],
        raw: "[color]",
      },
    ]);
  });

  it("accepts leading-dot and clamps out-of-range probabilities", () => {
    expect((parseAst("{x|.25}")[0] as OptionalNode).probability).toBeCloseTo(
      0.25,
    );
    expect((parseAst("{x|5}")[0] as OptionalNode).probability).toBe(1);
  });

  it("treats a non-terminal pipe as literal content", () => {
    const [node] = parseAst("{a|b}") as [OptionalNode];
    expect(node.probability).toBe(0.5);
    expect(node.children).toEqual([{ kind: "literal", text: "a|b" }]);
  });

  it("nests optionals", () => {
    const [outer] = parseAst("{x {y|0.2}|0.5}") as [OptionalNode];
    expect(outer.probability).toBeCloseTo(0.5);
    const inner = outer.children[1] as OptionalNode;
    expect(inner.kind).toBe("optional");
    expect(inner.probability).toBeCloseTo(0.2);
  });
});

describe("parseAst — escaping", () => {
  it("escapes braces and brackets to literal text", () => {
    expect(parseAst("\\{a\\} \\[b\\]")).toEqual([
      { kind: "literal", text: "{a} [b]" },
    ]);
  });

  it("escapes a colon inside a column name", () => {
    const [node] = parseAst("[a\\:b]") as [ColumnRefNode];
    expect(node.name).toBe("a:b");
    expect(node.label).toBeNull();
  });

  it("escapes a comma inside a constraint ref", () => {
    const [node] = parseAst("[c::a\\,b]") as [ColumnRefNode];
    expect(node.constraints).toEqual([{ ref: "a,b", negated: false }]);
  });

  it("escapes a pipe so it does not terminate an optional", () => {
    const [node] = parseAst("{a\\|0.3}") as [OptionalNode];
    expect(node.probability).toBe(0.5);
    expect(node.children).toEqual([{ kind: "literal", text: "a|0.3" }]);
  });

  it("emits a trailing lone backslash as a literal backslash", () => {
    expect(parseAst("a\\")).toEqual([{ kind: "literal", text: "a\\" }]);
  });
});

describe("parseAst — degrade, never throw", () => {
  it("treats an unclosed brace as literal", () => {
    expect(parseAst("{a")).toEqual([{ kind: "literal", text: "{a" }]);
  });

  it("treats an unclosed bracket as literal", () => {
    expect(parseAst("[col")).toEqual([{ kind: "literal", text: "[col" }]);
  });

  it("recovers a valid reference after a degraded brace", () => {
    expect(parseAst("{ [x]")).toEqual([
      { kind: "literal", text: "{ " },
      {
        kind: "columnRef",
        name: "x",
        label: null,
        constraints: [],
        raw: "[x]",
      },
    ]);
  });

  it("degrades adversarial input to a definite AST instead of throwing", () => {
    expect(parseAst("{{[:|}]\\")).toEqual([
      { kind: "literal", text: "{{" },
      {
        kind: "columnRef",
        name: "",
        label: "|}",
        constraints: [],
        raw: "[:|}]",
      },
      { kind: "literal", text: "\\" },
    ]);
  });
});
