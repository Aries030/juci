export type Word = [
  word: string,
  ipaUK: string,
  pos: string,
  meaning: string,
  sentence: string,
  source: string,
  translation: string,
  ipaUS: string,
];

export interface Show {
  id: string;
  title: string;
  region: "uk" | "us";
  lang: "en-GB" | "en-US";
  quoted?: boolean;
  words: Word[];
}

export const REGIONS = [
  { id: "uk", title: "英剧" },
  { id: "us", title: "美剧" },
] as const;
