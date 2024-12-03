import { EditorState } from '@codemirror/state';
import { openSearchPanel, highlightSelectionMatches } from '@codemirror/search';
import { indentWithTab, history, defaultKeymap, historyKeymap } from '@codemirror/commands';
import { foldGutter, indentUnit, foldKeymap, LanguageSupport, LRLanguage, indentNodeProp } from '@codemirror/language';
import { autocompletion, completionKeymap, acceptCompletion, closeBrackets } from '@codemirror/autocomplete';
import {
    lineNumbers, highlightActiveLineGutter, drawSelection,
    rectangularSelection, crosshairCursor, highlightActiveLine, keymap,
    EditorView
} from '@codemirror/view';
import { oneDark } from "@codemirror/theme-one-dark";
import { parser } from "./parser.js";
import { styleTags, tags as t } from "@lezer/highlight";
import * as autocompleteData from "./autocomplete.js";

const muffinParser = parser.configure({
    props: [
        styleTags({
            "String": t.string,
            "Number": t.integer,
            "Operators": t.punctuation,
            "MiscKeyword": t.operatorKeyword,
            "SpecialKeyword": t.controlKeyword,
            "RecipeName/...": t.className,
            "IngredientName/...": t.atom,
            "KnownIdentifier": t.variableName,
        }),
        indentNodeProp.add({
            "IngredientBody StepBody": (context) =>
                context.baseIndent + context.unit,
        }),
    ]
    // TODO folding
});

const muffinLanguage = LRLanguage.define({
    parser: muffinParser,
    languageData: {
        closeBrackets: {
            brackets: ['"'],
        },
    },
});

const kwRegexp = /\b([a-z]\w* )*\b[a-z]\w*/;
const idRegexp = /\b([A-Z]\w* )*\b[A-Z]\w*/;

const muffinCompletion = muffinLanguage.data.of({
    autocomplete: (context) => {
        // Determine if the user is trying to type a keyword (lowercase)
        // or an identifier (Title Case)
        const kwMatch = context.matchBefore(kwRegexp);
        let data;
        let from;
        let validFor;
        if (kwMatch) {
            data = autocompleteData.keywords;
            from = kwMatch.from;
            validFor = kwMatch;
        }
        else {
            const idMatch = context.matchBefore(idRegexp);
            if (idMatch) {
                data = autocompleteData.identifiers;
                from = idMatch.from;
                validFor = idMatch;
            }
            else if (context.explicit) {
                data = autocompleteData.allNames;
                from = context.pos;
            }
            else {
                // If completion wasn't explicitly started and there
                // is no word before the cursor, don't open completions.
                return null;
            }
        }
        return {
            from,
            options: data,
            validFor: validFor ? new RegExp(`^${validFor.source}$`)
                : undefined,
        };
    },
});

function muffin() {
    return new LanguageSupport(muffinLanguage, [muffinCompletion]);
}

export function createEditorState(initialContents) {
    const extensions = [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        foldGutter(),
        drawSelection(),
        indentUnit.of("    "),
        autocompletion(),
        closeBrackets(),
        EditorState.allowMultipleSelections.of(true),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        keymap.of([
            {
                key: "Tab",
                run: acceptCompletion,
            },
            {
                key: "Mod-f",
                run: openSearchPanel,
            },
            indentWithTab,
            ...defaultKeymap,
            ...historyKeymap,
            ...foldKeymap,
            ...completionKeymap,
        ]),
        muffin(),
        oneDark,
    ];

    return EditorState.create({
        doc: initialContents,
        extensions
    });
}

export { EditorView };
