# universal-parser

Universal parser must be used with [universal-lexer](https://github.com/rangoo94/universal-lexer), to parse any kind of code to an AST ([Abstract Syntax Tree](https://en.wikipedia.org/wiki/Abstract_syntax_tree)).

While [universal-lexer](https://github.com/rangoo94/universal-lexer) will tokenize the code, universal-parser will follow the rules you defined to transform these tokens to an AST.

## Install

```
npm install universal-parser
```

## Usage

```js
const UniversalLexer = require("universal-lexer");
const UniversalParser = require("universal-parser");

// Compile the lexer and the parser
const templateLexer = UniversalLexer.compileFromFile(
  "./lexers/html.yaml",
  true
);
const templateParser = UniversalParser.compileFromFile("./parsers/html.yaml");

// First, tokenize the code with universal-lexer
const tokens = templateLexer(code);

// Then, get an AST pf your code with universal-parser
const ast = templateParser(tokens.tokens);
```

### The rules

```yaml
root: Node
lexerTokens:
  - TagEnd
  - SingleTagEnd
  - StartTagName
  - EndTagName
  - Attribute
  - NewLine
  - Space
  - String
rules:
  - type: Node
    expression:
      - StartTagName
      - SpaceOrNewLineOrNothing
      - TagEnd
      - EndTagName
      - TagEnd
    value: { type: "node", tag: "$1" }
    valid: checkCurrentEndTag

  - type: SpaceOrNewLine
    expression:
      - Space
      - SpaceOrNewLineOrNothing
    value: "$1$2"

  - type: SpaceOrNewLine
    expression:
      - NewLine
      - SpaceOrNewLineOrNothing
    value: "$1$2"

  - type: SpaceOrNewLineOrNothing
    expression:
      - SpaceOrNewLine
    value: "$1"

  - type: SpaceOrNewLineOrNothing
    expression: []
    value: ""
```

- `root`: This is the name (aka `type` in the rules) of the rule to start with
- `lexerTokens`: This is the list of tokens defined in the lexer. This way, in your rule expressions we can determine if the name corresponds to another rule or to a token from the lexer
- `rules`: The list of rules (the order is important):
  - `type`: The name of the rule. Used to refer to the rule. Several rules can have the same name. In this case that means that a rule can be defined in different ways
  - `expression`: The list of rules and tokens that composes this rule. A rule is matched only if all items of the expression are matched
  - `value`: The AST to return when the rule matches. This can be any valid JSON. Strings like `"$1"`, `"$2"`, ... `"$n"` will be replace by the value of the rule of token in the expression that corresponds (**We start with 1, not 0**) You are allowed to provide values like `"My complex value $1 with $2.global"`. If the result values are strings they will be inserted in this value. If all values are not strings, an array with the results will be returned. In [universal-lexer](https://github.com/rangoo94/universal-lexer) you can customize how you build your tokens like this: `regex: '(?<global>((?<name>([a-zA-Z_-]+))="(?<value>([^"]+))"))'`. Which means your token will have 3 values defined in the properties: `global`, `name` and `value`. Thus, in universal-parser you can write `$1.global` which will look for the `global` property of your token (example: `value: {name: "$1.name", value: "$1.value"}`). By default, we look for the `value` property (which is also the default for [universal-lexer](https://github.com/rangoo94/universal-lexer))
  - `valid`: (_optional_) Defines the name of a function you will pass with the options to the `compile` function and that will check the validity of the rule after it has been parsed. (This is usefull if you want to check some values after the parsing of the rule)

### Functions

- `compile`: Returns a function that you must call with the tokens returned by the lexer. Parameters:
  - `rules`: The rules to use for parsing
  - `options`: (_optional_) Options
- `compileFromFile`: Returns a function that you must call with the tokens returned by the lexer. Parameters:
  - `file`: The file containing the rules to use for parsing
  - `options`: (_optional_) Options

The return value of the `compile` function is an object like this:

```js
{
  // Success or not
  found: true | false,
  // The reesult structure, constructed from your rules
  result: { type: "node", tag: "div"},
  // Error codes
  code: "file-not-fully-parsed" | "end-of-tokens" | "token-not-matching" | "no-rule-matching" | "expression-not-matching" | "validation-func-returns-false",
  // Total number of tokens
  tokensCount: 234,
  // The list of tokens parsed
  tokensToCount: [
    {
      "type": "StartTagName",
      "data": {
        "global": "<div",
        "value": "div"
      },
      "start": 0,
      "end": 4
    },
    {
      "type": "NewLine",
      "data": {
        "value": "\n"
      },
      "start": 4,
      "end": 5
    }
  ],
  // The current rule where parsing stopped
  rule: "StartTagName",
  // The current context where parsing stopped
  context: currentContext,
  // The current expression where parsing stopped
  expression: "Node",
  // Index of the last parsed token
  currentTokenIdx: 234,
  // The current hierarchy
  contextHierarchy: "Node.StartTagName"
}
```

### Options

- `validations`: (_optional_) An object in which you will define all the functions you defined in the `valid` attribute of your rules. The function must return an object with a `success` boolean field indicating if the rule should succeed or not and eventually an `error` string field explaining why it failed. It will receive the following parameters:
  - `value`: The computed value from the rule (following your `value` attribute for the rule)
  - `results`: An array with results of all the items of the expression of your rule
  - `rule`: Your rule definition
- `normalizer`: (_optional_) A function that allows you to normalize your final AST just before the parser function returns. The function must return the new AST, and will receive the following parameter:
  - `ast`: The AST computed by the parser

## Examples

See the `examples` folder.
