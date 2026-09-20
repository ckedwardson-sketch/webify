declare module "typo-js" {
  export default class Typo {
    constructor(dictionary?: string, affData?: string, wordsData?: string, settings?: Record<string, unknown>);
    check(word: string): boolean;
    suggest(word: string, limit?: number): string[];
  }
}

declare module "typo-js/dictionaries/en_US/en_US.aff?raw" {
  const content: string;
  export default content;
}

declare module "typo-js/dictionaries/en_US/en_US.dic?raw" {
  const content: string;
  export default content;
}
