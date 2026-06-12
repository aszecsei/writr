import type { AnalyzedSentence, AnalyzedTerm } from "./types";

/**
 * The single seam between the analysis pipeline and the compromise NLP
 * library. compromise (~250KB) is loaded lazily so it never lands in the
 * base bundle; everything downstream consumes the neutral
 * `AnalyzedSentence` shape, so this module could later be swapped for a
 * web worker without touching the metrics.
 */

interface NlpTermJson {
  normal: string;
  // compromise sets `root` only when the lemma differs from `normal`.
  root?: string;
  tags: string[];
  syllables?: string[];
}

interface NlpSentenceJson {
  text: string;
  terms: NlpTermJson[];
}

type NlpFn = (text: string) => {
  compute: (method: string) => void;
  json: (options: object) => NlpSentenceJson[];
};

let nlpPromise: Promise<NlpFn> | null = null;

async function getNlp(): Promise<NlpFn> {
  if (!nlpPromise) {
    nlpPromise = (async () => {
      const [{ default: nlp }, { default: speech }] = await Promise.all([
        import("compromise"),
        import("compromise-speech"),
      ]);
      nlp.extend(speech);
      return nlp as unknown as NlpFn;
    })();
  }
  return nlpPromise;
}

/**
 * Fallback for terms compromise-speech yields no syllables for (numbers,
 * symbols): count vowel groups, with a floor of 1 for any word-like term.
 */
export function fallbackSyllableCount(word: string): number {
  const letters = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!letters) return 0;
  const groups = letters.match(/[aeiouy]+/g);
  return Math.max(1, groups?.length ?? 0);
}

function toAnalyzedTerm(term: NlpTermJson): AnalyzedTerm | null {
  // compromise splits contractions ("didn't" → "did" + "n't"), sometimes
  // leaving a term with an empty normal; those carry no analyzable word.
  if (!term.normal) return null;
  return {
    normal: term.normal,
    // compromise omits `root` when the lemma matches `normal`; fall back so
    // every term always carries a usable lemma.
    root: term.root || term.normal,
    tags: new Set(term.tags),
    syllables: term.syllables?.length || fallbackSyllableCount(term.normal),
  };
}

/**
 * Parse plain-prose paragraphs into analyzed sentences. Parsing happens
 * per paragraph — sentences never cross paragraph boundaries, and the
 * paragraph is also the unit callers use to chunk work across idle
 * callbacks.
 */
export async function parseParagraph(
  paragraph: string,
  paragraphIndex: number,
): Promise<AnalyzedSentence[]> {
  const nlp = await getNlp();
  const doc = nlp(paragraph);
  doc.compute("syllables");
  // Populates each term's `root` (verb→infinitive, plural→singular) where
  // compromise's tagging finds a reduction; consumed by echo + glue metrics.
  doc.compute("root");
  const sentences = doc.json({
    terms: { tags: true, normal: true, syllables: true },
  });
  return sentences
    .map((sentence) => ({
      text: sentence.text.trim(),
      terms: sentence.terms
        .map(toAnalyzedTerm)
        .filter((t): t is AnalyzedTerm => t !== null),
      paragraphIndex,
    }))
    .filter((sentence) => sentence.terms.length > 0);
}
