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
};

class Temperature {
    constructor(scale, value) {
        this.scale = scale;  // 'C' or 'F'
        this.value = value;
    }
}

class Token {
    constructor(kind, value=null) {
        this.kind = kind;
        this.value = value;
    }
};

class TokenizeError {
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
    'dilute contents of',
    'with an equal amount of water',
    'pour half of contents of',
    'remove',
    'from',
    'if',
    'is empty',
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
]);

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
        throw new TokenizeError(
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
                const match = number_result[0];
                this.advance2(match.length);
                const number = parseInt(match);
                // Check for suffixes
                const num_suffix = /\.|\w*/y;
                const num_suffix_result = this.regex_match(num_suffix);
                const suffix_match = num_suffix_result[0];
                if (suffix_match == '.') {
                    res.push(new Token(TokenKind.NUMBER_PERIOD, number));
                }
                else if (suffix_match == 'C' || suffix_match == 'F') {
                    res.push(new Token(
                        TokenKind.TEMPERATURE,
                        new Temperature(suffix_match, number)
                    ));
                }
                else if (ordinal_suffixes.includes(suffix_match)) {
                    // TODO make sure suffix is correct
                    res.push(new Token(TokenKind.ORDINAL, number));
                }
                else if (suffix_match.length == 0) {
                    res.push(new Token(TokenKind.NUMBER, number));
                }
                else {
                    this.complain(`unknown number suffix ${suffix_match}`);
                }
                this.advance2(suffix_match.length);
            }
            else if (word_result) {
                // Phrase
                const start_col = this.col_no;
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
                        res.push(new Token(TokenKind.KEY_PHRASE, phrase));
                    }
                    else {
                        this.complain(
                            `unknown key phrase "${phrase}"; identifiers must `
                            + `be Title Case`, start_col
                        );
                    }
                }
                else {
                    res.push(new Token(TokenKind.PHRASE, phrase));
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
                    TokenKind.STRING, this.str.slice(start_ptr, this.ptr - 1)
                ));
                this.advance();
            }
            else if (this.c == ',') {
                // Comma
                this.advance();
                res.push(new Token(TokenKind.COMMA));
            }
        }
        if (res.length != 0) {
            res.push(new Token(TokenKind.NEW_LINE));
        }
        if (this.c == '\n') {
            this.advance();
        }
        else {
            res.push(new Token(TokenKind.EOF));
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
