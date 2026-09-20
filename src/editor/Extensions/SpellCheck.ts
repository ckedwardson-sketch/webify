// src/editor/extensions/SpellCheck.ts
import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { getSpellChecker } from "../spellcheck/dictionary";

export const spellCheckPluginKey = new PluginKey<DecorationSet>("spellCheck");

const WORD_RE = /[A-Za-z]+(?:['’][A-Za-z]+)*/g;
const RECHECK_DEBOUNCE_MS = 400;

function computeDecorations(doc: ProseMirrorNode): DecorationSet {
  const checker = getSpellChecker();
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    WORD_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = WORD_RE.exec(text))) {
      const word = match[0];
      if (word.length < 2 || checker.check(word)) continue;
      const from = pos + match.index;
      const to = from + word.length;
      decorations.push(Decoration.inline(from, to, { class: "spell-error" }));
    }
  });
  return DecorationSet.create(doc, decorations);
}

// Misspellings are re-scanned on a debounce after the doc changes rather
// than on every keystroke — a full-document dictionary pass on each
// character is the kind of thing that gets janky on longer notes/recipes.
// Decorations from the previous pass are mapped through intervening
// transactions in the meantime so existing squiggles track edits instead
// of vanishing until the next scan lands.
export const SpellCheck = Extension.create({
  name: "spellCheck",

  addProseMirrorPlugins() {
    let timer: number | null = null;

    return [
      new Plugin({
        key: spellCheckPluginKey,
        state: {
          init: (_, state) => computeDecorations(state.doc),
          apply(tr, old) {
            const meta = tr.getMeta(spellCheckPluginKey) as DecorationSet | undefined;
            if (meta) return meta;
            return tr.docChanged ? old.map(tr.mapping, tr.doc) : old;
          },
        },
        props: {
          decorations(state) {
            return spellCheckPluginKey.getState(state);
          },
        },
        view() {
          return {
            update(view, prevState) {
              if (view.state.doc.eq(prevState.doc)) return;
              if (timer) window.clearTimeout(timer);
              timer = window.setTimeout(() => {
                const decorations = computeDecorations(view.state.doc);
                view.dispatch(view.state.tr.setMeta(spellCheckPluginKey, decorations));
              }, RECHECK_DEBOUNCE_MS);
            },
            destroy() {
              if (timer) window.clearTimeout(timer);
            },
          };
        },
      }),
    ];
  },
});

export interface MisspelledWordHit {
  from: number;
  to: number;
  word: string;
}

export function findMisspelledWordAt(editor: Editor, pos: number): MisspelledWordHit | null {
  const decorations = spellCheckPluginKey.getState(editor.state);
  if (!decorations) return null;
  const found = decorations.find(Math.max(0, pos - 1), pos + 1);
  const hit = found.find((deco) => deco.from <= pos && pos <= deco.to);
  if (!hit) return null;
  return { from: hit.from, to: hit.to, word: editor.state.doc.textBetween(hit.from, hit.to) };
}
