import Typo from "typo-js";
import affData from "typo-js/dictionaries/en_US/en_US.aff?raw";
import wordsData from "typo-js/dictionaries/en_US/en_US.dic?raw";

// The en_US .aff/.dic data is bundled straight into the JS output (via
// Vite's ?raw import) rather than fetched at runtime, so the dictionary
// works offline in the packaged Tauri app with no extra asset wiring.
let checker: Typo | null = null;

export function getSpellChecker(): Typo {
  if (!checker) checker = new Typo("en_US", affData, wordsData);
  return checker;
}
