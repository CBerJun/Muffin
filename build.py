from itertools import chain, repeat
import subprocess
import sys

# Keep these up to date with muffin.js:
key_phrases = [
    'set up',
    'set up a',
    'add',
    'into',
    'add water to',
    'at a',
    'ratio',
    'pour half of contents of',
    'remove',
    'from',
    'if',
    'is empty',
    'is not empty',
    'proceed to step',
    'place',
    'in the oven and bake at',
    'clean',
    'pour contents of',
    'go back to step',
    'serves',
    'brand',
    'remove a layer from',
    'and dump into',
    'microwave',
    'serve with',
]
special_keywords = [
    # These keywords are explicitly used in muffin.grammar.in
    'recipe',
    'ingredients',
    'method',
]
ordinal_suffixes = ['st', 'nd', 'rd', 'th']
operators = [',', ':']
measures = [
    'grams of',
]
bowls = [
    ["Bowl", "Bowls"],
    ["Glass Bowl", "Glass Bowls"],
    ["Mixing Bowl", "Mixing Bowls"],
    ["Plastic Bowl", "Plastic Bowls"],
]
molds = [
    ["Cake Mold", "Cake Molds"],
    ["Muffin Cup", "Muffin Cups"],
    ["Loaf Pan", "Loaf Pans"],
    ["Toast Mold", "Toast Molds"],
    ["Pizza Pan", "Pizza Pans"],
    ["Baking Dish", "Baking Dishes"],
]

identifiers = frozenset(chain.from_iterable(
    x.split(" ")
    for tup in chain(bowls, molds)
    for x in tup
))
misc_keywords = frozenset(chain.from_iterable(
    x.split(" ")
    for x in chain(measures, key_phrases)
))

def _alt(values):
    return "|".join(map(repr, values))
def _specialized_alt(values, token):
    return "|".join(map(f"@specialize<{token}, {{!r}}>".format, values))

def build_grammar():
    """muffin.grammar.in -> muffin.grammar -> parser.js"""
    with open("codemirror/muffin.grammar.in", "r", encoding="utf-8") as fp:
        x = fp.read()
    with open("codemirror/muffin.grammar", "w", encoding="utf-8") as fp:
        fp.write(
            x
            .replace("%operators%", _alt(operators), 1)
            .replace("%ordinal%", _alt(ordinal_suffixes), 1)
            .replace("%misc_keywords%",
                     _specialized_alt(misc_keywords, "Keyword"), 1)
            .replace("%identifiers%",
                     _specialized_alt(identifiers, "Identifier"), 1)
        )
    proc = subprocess.run(
        ["npx", "lezer-generator", "muffin.grammar", "-o", "parser.js"],
        cwd="./codemirror", shell=True
    )
    return proc.returncode

def build_autocomplete():
    """-> codemirror/autocomplete.js"""
    data_kw = zip(chain(special_keywords, key_phrases, measures),
                  repeat("keyword"))
    data_id = chain.from_iterable(
        ((single, "variable"), (plural, "constant"))
        for single, plural in chain(bowls, molds)
    )
    with open("codemirror/autocomplete.js", "w", encoding="utf-8") as fp:
        for name, data in (("keywords", data_kw), ("identifiers", data_id)):

            fp.write(f"export const {name} = [%s];\n" % ",".join(
                "{label: %r, type: %r}" % x
                for x in data
            ))
        fp.write("export const allNames = keywords.concat(identifiers);\n")

def build_codemirror():
    """codemirror/... -> src/cm6.bundle.js"""
    proc = subprocess.run(
        ["npx", "rollup", "editor.js", "-f", "iife",
         "-o", "../src/cm6.bundle.js",
         "-p", "@rollup/plugin-node-resolve", "--output.name", "cm6"],
        cwd="./codemirror", shell=True
    )
    return proc.returncode

def build_min_codemirror():
    """src/cm6.bundle.js -> src/cm6.bundle.min.js"""
    popen = subprocess.Popen(
        ["npx", "minify", "../src/cm6.bundle.js"],
        cwd="./codemirror", shell=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    out, err = popen.communicate()
    if err or not out:
        return 1
    with open("src/cm6.bundle.min.js", "wb") as fp:
        fp.write(out)
    return 0

if __name__ == "__main__":
    sys.exit(
        build_grammar()
        or build_autocomplete()
        or build_codemirror()
        or build_min_codemirror()
    )
