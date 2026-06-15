export interface RetrievedSnippet {
  title: string;
  text: string;
}

export interface RetrievalHit extends RetrievedSnippet {
  sourceId: string;
  chunkIndex: number;
  score: number;
}

export interface RetrievalResult {
  lore: RetrievalHit[];
  pastEvents: RetrievalHit[];
  futureEvents: RetrievalHit[];
}

export interface RetrievalSettings {
  omniscient: boolean;
  loreTopK: number;
  sceneTopK: number;
  similarityFloor: number;
}
