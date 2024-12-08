from itertools import chain, repeat
from contextlib import suppress
from shutil import copyfile
import subprocess
import sys
import os

# Keep these up to date with src/muffin.js:
# TODO Try to maintain this in a single file?
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
    'in grill mode',
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

build_script_mtime = os.path.getmtime(__file__)

def builder(output, inputs):
    """
    Return a decorator that:
    * Is used to wrap functions that receive no parameter and return an
      `int`, using 0 to indicate a normal exit.
    * Skips the call to the wrapped function when:
      - All files in `inputs` are older than `output` (last modified
        time is checked), or
      - This build script itself has been modified after the `output`
        was modified.
    * Prints out informational messages to stdout when the wrapped
      function is called.
    """
    def _decorator(func):
        func_name = getattr(func, "__name__", "?")
        def _print(message):
            print(f"[{func_name}] {message}")
        def _decorated():
            _print(f"{inputs} -> {output}")
            try:
                out_time = os.path.getmtime(output)
            except OSError:
                pass
            else:
                if build_script_mtime < out_time:
                    for in_file in inputs:
                        try:
                            src_time = os.path.getmtime(in_file)
                        except OSError as exc:
                            _print(f"ERROR: {in_file}: {exc}")
                            return 1
                        if src_time >= out_time:
                            break
                    else:
                        _print(f"using cache")
                        return 0
            return func()
        return _decorated
    return _decorator

def _alt(values):
    return "|".join(map(repr, values))
def _specialized_alt(values, token):
    return "|".join(map(f"@specialize<{token}, {{!r}}>".format, values))

@builder("build/muffin.grammar", ["src/muffin.grammar.in"])
def build_grammar():
    with open("src/muffin.grammar.in", "r", encoding="utf-8") as fp:
        x = fp.read()
    with open("build/muffin.grammar", "w", encoding="utf-8") as fp:
        fp.write(
            x
            .replace("%operators%", _alt(operators), 1)
            .replace("%ordinal%", _alt(ordinal_suffixes), 1)
            .replace("%misc_keywords%",
                     _specialized_alt(misc_keywords, "Keyword"), 1)
            .replace("%identifiers%",
                     _specialized_alt(identifiers, "Identifier"), 1)
        )
    return 0

@builder("src/parser.js", ["build/muffin.grammar"])
def build_parser():
    proc = subprocess.run(
        ["npx", "lezer-generator", "../build/muffin.grammar",
         "-o", "parser.js", "--noTerms"],
        cwd="./src", shell=True
    )
    return proc.returncode

@builder("src/autocomplete.js", [])
def build_autocomplete():
    data_kw = zip(chain(special_keywords, key_phrases, measures),
                  repeat("keyword"))
    data_id = chain.from_iterable(
        ((single, "variable"), (plural, "constant"))
        for single, plural in chain(bowls, molds)
    )
    with open("src/autocomplete.js", "w", encoding="utf-8") as fp:
        for name, data in (("keywords", data_kw), ("identifiers", data_id)):
            fp.write(f"export const {name} = [%s];\n" % ",".join(
                "{label: %r, type: %r}" % x
                for x in data
            ))
        fp.write("export const allNames = keywords.concat(identifiers);\n")

@builder("build/muffin.bundle.js", [
    "src/frontend.js",
    "src/editor.js",
    "src/muffin.js",
    "src/parser.js",
    "src/autocomplete.js",
])
def build_bundle():
    proc = subprocess.run(
        ["npx", "rollup", "frontend.js", "-f", "iife",
         "-o", "../build/muffin.bundle.js",
         "-p", "@rollup/plugin-node-resolve",
         "--output.name", "muffin"],
        cwd="./src", shell=True
    )
    return proc.returncode

@builder("dist/muffin.bundle.min.js", ["build/muffin.bundle.js"])
def minify_bundle():
    """build/muffin.bundle.js -> dist/muffin.bundle.min.js"""
    popen = subprocess.Popen(
        ["npx", "minify", "../build/muffin.bundle.js"],
        cwd="./src", shell=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    out, err = popen.communicate()
    if err or not out:
        return 1
    with open("dist/muffin.bundle.min.js", "wb") as fp:
        fp.write(out)
    return 0

def copy_static_files():
    # TODO minimize HTML and CSS?
    for file in ("index.html", "muffin.css", "favicon.ico"):
        copyfile(f"src/{file}", f"dist/{file}")
    return 0

def build():
    with suppress(FileExistsError):
        os.mkdir("./build")
    with suppress(FileExistsError):
        os.mkdir("./dist")
    return (
        build_grammar()
        or build_parser()
        or build_autocomplete()
        or build_bundle()
        or minify_bundle()
        or copy_static_files()
    )

if __name__ == "__main__":
    sys.exit(build())
