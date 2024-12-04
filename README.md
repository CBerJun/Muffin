# The Muffin Programming Language

**Note: WORK IN PROGRESS! Many things here have not been implemented.**

**Muffin** is a brand new **programming language** designed and implemented by
me in order to participate in [High Seas hold by Hack Club][high-seas].

Muffin allows you to write programs that look like **cooking recipes**.

Here is "Hello, world!" in Muffin:

```
Muffin recipe
ingredients
    "Hello, world!" brand Flour
method
    1. set up a Muffin Cup
    2. add Flour into Muffin Cup
    3. microwave Muffin Cup
    4. serves 1
```

I know this is definitely *not* how you make muffins, but it *is* a program
that will print out "Hello, world!".

This program prints out the first 20 Fibonacci numbers:

```
Muffin recipe
ingredients
    1 Blueberry
    19 grams of Butter
method
    1. set up 4 Bowls
    2. add Blueberry into 3rd Bowl
    3. add water to 1st Bowl at a 1:1 ratio
    4. pour half of contents of 1st Bowl into 4th Bowl
    5. remove Butter from 4th Bowl
    6. if 4th Bowl is not empty, proceed to step 15
    7. place 3rd Bowl in the oven and bake at 190C
    8. clean 4th Bowl
    9. pour contents of 2nd Bowl into 4th Bowl
    10. add water to 3rd Bowl at a 1:1 ratio
    11. pour half of contents of 3rd Bowl into 2nd Bowl
    12. pour contents of 4th Bowl into 3rd Bowl
    13. add Blueberry into 1st Bowl
    14. go back to step 3
    15. serves 1
```

[high-seas]: https://highseas.hackclub.com/

# Language Specification

Here are a few important concepts of Muffin:

* *Recipes* are equivalent to functions/procedures in many programming
  languages. A recipe is made up of a name, ingredients and a method. The
  function's name is what this tasty recipe produces (e.g. `Raisin Scone`). The
  `Muffin` recipe is the entry recipe of the whole program (similar to `main`
  in C/C++, Java, Go, etc.), i.e. when you execute a Muffin code the `Muffin`
  recipe will be invoked.
* *Bowls* are equivalent to variables in many programming languages. The data
  hold by bowls are always *unsigned integers*, i.e. nonnegative integers.
  *You can't have -10 grams of butter in a bowl!* A bowl has a
  *bowl kind* and a *bowl number*. You can declare how many bowls there are
  for a specific bowl kind, and each bowl can be referred to using their
  number.

  For example, if you set up four `Glass Bowls`, then the four bowls can be
  referred to as `1st Glass Bowl`, `2nd Glass Bowl`, etc. If there is only one
  bowl of a kind, then just use the bowl kind to refer to that bowl (e.g.
  `Glass Bowl`).

  Bowls are "local" to the recipe they are in. That is, two bowls, even if they
  have the same kind and number, aren't the same if they are in two different
  recipes.
* *Ingredients* are used for writing constants in Muffin. The way you write
  `x + 10` in Muffin is to declare an ingredient with value 10 and "add" that
  ingredient into a bowl. An ingredient can also take a string value, and in
  that case you can't add it to a bowl.
* A *method* is the body of a recipe. It consists of a series of *steps*, which
  are equivalent to statements in other languages.
* *Molds* are Muffin's implementation of stack -- it is a list of values, but
  you only have access to the last element. Similar to how bowls work, molds
  have a *mold kind* and a *mold number*, and you refer to them using ordinals
  if there are multiple molds of the same kind.

  The difference between molds and bowls is that molds may contain both string
  and unsigned integers (just like ingredients), while bowls can only contain
  unsigned integers. Another difference is that molds are "global". That is,
  all the recipes share the same molds.

Regarding the syntax:

* All `lowercase phrases` are *keywords*. That means, all these phrases are
  reserved.
* All `Title Case Phrases` are *identifiers* and you may use these names
  freely.
* There is no comment. *Why do you expect a "comment" in a cooking recipe?*
* New lines are significant. However, blank lines are ignored.
* Indentation is not significant.

A Muffin program consists of many recipes, separated by new lines.
*I guess you could call a Muffin program a "recipe book".*

A recipe takes this form:

```
<Recipe name> recipe
ingredients
    <Ingredient list>
method
    <Step list>
```

`<Recipe name>` should be an identifier (Title Case). That's the name of this
recipe.

`<Ingredient list>` is a list of ingredient declarations separated by new
lines. An ingredient declaration takes any of these forms:

```
<String> brand <Ingredient name>
<Integer> <Ingredient name>
<Integer> grams of <Ingredient name>
```

`<Ingredient name>` must be an identifier. `<String>` must be a double quoted
string literal. There is no escape. *What brand name has a double quote in it?*
The first form declares `<Ingredient name>` to be a string `<String>`. The
latter two forms are the same and declare `<Ingredient name>` to be an integer
constant `<Integer>`.

`<Step list>` is a list of steps separated by new lines. When a recipe is
executed, the steps in this `<Step list>` will be executed, from the first step
to the last step. A step takes either of these forms:

```
<Label> <Step content>
<Label> if <Predicate>, <Step content>
```

The first form performs the instruction given by `<Step content>`. The second
form performs the given `<Step content>` only if `<Predicate>` evaluates to
true.

`<Label>` is an integer with a `.` immediately after it, like `2.`. The first
step in a `<Step list>` must be labelled `1.`, and the second `2.`, the third
`3.`, etc.

Before introducing what `<Predicate>` and `<Step content>` look like, here are
a few components that will be used by them (you can go on and read about
`<Step content>` and come back to this later when you encounter a definition
listed here):

* A `<Bowl>` specifies a bowl. A bowl has a *bowl kind* and a *bowl number*.
  If there is only one bowl for a given kind of bowl, then the kind identifier
  can be used to refer to that single bowl; otherwise an ordinal like `10th`
  must precede the bowl kind identifier to specify the bowl number. (See above
  for the definition of bowl.)
* A `<Mold>` specifies a mold. The way you specify molds works exactly the same
  way as specifying bowls. (See above for the definition of mold.)

`<Step content>` (remember this is similar to a statement in other languages)
takes one of these forms:

* `set up a <Bowl kind>` or `set up 1 <Bowl kind>`: Set up one bowl of
  `<Bowl kind>` kind. The same kind may only be set up once in the same recipe.
  This single bowl should be referred to as `<Bowl kind>` in the following
  code. A bowl starts off as an empty bowl. See next rule for the list of
  available `<Bowl kind>`.
* `set up <Integer> <Bowl kind plural>`: Set up `<Integer>` bowls of given
  kind. `<Integer>` must be at least 2. The same kind may only be set up once
  in the same recipe.

  Here are all the available bowl kinds:

  | `<Bowl kind>`  | `<Bowl kind plural>` |
  | -------------- | -------------------- |
  | `Bowl`         | `Bowls`              |
  | `Glass Bowl`   | `Glass Bowls`        |
  | `Mixing Bowl`  | `Mixing Bowls`       |
  | `Plastic Bowl` | `Plastic Bowls`      |
* `set up a <Mold kind>` or `set up 1 <Mold kind>`: Similar to
  `set up a <Bowl kind>` but create molds instead of bowls. The same mold kind
  may only be set up once in the whole program.
* `set up <Integer> <Mold kind plural>`: Similar to
  `set up <Integer> <Bowl kind plural>` but create molds instead of bowls. The
  same mold kind may only be set up once in the whole program.

  Here are all the available mold kinds:

  | `<Mold kind>` | `<Mold kind plural>` |
  | ------------- | -------------------- |
  | `Cake Mold`   | `Cake Molds`         |
  | `Muffin Cup`  | `Muffin Cups`        |
  | `Loaf Pan`    | `Loaf Pans`          |
  | `Toast Mold`  | `Toast Molds`        |
  | `Pizza Pan`   | `Pizza Pans`         |
  | `Baking Dish` | `Baking Dishes`      |
* `add <Ingredient name> into <Bowl>`: Add the value of `<Bowl>` by an integer
  constant given by `<Ingredient name>`.
* `remove <Ingredient name> from <Bowl>`: Remove the value of `<Bowl>` by an
  integer constant given by `<Ingredient name>`. If the result is negative, it
  gets cramped to 0 instead. *You can't have -5 oranges in a bowl!*
* `clean <Bowl>`: Set value of `<Bowl>` to 0.
* `add water to <Bowl> at a 1:<Integer> ratio`: Add the value of `<Bowl>` by
  `<Integer>` times of itself. `<Integer>` must be positive. For example,
  a `1:1` ratio doubles the `<Bowl>`.
* `pour half of contents of <Bowl> into <Bowl>`: Transfer half of value of
  first `<Bowl>` into second `<Bowl>`. If first `<Bowl>` is an odd number, then
  "half" always rounds down.
* `pour contents of <Bowl> into <Bowl>`: Transfer all contents of first
  `<Bowl>` into second `<Bowl>`. In other words, second `<Bowl>` gets added the
  value of first `<Bowl>` and the first `<Bowl>` is cleaned.
* `proceed to step <Integer>`: Go to the step labelled `<Integer>`. The
  provided step must be located below the current step textually.
* `go back to step <Integer>`: Go to the step labelled `<Integer>`. The
  provided step must be located above the current step textually.
* `place <Bowl> in the oven and bake at <Temperature>`: This is used to trigger
  a predefined set of built-in functions, according to the `<Temperature>`.
  *Magic oven!*

  The `<Temperature>` is a number immediately followed by `C` or `F`.
  *Celsius is better.*

  | `<Temperature>` | Best for | Function triggered                          |
  | --------------- | -------- | ------------------------------------------- |
  | `190C`          | Cookie   | Print the integer in `<Bowl>`, then newline |
  | `425F`          | Muffin   | Print the character whose Unicode code point is the integer in `<Bowl>` |
  | `230C`          | Pizza    | Read an integer and store into `<Bowl>`     |
  | `350F`          | Toast    | Read a character and store its Unicode code point into `<Bowl>` |
* `serves <Integer>`: Terminate the recipe. If this is used in the `Muffin`
  recipe, `<Integer> - 1` will be the exit code. So `serves 1` means a normal
  exit.

  If the `Muffin` recipe finishes because the last step is done and we didn't
  jump back, then an exit code of 0 (normal exit) is assumed.
* `add <Ingredient name> into <Mold>`: Push the integer or string constant
  specified by `<Ingredient name>` onto `<Mold>`.
* `pour contents of <Bowl> into <Mold>`: Push the value of `<Bowl>` onto
  `<Mold>`.
* `remove a layer from <Mold>`: Remove/Pop the top value from `<Mold>`.
* `remove a layer from <Mold> and dump into <Bowl>`: Remove/Pop the top integer
  value from `<Mold>` and put it into `<Bowl>`.
* `microwave <Mold>`: Print out the top value of `<Mold>` and a new line.
* `serve with <Recipe name>`: Execute the recipe named `<Recipe name>` and wait
  until it finishes.

For all the commands if an operation is invalid (e.g. adding a string into a
bowl), then a compile time error/runtime error will be thrown and the
compilation/execution stops.

`<Predicate>` takes one of these forms:

* `<Bowl> is empty`: Test if `<Bowl>` has nothing in it (if it's zero).
* `<Bowl> is not empty`: Opposite of the above.
* `<Mold> is empty`: Test if `<Mold>` has nothing in it (if its size is zero).
* `<Mold> is not empty`: Opposite of the above.

# FAQ

## What's the purpose?

**Because it's fun!** If you haven't tried before, compilers and programming
languages might be something you will get interested in.

Muffin is an *esoteric programming language* (a.k.a. *esolang*). These
languages are not intended for real life projects, but mostly for conducting
research or for fun.

You can find a bunch of esolangs on the [esolang wiki][esolang-wiki].

[esolang-wiki]: https://esolangs.org/wiki/Main_Page

## Why should I vote for Muffin?

Muffin is:

* **Technical**: I really designed this programming language and implemented
  it myself. The compiler works like most compilers in the world -- tokenizer
  (lexer), parser, and code generator. The frontend editor is powered by
  [CodeMirror 6](code-mirror). I added the autocompletion, parsing (syntax
  highlighting) and auto-indentation logic. The build script of the frontend is
  written in Python.
* **Creative**: Write tasty programs that look like recipes!
* **Educational**: If you haven't heard of esolangs before, Muffin will be the
  first one!
* **Presented well**: Muffin has a demo website and you can try it out
  yourself. And look at this descriptive README file!

[code-mirror]: https://codemirror.net/

## How do I build your demo website locally?

Dependencies:

* [Node.js](https://nodejs.org/en)
* [Python](https://www.python.org/) 3.6 or above

Follow these steps:

1. Run `npm install` under the `codemirror/` directory. This requires network
   connection.
2. Go back to the project root and use Python to execute the build script
   `build.py`. Depending on your platform, it's either `python build.py` or
   `python3 build.py`.
3. The website is now ready under `src/` directory. We just need to serve the
   contents. Using Python, you can do this by `python -m http.server -d src/`.
4. Now go to `localhost:8000` in your browser. The website should be there.

## How did you come up with this idea?

[Chef][chef] is also a programming language that allows you to write delicious
programs, which has quite different design compared to Muffin. But that
inspired me to create Muffin. The [Fibonacci program in Chef][chef-fibo] took
34 lines of code, and an additional 6 declaration lines ("ingredients"), while
the same program in Muffin used 17 lines. In that regard, Muffin *might* be a
more concise language.

[chef]: https://www.dangermouse.net/esoteric/chef.html
[chef-fibo]: https://www.dangermouse.net/esoteric/chef_fib.html
