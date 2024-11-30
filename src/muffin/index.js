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

class Temperature {
    constructor(scale, value) {
        this.scale = scale;  // 'C' or 'F'
        this.value = value;
    }
}

class Token {
    constructor(kind, loc, value=null) {
        this.kind = kind;
        this.value = value;
        this.loc = loc;
    }
};

class CompileError {
    constructor(message, line_no, col_no) {
        this.message = message;
        this.line_no = line_no;
        this.col_no = col_no;
    }
    format() {
        return `${this.line_no}:${this.col_no}: ${this.message}`;
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
            message, this.line_no,
            col_no == null ? this.col_no : col_no
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
                        new Temperature(suffix_match, number)
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
        this.steps = [];  // Objects with the `op` attribute
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
        this.content = content;
        this.predicate = predicate;  // Object with an `op` attribute
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
        throw new CompileError(message, token.loc[0], token.loc[1]);
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
                const value = this.int_ingredient();
                this.expect_keyword("into");
                const [kind, ob] = this.bowl_or_mold();
                ret = kind == "bowl" ?
                    {op: OpCodes.ADD_ING_TO_BOWL, bowl: ob}
                    : {op: OpCodes.MOLD_PUSH_ING, mold: ob};
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
                const temp = this.expect(TokenKind.TEMPERATURE);
                // TODO verify temperature is valid
                ret = {op: OpCodes.BAKE, bowl: bowl, temperature: temp.value};
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
            // TODO
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

const prog = parse(tokenize(
`
Muffin recipe
ingredients
    1 Blueberry
    20 grams of Butter
method
    1. set up 4 Bowls
    2. add Blueberry into 3rd Bowl
    3. add water to 1st Bowl at a 1:1 ratio
    4. pour half of contents of 1st Bowl into 4th Bowl
    5. remove Butter from 4th Bowl
    6. if 4th Bowl is empty, proceed to step 15
    7. place 3rd Bowl in the oven and bake at 190C
    8. clean 4th Bowl
    9. pour contents of 2nd Bowl into 4th Bowl
    10. add water to 3rd Bowl at a 1:1 ratio
    11. pour half of contents of 3rd Bowl into 2nd Bowl
    12. pour contents of 4th Bowl into 3rd Bowl
    13. add Blueberry into 1st Bowl
    14. go back to step 3
    15. serves 1
`
));
console.dir(prog, {depth: null});
