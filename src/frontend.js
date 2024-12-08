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

function muffinError(exc) {
    /* Error handler passed to Muffin compiler. */
    const element = document.createElement("span");
    let textKind;
    if (exc instanceof ExecutionCancelled) {
        textKind = "exec-info";
        element.textContent = "Execution terminated";
    }
    else if (typeof exc == "string") {
        // Muffin throws runtime errors as strings
        textKind = "exec-error";
        element.textContent = `Runtime error: ${exc}`;
    }
    else {
        // Unexpected error
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
    if (opCounter >= 1000) {
        await new Promise((r) => setTimeout(r, 10));
    }
}

let readlineResolve = null;

async function muffinReadline() {
    const s = await new Promise((r) => {
        readlineResolve = r;
        updateStdinSenderState(true);
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

class MuffinConfig extends CodeGenConfig {
    constructor(owner) {
        super(owner);
        this.asynchronous = true;
        this.func_prolog = `let ${opCounter} = 0;`;
        this.loop_prolog = `${opCounter}++;`;
        this.loop_epilog = `await ${argRest}(${opCounter});`;
    }
    handle_error(error) {
        return `${argError}(${error});`;
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
    const jsCode = compileCode(MuffinConfig);
    if (jsCode == null) {
        return;
    }
    if (runButton.className == "can-run") {
        let compiledFunc;
        try {
            compiledFunc = new AsyncFunction(
                argError, argExit, argPrint, argRest, argReadline,
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
