import * as cm6 from "./editor.js";
import { compile, CompileError, CodeGenConfig, NodeConfig } from "./muffin.js";

const AsyncFunction = async function () {}.constructor;

const helloWorldCode = `Muffin recipe
ingredients
    "Hello, world!" brand Flour
method
    1. set up a Muffin Cup
    2. add Flour into Muffin Cup
    3. microwave Muffin Cup
    4. serves 1
`;
const editor = new cm6.EditorView({
    parent: document.getElementById('code'),
    state: cm6.createEditorState(helloWorldCode),
});

function createSubmitIssue() {
    const submitIssue = document.createElement("a");
    submitIssue.textContent = "submit an issue";
    submitIssue.href = "https://github.com/CBerJun/Muffin/issues/new";
    submitIssue.target = "_blank";
    submitIssue.rel = "noreferrer";
    return submitIssue;
}

function crashed() {
    return [
        "Whoops! The compiler just CRASHED.",
        document.createElement("br"),
        "Please return it to the vendor (",
        createSubmitIssue(),
        ") with the recipe you were trying to use. Thanks!",
    ];
}

const executionBox = document.getElementById("execution");
const runButton = document.getElementById("run");
const runButtonText = document.getElementById("run-text");
const compileToNodeButton = document.getElementById("compile-to-node");

function executionFinished() {
    updateRunButtonState("can-run");
    compileToNodeButton.removeAttribute("disabled");
}

function muffinExit(code) {
    /* Exit handler passed to Muffin compiler. */
    const element = document.createElement("span");
    element.className = "exec-info";
    element.textContent = `Program exited with code ${code}`;
    executionBox.append(element);
    executionFinished();
}

function muffinError(message) {
    /* Error handler passed to Muffin compiler. */
    const element = document.createElement("span");
    element.className = "exec-error";
    element.textContent = `Runtime error: ${message}`;
    executionBox.append(element);
    executionFinished();
}

function muffinUnexpectedError(exc) {
    /* Unexpected error handler passed to Muffin compiler. */
    const element = document.createElement("span");
    let textKind;
    if (exc instanceof ExecutionCancelled) {
        textKind = "exec-info";
        element.textContent = "Execution terminated";
    }
    else {
        // Real unexpected error
        textKind = "exec-error";
        element.append(
            "An unexpected error happened.",
            document.createElement("br"),
            "You might have found a bug in Muffin! Please ",
            createSubmitIssue(),
            ".",
        );
    }
    element.className = textKind;
    executionBox.append(element);
    executionFinished();
}

function muffinPrint(object) {
    /* Print/println handler passed to Muffin compiler. */
    const lines = String(object).split("\n");
    const children = [];
    for (let i = 0; i < lines.length; ++i) {
        children.push(lines[i]);
        if (i < lines.length - 1) {
            children.push(document.createElement("br"));
        }
    }
    const element = document.createElement("span");
    element.className = "exec-normal";
    element.append(...children);
    executionBox.append(element);
}

// Boolean indicating if the user has requested to stop the execution:
let executionCanceling;

class ExecutionCancelled {}

async function muffinRest(opCounter) {
    // If the user requested for stop, throw
    if (executionCanceling) {
        throw new ExecutionCancelled();
    }
    // After 1000 Muffin instructions have been executed, sleep for
    // 10 milliseconds to prevent blocking the whole interpreter.
    if (opCounter >= 999) {
        await new Promise((r) => setTimeout(r, 10));
        return 0;
    }
    return opCounter + 1;
}

let readlineResolve = null;

async function muffinReadline() {
    const s = await new Promise((r) => {
        readlineResolve = r;
        updateStdinSenderState(true);
        inputLine.focus();
    });
    readlineResolve = null;
    updateStdinSenderState(false);
    // When result `s` is string, that's the input line; or when it is
    // null, that means user stops the execution.
    if (s == null) {
        throw new ExecutionCancelled();
    }
    return s;
}

const argError = "T1";
const argExit = "T2";
const argPrint = "T3";
const opCounter = "T4";
const argRest = "T5";
const argReadline = "T6";
const argUnexpectedError = "T7";

class MuffinConfig extends CodeGenConfig {
    constructor(owner) {
        super(owner);
        this.asynchronous = true;
        this.loop_epilog = `${opCounter} = await ${argRest}(${opCounter});`;
    }
    handle_error(error) {
        return `${argError}(${error});`;
    }
    handle_unexpected_error(error) {
        return `${argUnexpectedError}(${error});`;
    }
    handle_exit(code) {
        return `${argExit}(${code});`;
    }
    handle_println(object) {
        return `${argPrint}(${object}+"\\n");`;
    }
    handle_print(object) {
        return `${argPrint}(${object});`;
    }
    handle_read_line() {
        return `await ${argReadline}()`;
    }
    at_last(code) {
        return `let ${opCounter} = 0;` + code;
    }
}

function updateRunButtonState(state) {
    runButton.className = state;
    runButtonText.textContent = state == "can-run" ? "Run" : "Stop";
}

// Initial state:
updateRunButtonState("can-run");

function compileCode(configCls) {
    while (executionBox.lastChild) {
        executionBox.lastChild.remove();
    }
    const source = editor.state.doc.toString();
    let jsCode;
    try {
        jsCode = compile(source, configCls);
    }
    catch (exc) {
        const element = document.createElement("span");
        element.className = "exec-error";
        if (exc instanceof CompileError) {
            const prefixes = [];
            if (exc.loc) {
                const locElement = document.createElement("a");
                locElement.onclick = (event) => {
                    try {
                        // The index may have become invalid (after
                        // user changes code)
                        editor.dispatch({
                            selection: {anchor: exc.char_index}
                        });
                    }
                    catch (exc) {
                        if (!(exc instanceof RangeError)) {
                            throw exc;
                        }
                    }
                    editor.focus();
                    return false;
                };
                const [line, col] = exc.loc;
                locElement.textContent = `line ${line} col ${col}`;
                prefixes.push(
                    "At ",
                    locElement,
                    ": ",
                );
            }
            else {
                prefixes.push("Cause: ");
            }
            element.append(
                "Oops... Compilation failed!",
                document.createElement("br"),
                ...prefixes,
                exc.message,
                document.createElement("br"),
                "Fix your recipe and try baking it again later.",
            );
        }
        else {
            console.error(exc);
            element.append(...crashed());
        }
        executionBox.appendChild(element);
        return null;
    }
    return jsCode;
}

export function onRunButtonClicked() {
    /* Callback from button#run. */
    if (runButton.className == "can-run") {
        const jsCode = compileCode(MuffinConfig);
        if (jsCode == null) {
            return;
        }
        let compiledFunc;
        try {
            compiledFunc = new AsyncFunction(
                argError, argExit, argPrint, argRest, argReadline,
                argUnexpectedError,
                jsCode
            );
        }
        catch (exc) {
            console.error(exc);
            const element = document.createElement("span");
            element.className = "exec-error";
            element.append(...crashed());
            return;
        }
        updateRunButtonState("can-stop");
        compileToNodeButton.setAttribute("disabled", "");
        executionCanceling = false;
        compiledFunc(
            muffinError, muffinExit, muffinPrint, muffinRest, muffinReadline,
            muffinUnexpectedError
        );
    }
    else {
        executionCanceling = true;
        if (readlineResolve != null) {
            readlineResolve(null);
        }
    }
}

const sendButton = document.getElementById("send");
const inputLine = document.getElementById("input-line");

function updateStdinSenderState(enabled) {
    if (enabled) {
        sendButton.removeAttribute("disabled");
        inputLine.removeAttribute("disabled");
    }
    else {
        sendButton.setAttribute("disabled", "");
        inputLine.setAttribute("disabled", "");
    }
}

// Initial state:
updateStdinSenderState(false);

export function onSendButtonClicked() {
    if (readlineResolve == null) {
        console.error("should have readlineResolve non-null");
    }
    else {
        const s = inputLine.value;
        inputLine.value = "";
        readlineResolve(s);
        const element = document.createElement("span");
        element.className = "exec-input";
        element.textContent = s;
        executionBox.append(
            element,
            document.createElement("br"),
        );
    }
}

// Allow using Enter key to send
inputLine.addEventListener("keydown", (event) => {
    if (event.key == "Enter") {
        onSendButtonClicked();
    }
});

export function onCompileToNodeButtonClicked() {
    const jsCode = compileCode(NodeConfig);
    if (jsCode == null) {
        return;
    }
    const hintElement = document.createElement("span");
    hintElement.className = "exec-info";
    hintElement.textContent = (
        "Muffin compiles down to JavaScript. Here's the compiled code for "
        + "your recipe, which needs to run in a Node.js environment."
    );
    const codeElement = document.createElement("span");
    codeElement.className = "exec-normal";
    codeElement.textContent = jsCode;
    executionBox.append(
        hintElement,
        document.createElement("br"),
        document.createElement("br"),
        codeElement,
    );
}

const examples = new Map([
    ["Hello, world!", helloWorldCode],
    ["Fibonacci", `Muffin recipe
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
`],
    ["FizzBuzz", `Muffin recipe
ingredients
    100 grams of Sugar
    1 Egg
    3 grams of Salt
    5 grams of Maple Syrup
    "Fizz" brand Whipping Cream
    "Buzz" brand Vanilla Beans
    "FizzBuzz" brand Sour Cream
method
    1. set up 2 Bowls
    2. set up a Pizza Pan
    3. add Egg into 1st Bowl
    4. add water to 1st Bowl at a 1:1 ratio
    5. clean 2nd Bowl
    6. pour half of contents of 1st Bowl into 2nd Bowl
    7. remove Sugar from 2nd Bowl
    8. if 2nd Bowl is not empty, proceed to step 34
    9. add water to 1st Bowl at a 1:1 ratio
    10. pour half of contents of 1st Bowl into Pizza Pan
    11. add Salt into Pizza Pan
    12. serve with Blueberry Sauce
    13. add water to 1st Bowl at a 1:1 ratio
    14. pour half of contents of 1st Bowl into Pizza Pan
    15. add Maple Syrup into Pizza Pan
    16. serve with Blueberry Sauce
    17. remove a layer from Pizza Pan and dump into 2nd Bowl
    18. if 2nd Bowl is empty, proceed to step 24
    19. clean 2nd Bowl
    20. remove a layer from Pizza Pan and dump into 2nd Bowl
    21. if 2nd Bowl is empty, proceed to step 28
    22. place 1st Bowl in the oven and bake at 190C
    23. proceed to step 33
    24. remove a layer from Pizza Pan and dump into 2nd Bowl
    25. if 2nd Bowl is empty, proceed to step 30
    26. add Vanilla Beans into Pizza Pan
    27. proceed to step 31
    28. add Whipping Cream into Pizza Pan
    29. proceed to step 31
    30. add Sour Cream into Pizza Pan
    31. microwave Pizza Pan
    32. remove a layer from Pizza Pan
    33. go back to step 3
    34. serves 1

Blueberry Sauce recipe
ingredients
method
    1. set up 2 Bowls
    2. remove a layer from Pizza Pan and dump into 2nd Bowl
    3. remove a layer from Pizza Pan and dump into 1st Bowl
    4. add water to 1st Bowl at a 1:1 ratio
    5. pour half of contents of 1st Bowl into Pizza Pan
    6. pour contents of 1st Bowl into Pizza Pan
    7. add water to 2nd Bowl at a 1:1 ratio
    8. pour half of contents of 2nd Bowl into Pizza Pan
    9. sift the mixture in Pizza Pan
    10. pour contents of 2nd Bowl into Pizza Pan
    11. whip the mixture in Pizza Pan
    12. bring the mixture in Pizza Pan to a boil
`],
    ["Guess the Number", `Muffin recipe
ingredients
    1 Onion
    100 grams of Sugar
    "Guess a number between " brand Cheddar Cheese
    " and " brand Mozzarella Cheese
    "Make a guess: " brand Chives
    "Too big" brand Sausages
    "Too small" brand Shallots
    "Correct!" brand Butter
method
    1. set up a Toast Mold
    2. set up 3 Bowls
    3. add Cheddar Cheese into Toast Mold
    4. microwave Toast Mold in grill mode
    5. remove a layer from Toast Mold
    6. add Onion into Toast Mold
    7. microwave Toast Mold in grill mode
    8. add Mozzarella Cheese into Toast Mold
    9. microwave Toast Mold in grill mode
    10. remove a layer from Toast Mold
    11. add Sugar into Toast Mold
    12. microwave Toast Mold
    13. stir the mixture in Toast Mold until smooth
    14. remove a layer from Toast Mold and dump into 1st Bowl
    15. add Chives into Toast Mold
    16. microwave Toast Mold in grill mode
    17. remove a layer from Toast Mold
    18. place 2nd Bowl in the oven and bake at 230C
    19. add water to 2nd Bowl at a 1:1 ratio
    20. pour half of contents of 2nd Bowl into Toast Mold
    21. add water to 1st Bowl at a 1:1 ratio
    22. pour half of contents of 1st Bowl into Toast Mold
    23. bring the mixture in Toast Mold to a boil
    24. clean 3rd Bowl
    25. remove a layer from Toast Mold and dump into 3rd Bowl
    26. add water to 1st Bowl at a 1:1 ratio
    27. pour half of contents of 1st Bowl into Toast Mold
    28. pour contents of 2nd Bowl into Toast Mold
    29. bring the mixture in Toast Mold to a boil
    30. remove a layer from Toast Mold and dump into 2nd Bowl
    31. if 3rd Bowl is empty, proceed to step 34
    32. add Sausages into Toast Mold
    33. proceed to step 36
    34. if 2nd Bowl is empty, proceed to step 39
    35. add Shallots into Toast Mold
    36. microwave Toast Mold
    37. remove a layer from Toast Mold
    38. go back to step 15
    39. add Butter into Toast Mold
    40. microwave Toast Mold
`],
    ["99 Bottles of Beer", `Muffin recipe
ingredients
    " of beer on the wall, " brand Beer
    " of beer." brand Ginger Ale
    "Take one down and pass it around, " brand Yogurt
    " of beer on the wall." brand Basil
    1 Egg Yolk
    99 Eggs
method
    1. set up a Pizza Pan
    2. set up a Bowl
    3. add Eggs into Bowl
    4. add water to Bowl at a 1:1 ratio
    5. pour half of contents of Bowl into Pizza Pan
    6. serve with Fruit Salad
    7. add Beer into Pizza Pan
    8. microwave Pizza Pan in grill mode
    9. remove a layer from Pizza Pan
    10. add water to Bowl at a 1:1 ratio
    11. pour half of contents of Bowl into Pizza Pan
    12. serve with Fruit Salad
    13. add Ginger Ale into Pizza Pan
    14. microwave Pizza Pan
    15. remove a layer from Pizza Pan
    16. add Yogurt into Pizza Pan
    17. microwave Pizza Pan in grill mode
    18. remove a layer from Pizza Pan
    19. remove Egg Yolk from Bowl
    20. add water to Bowl at a 1:1 ratio
    21. pour half of contents of Bowl into Pizza Pan
    22. serve with Fruit Salad
    23. add Basil into Pizza Pan
    24. microwave Pizza Pan
    25. remove a layer from Pizza Pan
    26. if Bowl is not empty, go back to step 4

Fruit Salad recipe
ingredients
    " bottles" brand Star Fruit
    "1 bottle" brand Coconuts
    "no more bottles" brand Strawberries
    1 Egg
method
    1. set up a Bowl
    2. remove a layer from Pizza Pan and dump into Bowl
    3. if Bowl is empty, proceed to step 12
    4. remove Egg from Bowl
    5. if Bowl is empty, proceed to step 14
    6. add Egg into Bowl
    7. pour contents of Bowl into Pizza Pan
    8. microwave Pizza Pan in grill mode
    9. remove a layer from Pizza Pan
    10. add Star Fruit into Pizza Pan
    11. proceed to step 15
    12. add Strawberries into Pizza Pan
    13. proceed to step 15
    14. add Coconuts into Pizza Pan
    15. microwave Pizza Pan in grill mode
    16. remove a layer from Pizza Pan
`],
    ["Factorial", `Muffin recipe
ingredients
    1 Potato
    "Enter a nonnegative integer: " brand Oregano
    "! = " brand Cheese
method
    1. set up a Baking Dish
    2. set up a Bowl
    3. add Oregano into Baking Dish
    4. microwave Baking Dish in grill mode
    5. place Bowl in the oven and bake at 230C
    6. add water to Bowl at a 1:1 ratio
    7. pour half of contents of Bowl into Baking Dish
    8. add Potato into Baking Dish
    9. if Bowl is empty, proceed to step 15
    10. add water to Bowl at a 1:1 ratio
    11. pour half of contents of Bowl into Baking Dish
    12. whip the mixture in Baking Dish
    13. remove Potato from Bowl
    14. go back to step 9
    15. remove a layer from Baking Dish and dump into Bowl
    16. microwave Baking Dish in grill mode
    17. add Cheese into Baking Dish
    18. microwave Baking Dish in grill mode
    19. place Bowl in the oven and bake at 190C
`],
    ["Input/Output", `Muffin recipe
ingredients
    "Enter an integer: " brand Flour
    "Enter a character: " brand Butter
    "You typed " brand Eggs
    "The code point of your character is " brand Sugar
method
    1. set up 2 Bowls
    2. set up a Pizza Pan
    3. add Flour into Pizza Pan
    4. microwave Pizza Pan in grill mode
    5. place 1st Bowl in the oven and bake at 230C
    6. add Eggs into Pizza Pan
    7. microwave Pizza Pan in grill mode
    8. place 1st Bowl in the oven and bake at 190C
    9. add Butter into Pizza Pan
    10. microwave Pizza Pan in grill mode
    11. place 2nd Bowl in the oven and bake at 350F
    12. add Sugar into Pizza Pan
    13. microwave Pizza Pan in grill mode
    14. place 2nd Bowl in the oven and bake at 190C
    15. serves 1
`],
    ["Infinite Loop", `Muffin recipe
ingredients
method
    1. proceed to step 2
    2. go back to step 1
`],
]);

const examplesDiv = document.getElementById("examples");

// Initialize div#examples
examples.forEach((value, key) => {
    const element = document.createElement("span");
    element.textContent = key;
    element.addEventListener("click", () => {
        editor.dispatch({
            changes: {
                from: 0, to: editor.state.doc.length,
                insert: value
            }
        });
    });
    examplesDiv.append(element);
});

const docsUrl =
"https://github.com/CBerJun/Muffin?tab=readme-ov-file#language-specification";

export function openDocs() {
    window.open(docsUrl, "_blank", "noreferrer");
}
