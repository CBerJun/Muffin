/*--- The tokenizer! ---*/

const TokenKind = {
    KEY_PHRASE: 0,  // "set up"
    PHRASE: 1,  // "Muffin"
    NUMBER: 2,  // "42"
    NUMBER_PERIOD: 3,  // "2."
    COMMA: 4,  // ","
    ORDINAL: 5,  // "1st"
    NEW_LINE: 6,
    TEMPERATURE: 7,  // "180C"
    EOF: 8,
    STRING: 9,  // "Hello, world!"
    COLON: 10,  // ":"
};

// For diagnostics
const TokenNames = Object.fromEntries(
    Object.entries(TokenKind).map((x) => x.reverse())
);

class Token {
    constructor(kind, loc, value=null) {
        this.kind = kind;
        this.value = value;
        this.loc = loc;
    }
};

class CompileError {
    constructor(message, loc) {
        this.message = message;
        this.loc = loc;  // [line_no, col_no] or null
    }
    format() {
        if (this.loc == null) {
            return this.message;
        }
        return `${this.loc[0]}:${this.loc[1]}: ${this.message}`;
    }
}

const ordinal_suffixes = ['st', 'nd', 'rd', 'th'];
const key_phrases = new Set([
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
    'recipe',
    'ingredients',
    'method',
    'grams of',
    'brand',
    'remove a layer from',
    'and dump into',
    'microwave',
    'serve with',
]);
const operators = new Map([
    [",", TokenKind.COMMA],
    [":", TokenKind.COLON],
])

class Tokenizer {
    constructor(str) {
        this.str = str;
        this.ptr = 1;
        this.c = this.str[0];
        this.line_no = 0;
    }
    advance() {
        this.c = this.str[this.ptr++];
        this.col_no++;
    }
    advance2(chars) {
        this.ptr += chars;
        this.col_no += chars;
        this.c = this.str[this.ptr - 1];
    }
    complain(message, col_no=null) {
        throw new CompileError(
            message, [this.line_no, col_no == null ? this.col_no : col_no]
        );
    }
    skip_ws() {
        while (this.c == ' ' || this.c == '\t') {
            this.advance();
        }
    }
    regex_match(regex) {
        regex.lastIndex = this.ptr - 1;
        return regex.exec(this.str);
    }
    make_token(kind, value=null) {
        return new Token(kind, [this.line_no, this.col_no], value);
    }
    parse_line() {
        const res = [];
        this.col_no = 1;
        this.line_no++;
        while (this.c != '\n' && this.c != undefined) {
            this.skip_ws()
            const digit = /\d+/y;
            const word = /[a-zA-Z]\w*/y;
            const number_result = this.regex_match(digit);
            let word_result = this.regex_match(word);
            if (number_result) {
                const loc = [this.line_no, this.col_no];
                const match = number_result[0];
                this.advance2(match.length);
                const number = parseInt(match);
                // Check for suffixes
                const num_suffix = /\.|\w*/y;
                const num_suffix_result = this.regex_match(num_suffix);
                const suffix_match = num_suffix_result[0];
                if (suffix_match == '.') {
                    res.push(new Token(TokenKind.NUMBER_PERIOD, loc, number));
                }
                else if (suffix_match == 'C' || suffix_match == 'F') {
                    res.push(new Token(
                        TokenKind.TEMPERATURE, loc,
                        number + suffix_match
                    ));
                }
                else if (ordinal_suffixes.includes(suffix_match)) {
                    // TODO make sure suffix is correct
                    res.push(new Token(TokenKind.ORDINAL, loc, number));
                }
                else if (suffix_match.length == 0) {
                    res.push(new Token(TokenKind.NUMBER, loc, number));
                }
                else {
                    this.complain(`unknown number suffix ${suffix_match}`);
                }
                this.advance2(suffix_match.length);
            }
            else if (word_result) {
                // Phrase
                const start_col = this.col_no;
                const loc = [this.line_no, this.col_no];
                const first_char = word_result[0][0];
                const is_kw = first_char.toLowerCase() == first_char;
                const word2 = is_kw ? /[a-z]\w*/y : /[A-Z]\w*/y;
                const word_list = [];
                do {
                    const match = word_result[0];
                    word_list.push(match);
                    this.advance2(match.length);
                    this.skip_ws();
                    word_result = this.regex_match(word2);
                } while (word_result);
                const phrase = word_list.join(' ');
                if (is_kw) {
                    if (key_phrases.has(phrase)) {
                        res.push(new Token(TokenKind.KEY_PHRASE, loc, phrase));
                    }
                    else {
                        this.complain(
                            `unknown key phrase "${phrase}"; identifiers must `
                            + `be Title Case`, start_col
                        );
                    }
                }
                else {
                    res.push(new Token(TokenKind.PHRASE, loc, phrase));
                }
            }
            else if (this.c == '"') {
                // String
                const start_col = this.col_no;
                const start_ptr = this.ptr;
                this.advance();
                while (this.c != '"') {
                    if (this.c == '\n' || this.c == undefined) {
                        this.complain("unterminated string", start_col);
                    }
                    this.advance();
                }
                res.push(new Token(
                    TokenKind.STRING, [this.line_no, start_col],
                    this.str.slice(start_ptr, this.ptr - 1)
                ));
                this.advance();
            }
            else if (operators.has(this.c)) {
                // Operator
                res.push(this.make_token(operators.get(this.c)));
                this.advance();
            }
            else {
                this.complain(`invalid character "${this.c}"`);
            }
        }
        if (res.length != 0) {
            res.push(this.make_token(TokenKind.NEW_LINE));
        }
        if (this.c == '\n') {
            this.advance();
        }
        else {
            res.push(this.make_token(TokenKind.EOF));
        }
        return res;
    }
};

function *tokenize(str) {
    const tokenizer = new Tokenizer(str);
    while (true) {
        let buffer;
        do {
            buffer = tokenizer.parse_line();
        } while (buffer.length == 0);
        yield* buffer;
        if (buffer[buffer.length - 1].kind == TokenKind.EOF) {
            break;
        }
    }
}

/*--- The parser! ---*/

class Program {
    constructor() {
        this.recipes = new Map();  // name -> recipe
    }
}

class Recipe {
    constructor() {
        this.steps = [];  // Step objects
    }
}

const OpCodes = {
    SET_UP_BOWL: 0,  // bowl_kind, num
    SET_UP_MOLD: 1,  // mold_kind, num
    ADD_ING_TO_BOWL: 2,  // ing, bowl
    REMOVE_ING_FROM_BOWL: 3,  // ing, bowl
    CLEAN_BOWL: 4,  // bowl
    ADD_WATER_TO_BOWL: 5,  // bowl, num
    TRANSFER_HALF: 6,  // bowl1, bowl2
    TRANSFER_ALL: 7,  // bowl1, bowl2
    GO_TO: 8,  // step
    BAKE: 9,  // bowl, temperature
    SERVES: 10,  // num
    MOLD_PUSH_BOWL: 11,  // mold, bowl
    MOLD_POP: 12,  // mold
    MOLD_POP_AND_STORE: 13,  // mold, bowl
    MICROWAVE: 14,  // mold
    MOLD_PUSH_ING: 15,  // mold, ing
    SERVE_WITH: 16,  // recipe
};

const PredicateKind = {
    BOWL_IS_EMPTY: 0,  // bowl
    BOWL_NOT_EMPTY: 1,  // bowl
    MOLD_IS_EMPTY: 2,  // mold
    MOLD_NOT_EMPTY: 3,  // mold
};

class Step {
    constructor(content, predicate=null) {
        this.content = content;  // Object with an `op` attribute
        this.predicate = predicate;  // Null or Object with an `op` attribute
    }
}

function or_list(arr) {
    return arr.length == 1 ? arr[0]
        : arr.slice(0, -2).join(', ') + `${arr[-2]} or ${kinds[-1]}`;
}

const measures = [
    'grams of',
];

const bowls = [
    ["Bowl", "Bowls"],
    ["Glass Bowl", "Glass Bowls"],
    ["Mixing Bowl", "Mixing Bowls"],
    ["Plastic Bowl", "Plastic Bowls"],
];
const molds = [
    ["Cake Mold", "Cake Molds"],
    ["Muffin Cup", "Muffin Cups"],
    ["Loaf Pan", "Loaf Pans"],
    ["Toast Mold", "Toast Molds"],
    ["Pizza Pan", "Pizza Pans"],
    ["Baking Dish", "Baking Dishes"],
];
const valid_temperatures = [
    "190C",
    "425F",
    "230C",
    "350F",
];

class Bowl {
    constructor(kind, id) {
        this.kind = kind;
        this.id = id;
    }
}

class Mold {
    constructor(kind, id) {
        this.kind = kind;
        this.id = id;
    }
}

class Parser {
    constructor(tokens) {
        this.tokens = tokens;
    }
    complain(token, message) {
        throw new CompileError(message, token.loc);
    }
    expect(...kinds) {
        let {value} = this.tokens.next();
        if (!kinds.includes(value.kind)) {
            const expecting = or_list(kinds.map((x) => TokenNames[x]));
            const got = TokenNames[value.kind];
            this.complain(value, `expecting ${expecting}, not ${got}`);
        }
        return value;
    }
    expect_keyword(...words) {
        const tok = this.expect(TokenKind.KEY_PHRASE);
        if (words.includes(tok.value)) {
            return tok.value;
        }
        const message = "expecting"
            + or_list(words.map((x) => `"${x}"`));
        this.complain(tok, message);
    }
    // Parsing rules start
    program() {
        const program = new Program();
        let tok = this.expect(TokenKind.EOF, TokenKind.PHRASE);
        while (tok.kind != TokenKind.EOF) {
            if (program.recipes.has(tok.value)) {
                this.complain(tok, `recipe "${tok.value}" already exists`);
            }
            const recipe = new Recipe();
            program.recipes.set(tok.value, recipe);
            this.expect_keyword("recipe");
            this.expect(TokenKind.NEW_LINE);
            this.expect_keyword("ingredients");
            this.expect(TokenKind.NEW_LINE);
            this.ingredients = new Map();  // name -> value
            while (true) {
                const tok2 = this.expect(
                    TokenKind.KEY_PHRASE, TokenKind.STRING, TokenKind.NUMBER
                );
                if (tok2.kind == TokenKind.KEY_PHRASE) {
                    if (tok2.value == "method") {
                        break;
                    }
                    else {
                        this.complain(
                            tok2,
                            `key phrase "${tok2.value}" can't be used here`
                        );
                    }
                }
                let ing;
                if (tok2.kind == TokenKind.STRING) {
                    this.expect_keyword("brand");
                    ing = this.expect(TokenKind.PHRASE);
                }
                else {
                    const tok3 = this.expect(
                        TokenKind.KEY_PHRASE, TokenKind.PHRASE
                    );
                    if (tok3.kind == TokenKind.KEY_PHRASE) {
                        if (measures.includes(tok3.value)) {
                            ing = this.expect(TokenKind.PHRASE);
                        }
                        else {
                            this.complain(
                                tok3,
                                `key phrase "${tok2.value}" is not a measure`
                            );
                        }
                    }
                    else {
                        ing = tok3;
                    }
                }
                this.expect(TokenKind.NEW_LINE);
                const ing_name = ing.value;
                if (this.ingredients.has(ing_name)) {
                    this.complain(ing, `ingredient "${ing_name}" used twice`);
                }
                this.ingredients.set(ing_name, tok2.value);
            }
            this.expect(TokenKind.NEW_LINE);
            let i = 1;
            while (true) {
                tok = this.expect(
                    TokenKind.EOF, TokenKind.PHRASE, TokenKind.NUMBER_PERIOD
                );
                if (tok.kind != TokenKind.NUMBER_PERIOD) {
                    break;
                }
                if (i != tok.value) {
                    this.complain(tok, `wrong label; should be "${i}."`);
                }
                let predicate = null;
                let tok2 = this.expect(TokenKind.KEY_PHRASE);
                if (tok2.value == "if") {
                    predicate = this.predicate();
                    tok2 = this.expect(TokenKind.KEY_PHRASE);
                }
                const step_content = this.step_content(tok2, i);
                recipe.steps.push(new Step(step_content, predicate));
                i++;
            }
        }
        this.ingredients = undefined;  // Allow GC
        return program;
    }
    bowl_or_mold_impl(predicate, name) {
        let tok = this.expect(TokenKind.ORDINAL, TokenKind.PHRASE);
        let id;
        if (tok.kind == TokenKind.ORDINAL) {
            id = tok.value;
            if (id <= 0) {
                this.complain(tok, `invalid ordinal ${id}`);
            }
            tok = this.expect(TokenKind.PHRASE);
        }
        else {
            id = 1;
        }
        const value = tok.value;
        const kind = predicate(value);
        if (kind == undefined) {
            this.complain(
                tok, `"${tok.value}" is not a valid ${name} name`
            );
        }
        return [kind, new (kind == "bowl" ? Bowl : Mold)(tok.value, id)];
    }
    bowl_or_mold() {
        return this.bowl_or_mold_impl(
            (value) => {
                if (bowls.some((x) => x[0] == value)) {
                    return "bowl";
                }
                else if (molds.some((x) => x[0] == value)) {
                    return "mold";
                }
                else {
                    return null;
                }
            },
            "bowl/mold"
        );
    }
    bowl() {
        const [kind, bowl] = this.bowl_or_mold_impl(
            (value) => bowls.some((x) => x[0] == value) ? "bowl" : null,
            "bowl"
        );
        return bowl;
    }
    mold() {
        const [kind, mold] = this.bowl_or_mold_impl(
            (value) => molds.some((x) => x[0] == value) ? "bowl" : null,
            "mold"
        );
        return mold;
    }
    predicate() {
        const [kind, subject] = this.bowl_or_mold();
        const empty =
            this.expect_keyword("is empty", "is not empty") == "is empty";
        this.expect(TokenKind.COMMA);
        let ret;
        if (kind == "bowl") {
            ret = {
                op: empty ? PredicateKind.BOWL_IS_EMPTY
                    : PredicateKind.BOWL_NOT_EMPTY,
                bowl: subject
            };
        }
        else {
            ret = {
                op: empty ? PredicateKind.MOLD_IS_EMPTY
                    : PredicateKind.MOLD_NOT_EMPTY,
                mold: subject
            };
        }
        return ret;
    }
    ingredient_impl() {
        const tok = this.expect(TokenKind.PHRASE);
        const value = this.ingredients.get(tok.value);
        if (value == undefined) {
            this.complain(tok, `undefined ingredient "${tok.value}"`);
        }
        return [tok, value];
    }
    int_ingredient() {
        const [tok, value] = this.ingredient_impl();
        if (typeof value == "string") {
            this.complain(
                tok,
                `cannot use string type ingredient "${tok.value}" here`
            );
        }
        return value;
    }
    positive_int() {
        const num = this.expect(TokenKind.NUMBER);
        if (num.value <= 0) {
            this.complain(num, `should be positive, not ${num.value}`);
        }
        return num.value;
    }
    step_content(tok, step_num) {
        let ret;
        let consume_new_line = true;
        switch (tok.value) {
            case "set up a": {
                const tok = this.expect(TokenKind.PHRASE);
                if (bowls.some((x) => x[0] == tok.value)) {
                    ret = {op: OpCodes.SET_UP_BOWL, bowl_kind: tok.value};
                }
                else if (molds.some((x) => x[0] == tok.value)) {
                    ret = {op: OpCodes.SET_UP_MOLD, mold_kind: tok.value};
                }
                else {
                    this.complain(
                        tok, `"${tok.value}" is not a valid bowl/mold name`
                    );
                }
                ret.num = 1;
                break;
            }
            case "set up": {
                const num = this.positive_int();
                const tok = this.expect(TokenKind.PHRASE);
                const idx = +(num > 1);
                const bowl = bowls.find((x) => x[idx] == tok.value);
                if (bowl) {
                    ret = {op: OpCodes.SET_UP_BOWL, bowl_kind: bowl[0]};
                }
                else {
                    const mold = molds.find((x) => x[idx] == tok.value);
                    if (mold) {
                        ret = {op: OpCodes.SET_UP_MOLD, mold_kind: mold[0]};
                    }
                    else {
                        this.complain(
                            tok, `"${tok.value}" is not a valid bowl/mold name`
                        );
                    }
                }
                ret.num = num;
                break;
            }
            case "add": {
                const [tok, value] = this.ingredient_impl();
                this.expect_keyword("into");
                const [kind, ob] = this.bowl_or_mold();
                if (kind == "bowl") {
                    if (typeof value == "string") {
                        this.complain(
                            tok,
                            "can only add string ingredient to molds"
                        );
                    }
                    ret = {op: OpCodes.ADD_ING_TO_BOWL, bowl: ob};
                }
                else {
                    ret = {op: OpCodes.MOLD_PUSH_ING, mold: ob};
                }
                ret.ing = value;
                break;
            }
            case "remove": {
                const value = this.int_ingredient();
                this.expect_keyword("from");
                const bowl = this.bowl();
                ret = {
                    op: OpCodes.REMOVE_ING_FROM_BOWL, bowl: bowl, ing: value
                };
                break;
            }
            case "clean": {
                const bowl = this.bowl();
                ret = {op: OpCodes.CLEAN_BOWL, bowl: bowl};
                break;
            }
            case "add water to": {
                const bowl = this.bowl();
                this.expect_keyword("at a");
                const one = this.expect(TokenKind.NUMBER);
                if (one.value != 1) {
                    this.complain(
                        one,
                        `left hand side of ratio must be 1, not ${one.value}`
                    );
                }
                this.expect(TokenKind.COLON);
                const num = this.positive_int();
                this.expect_keyword("ratio");
                ret = {op: OpCodes.ADD_WATER_TO_BOWL, bowl: bowl, num: num};
                break;
            }
            case "pour half of contents of": {
                const bowl1 = this.bowl();
                this.expect_keyword("into");
                const bowl2 = this.bowl();
                ret = {op: OpCodes.TRANSFER_HALF, bowl1: bowl1, bowl2: bowl2};
                break;
            }
            case "pour contents of": {
                const bowl1 = this.bowl();
                this.expect_keyword("into");
                const [kind, second] = this.bowl_or_mold();
                ret = kind == "bowl" ?
                    {op: OpCodes.TRANSFER_ALL, bowl1: bowl1, bowl2: second}
                    : {op: OpCodes.MOLD_PUSH_BOWL, mold: second, bowl: bowl1};
                break;
            }
            case "proceed to step": {
                const num = this.expect(TokenKind.NUMBER);
                if (num.value <= step_num) {
                    this.complain(num, "must be a future step number");
                }
                ret = {op: OpCodes.GO_TO, step: num.value};
                break;
            }
            case "go back to step": {
                const num = this.expect(TokenKind.NUMBER);
                if (num.value >= step_num || num.value <= 0) {
                    this.complain(num, "must be a previous step number");
                }
                ret = {op: OpCodes.GO_TO, step: num.value};
                break;
            }
            case "place": {
                const bowl = this.bowl();
                this.expect_keyword("in the oven and bake at");
                const temp_tok = this.expect(TokenKind.TEMPERATURE);
                const t = temp_tok.value;
                if (!valid_temperatures.includes(t)) {
                    this.complain(temp_tok, `our oven can't be set to ${t}!`);
                }
                ret = {op: OpCodes.BAKE, bowl: bowl, temperature: t};
                break;
            }
            case "serves": {
                const num = this.positive_int();
                ret = {op: OpCodes.SERVES, num: num};
                break;
            }
            case "remove a layer from": {
                const mold = this.mold();
                const second = this.expect(
                    TokenKind.NEW_LINE, TokenKind.KEY_PHRASE
                );
                if (second.kind == TokenKind.NEW_LINE) {
                    consume_new_line = false;
                    ret = {op: OpCodes.MOLD_POP, mold: mold};
                    break;
                }
                if (second.value != "and dump into") {
                    this.complain(
                        second, `keyword "${second.value}" can't be used here`
                    );
                }
                const bowl = this.bowl();
                ret = {op: OpCodes.MOLD_POP_AND_STORE, mold: mold, bowl: bowl};
                break;
            }
            case "microwave": {
                const mold = this.mold();
                ret = {op: OpCodes.MICROWAVE, mold: mold};
                break;
            }
            case "serve with": {
                const recipe = this.expect(TokenKind.PHRASE);
                ret = {op: OpCodes.SERVE_WITH, recipe: recipe};
                break;
            }
            default: {
                this.complain(tok, `unknown step "${tok.value}"`);
            }
        }
        if (consume_new_line) {
            this.expect(TokenKind.NEW_LINE);
        }
        return ret;
    }
}

function parse(tokens) {
    return new Parser(tokens).program();
}

/*--- The semantic analyzer! ---*/

function semantic_analyze(program) {
    // Make sure "Muffin" recipe exists
    // Make sure GO_TO targets are good
    // Make sure SERVE_WITH recipe is defined
}

/*--- The code generator! ---*/

class CodeGenerator {
    constructor(program) {
        this.recipe_ids = new Map();
        this.bowl_kind_ids = new Map();
        this.mold_kind_ids = new Map();
        this.n_func = "f";
        this.n_bowls = "b";
        this.n_molds = "m";
        this.n_kind = "k";
        this.n_ip = "i";
        this.n_new_ip = "I";
        this.n_err_handler =
            (caught) => `console.error("Muffin error: " + ${caught});`;
        this.n_err = "e";
        this.n_exit_handler =
            (code) => `process.exit(${code});`;
        this.n_tmp = "t";
        this.program = program;
        let i = 0;
        for (const name of program.recipes.keys()) {
            i++;
            this.recipe_ids.set(name, i);
        }
    }
    main() {
        const ret = [
            `const ${this.n_molds} = {};`,
        ];
        for (const [name, recipe] of this.program.recipes.entries()) {
            this.current_recipe = name;
            ret.push(
                `function ${this.func(name)}() {`,
                `const ${this.n_bowls} = {};`,
                `let ${this.n_ip} = 1;`,
                `while (${this.n_ip} <= ${recipe.steps.length}) {`,
                `let ${this.n_new_ip} = null;`,
                `let ${this.n_tmp};`,
                `switch (${this.n_ip}) {`,
            );
            this.current_step = 0;
            for (const step of recipe.steps) {
                this.current_step++;
                let stmt = this.gen_step(step.content).join("");
                if (step.predicate != null) {
                    stmt = this.gen_predicate(step.predicate, stmt).join("");
                }
                ret.push(`case ${this.current_step}: ${stmt} break;`);
            }
            ret.push(
                "}",  // end switch
                `if (${this.n_new_ip} == null) {${this.n_ip}++;}`,
                `else {${this.n_ip} = ${this.n_new_ip};}`,
                "}",  // end while
                "return 0;",  // assumed normal exit
                "}",  // end function
            );
        }
        const muffin_call = `${this.func("Muffin")}()`;
        ret.push(
            `try {${this.n_exit_handler(muffin_call)}}`,
            `catch (${this.n_err}) {${this.n_err_handler(this.n_err)}}`,
        )
        return ret.join("");
    }
    func(recipe_name) {
        return this.n_func + this.recipe_ids.get(recipe_name);
    }
    bowl_array(bowl_kind) {
        let id = this.bowl_kind_ids.get(bowl_kind);
        if (id == undefined) {
            id = this.bowl_kind_ids.size;
            this.bowl_kind_ids.set(bowl_kind, id);
        }
        return `${this.n_bowls}.${this.n_kind}${id}`;
    }
    mold_array(mold_kind) {
        let id = this.mold_kind_ids.get(mold_kind);
        if (id == undefined) {
            id = this.mold_kind_ids.size;
            this.mold_kind_ids.set(mold_kind, id);
        }
        return `${this.n_molds}.${this.n_kind}${id}`;
    }
    acquire_mold_bowl_impl(node, callback, arr_func) {
        const {kind, id} = node;
        const arr = this[arr_func](kind);
        const too_large = `id ${id} too large for "${kind}"`;
        const not_set_up = `"${kind}" not set up yet`;
        const item = `${arr}[${id - 1}]`;
        return (
            `if (!${arr}) {${this.call_fatal(not_set_up)}}`
            + (
                // No need to check index out of bounds for id 1
                id == 1 ? ""
                : `else if (${arr}.length < ${id})`
                + `{${this.call_fatal(too_large)}}`
            )
            + `else {${callback(item)}}`
        );
    }
    acquire_mold(node, cb) {
        return this.acquire_mold_bowl_impl(node, cb, "mold_array");
    }
    acquire_bowl(node, cb) {
        return this.acquire_mold_bowl_impl(node, cb, "bowl_array");
    }
    call_fatal(message) {
        const msg =
            `"${this.current_recipe}": step ${this.current_step}: ${message}`;
        return `throw ${JSON.stringify(msg)};`;
    }
    gen_step(x) {
        // `x` is step content (an Object with an `op` attribute)
        let t1;
        let t2;
        switch (x.op) {
        case OpCodes.SET_UP_BOWL:
            t1 = this.bowl_array(x.bowl_kind);
            t2 = `bowl kind "${x.bowl_kind}" already set up`;
            return [
                `if (${t1}) {${this.call_fatal(t2)}}`,
                `else {${t1} = new Array(${x.num}).fill(0);}`,
            ];
        case OpCodes.SET_UP_MOLD:
            t1 = this.mold_array(x.mold_kind);
            t2 = `mold kind "${x.mold_kind}" already set up`;
            return [
                `if (${t1}) {${this.call_fatal(t2)}}`,
                "else {",
                `${t1} = new Array(${x.num});`,
                `for (let i = 0; i < ${x.num}; i++) {${t1}[i] = [];}`,
                "}",
            ];
        case OpCodes.ADD_ING_TO_BOWL:
            return [
                this.acquire_bowl(x.bowl, (b) => `${b} += ${x.ing};`),
            ];
        case OpCodes.REMOVE_ING_FROM_BOWL:
            return [
                this.acquire_bowl(
                    x.bowl, (b) => `${b} -= Math.min(${b}, ${x.ing});`
                ),
            ];
        case OpCodes.CLEAN_BOWL:
            return [
                this.acquire_bowl(x.bowl, (b) => `${b} = 0;`),
            ];
        case OpCodes.ADD_WATER_TO_BOWL:
            return [
                this.acquire_bowl(x.bowl, (b) => `${b} *= ${x.num + 1};`),
            ];
        case OpCodes.TRANSFER_HALF:
            return [
                this.acquire_bowl(x.bowl1, (b1) => this.acquire_bowl(
                    x.bowl2, (b2) =>
                        `${this.n_tmp} = Math.floor(${b1} / 2);`
                        + `${b1} -= ${this.n_tmp}; ${b2} += ${this.n_tmp};`
                )),
            ];
        case OpCodes.TRANSFER_ALL:
            return [
                this.acquire_bowl(x.bowl1, (b1) => this.acquire_bowl(
                    x.bowl2, (b2) => `${b2} += ${b1}; ${b1} = 0;`
                )),
            ];
        case OpCodes.GO_TO:
            return [
                `${this.n_new_ip} = ${x.step};`,
            ]
        case OpCodes.BAKE:
            return [
                this.acquire_bowl(x.bowl, (b) => {
                    switch (x.temperature) {
                    case "190C":
                        return `console.log(${b});`;
                    case "425F":
                        return (
                            `if (${b} >= 0x110000) `
                            // TODO log the code point
                            + `{${this.call_fatal("invalid code point")}}`
                            + "else {process.stdout.write(String.fromCodePoint"
                            + `(${b}));}`
                        )
                    case "230C":
                    case "350F":
                        return "/* TBD */";
                    }
                }),
            ]
        case OpCodes.SERVES:
            return [
                `return ${x.num - 1};`,
            ]
        case OpCodes.MOLD_PUSH_BOWL:
            return [
                this.acquire_bowl(x.bowl, (b) => this.acquire_mold(
                    x.mold, (m) => `${b}.push(${m});`
                )),
            ]
        case OpCodes.MOLD_POP:
            t1 = "cannot pop from empty mold";
            return [
                this.acquire_mold(x.mold, (m) =>
                    `if (${m}.pop() == undefined) {${this.call_fatal(t1)}}`
                ),
            ]
        case OpCodes.MOLD_POP_AND_STORE:
            t1 = "cannot pop from empty mold";
            t2 = "cannot store string value into bowl";
            return [
                this.acquire_mold(x.mold, (m) => this.acquire_bowl(
                    x.bowl, (b) => `${this.n_tmp} = ${m}.pop();`
                        + `if (${this.n_tmp} == undefined)`
                        + `{${this.call_fatal(t1)}}`
                        + `else if (typeof ${this.n_tmp} == "string")`
                        + `{${this.call_fatal(t2)}}`
                        + `else {${b} = ${this.n_tmp};}`
                )),
            ]
        case OpCodes.MICROWAVE:
            t1 = "cannot microwave empty mold";
            return [
                this.acquire_mold(x.mold, (m) =>
                    `if (!${m}.length) {${this.call_fatal(t1)}}`
                    + `else {console.log(${m}[${m}.length - 1]);}`
                ),
            ]
        case OpCodes.MOLD_PUSH_ING:
            return [
                this.acquire_mold(x.mold, (m) =>
                    `${m}.push(${JSON.stringify(x.ing)});`
                ),
            ]
        case OpCodes.SERVE_WITH:
            return [
                `${this.func(x.recipe)}();`
            ]
        default:
            throw new Error(`Op code ${x.op} not supported yet`);
        }
    }
    gen_predicate(x, inner) {
        // `x` is predicate (an Object with an `op` attribute)
        // `inner` is code to execute if `x` is true (a string)
        switch (x.op) {
        case PredicateKind.MOLD_IS_EMPTY:
            return [
                this.acquire_mold(x.mold, (m) =>
                    `if (!${m}.length) {${inner}}`
                ),
            ]
        case PredicateKind.MOLD_NOT_EMPTY:
            return [
                this.acquire_mold(x.mold, (m) =>
                    `if (${m}.length) {${inner}}`
                ),
            ]
        case PredicateKind.BOWL_IS_EMPTY:
            return [
                this.acquire_bowl(x.bowl, (m) => `if (!${m}) {${inner}}`),
            ]
        case PredicateKind.BOWL_NOT_EMPTY:
            return [
                this.acquire_bowl(x.bowl, (m) => `if (${m}) {${inner}}`),
            ]
        default:
            throw new Error(`Predicate code ${x.op} not supported yet`);
        }
    }
}

function code_gen(program) {
    return new CodeGenerator(program).main();
}

const prog = parse(tokenize(
`
Muffin recipe
ingredients
    "Hello, world!" brand Flour
method
    1. set up a Muffin Cup
    2. add Flour into Muffin Cup
    3. microwave Muffin Cup
    4. serves 1
`
));
console.dir(prog, {depth: null});
console.log(code_gen(prog));