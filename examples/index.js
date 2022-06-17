const UniversalLexer = require("universal-lexer");
const UniversalParser = require("../src/index");
const fs = require("fs");

const parse = () => {
  const template = fs.readFileSync("./test.html", "utf8");
  const templateLexer = UniversalLexer.compileFromFile(
    "./html-lexer.yaml",
    true
  );
  const templateParser = UniversalParser.compileFromFile("./html-parser.yaml", {
    validations: {
      checkCurrentEndTag: (result, results) =>
        result.tag == results[6].data.value,
      checkValidAttributeName: (result) => /^[a-zA-Z0-9_]+$/.test(result.name),
    },
  });
  const tokens = templateLexer(template);

  return templateParser(tokens.tokens);
};

console.log(JSON.stringify(parse(), null, 2));
