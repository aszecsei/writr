import {
  type FeatureExtractionPipeline,
  pipeline,
} from "@huggingface/transformers";

export const EMBEDDING_MODEL_ID = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMENSIONS = 384;

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", EMBEDDING_MODEL_ID);
  }
  return extractorPromise;
}

/** Embed texts into mean-pooled, L2-normalized vectors. Runs inside the worker. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const extractor = await getExtractor();
  const out: number[][] = [];
  for (const text of texts) {
    const tensor = await extractor(text, { pooling: "mean", normalize: true });
    out.push(Array.from(tensor.data as Float32Array));
  }
  return out;
}
