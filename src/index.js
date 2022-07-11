const fs = require("fs");
const YAML = require("yaml");

const compile = ({ root, rules, lexerTokens }, options) => {
  return (tokens) => {
    const result = parseFromContext(
      null,
      root,
      rules,
      0,
      tokens,
      lexerTokens,
      options,
      root
    );

    if (result.found && result.currentTokenIdx < tokens.length - 1) {
      return {
        ...result,
        found: false,
        code: "file-not-fully-parsed",
        tokensCount: tokens.length,
        tokensToCount: tokens.slice(0, result.currentTokenIdx + 1),
      };
    }

    if (typeof options.normalizer !== "undefined") {
      return {
        ...result,
        result: options.normalizer(result.result),
        tokensCount: tokens.length,
      };
    } else {
      return {
        ...result,
        tokensCount: tokens.length,
      };
    }
  };
};

const compileFromFile = (file, options) => {
  const f = fs.readFileSync(file, "utf8");

  return compile(YAML.parse(f), options);
};

const parseFromContext = (
  currentRule,
  currentContext,
  rules,
  currentTokenIdx,
  tokens,
  lexerTokens,
  options,
  contextHierarchy
) => {
  const rulesForContext = getRulesForContext(currentContext, rules);

  // console.log(
  //   "parseFromContext",
  //   contextHierarchy,
  //   tokens[currentTokenIdx].type,
  //   currentTokenIdx
  // );

  if (rulesForContext.length == 0) {
    if (!currentRule) {
      // We cannot have a lexer token as the root of the rules
      throw new Error(
        `The root must be a rule. I found a lexerToken ${currentContext}`
      );
    }

    // It should be a lexer token then. But first we check if we specified an attribute
    // with the lexer token
    if (lexerTokens.includes(currentContext)) {
      // If we reached the end of the tokens, then, this is not good
      if (currentTokenIdx >= tokens.length) {
        return {
          found: false,
          code: "end-of-tokens",
          rule: currentRule,
          currentTokenIdx,
          contextHierarchy,
        };
      }

      // We check if the next token is the one expected
      if (tokens[currentTokenIdx].type == currentContext) {
        if (typeof currentRule.value === "undefined") {
          throw new Error(
            `Missing value attribute in rule ${currentRule.type}`
          );
        }

        // console.log(
        //   "MATCH",
        //   contextHierarchy,
        //   tokens[currentTokenIdx].type,
        //   currentTokenIdx
        // );

        return {
          found: true,
          currentTokenIdx: currentTokenIdx + 1,
          result: tokens[currentTokenIdx],
        };
      } else {
        return {
          found: false,
          code: "token-not-matching",
          rule: currentRule,
          context: currentContext,
          currentTokenIdx,
          contextHierarchy,
        };
      }
    } else {
      throw new Error(`Unknown rule or token ${currentContext}`);
    }
  } else {
    for (let i = 0; i < rulesForContext.length; i++) {
      // We parse deeper, trying all rules
      const result = parseFromRule(
        rulesForContext[i],
        rules,
        currentTokenIdx,
        tokens,
        lexerTokens,
        options,
        contextHierarchy
      );

      if (result.found) {
        return result;
      }
    }

    return {
      found: false,
      code: "no-rule-matching",
      rule: currentRule,
      currentTokenIdx,
      contextHierarchy,
    };
  }
};

const parseFromRule = (
  currentRule,
  rules,
  currentTokenIdx,
  tokens,
  lexerTokens,
  options,
  contextHierarchy
) => {
  const initialTokenIdx = currentTokenIdx;
  if (!currentRule.expression) {
    throw new Error(`Missing expression attribute in rule ${currentRule.type}`);
  }
  const results = [];
  // We go through the expression
  for (let i = 0; i < currentRule.expression.length; i++) {
    // We parse deeper, trying all rules
    const result = parseFromContext(
      currentRule,
      currentRule.expression[i],
      rules,
      currentTokenIdx,
      tokens,
      lexerTokens,
      options,
      `${contextHierarchy}.${currentRule.expression[i]}`
    );

    if (!result.found) {
      return {
        found: false,
        code: "expression-not-matching",
        rule: currentRule,
        expression: currentRule.expression[i],
        currentTokenIdx: initialTokenIdx,
        contextHierarchy,
      };
    } else {
      currentTokenIdx = result.currentTokenIdx;
      results.push(result.result);
    }
  }

  const result = transformRuleValues(results, currentRule.value);

  if (currentRule.valid) {
    if (
      typeof (options?.validations || {})[currentRule.valid] !== "undefined"
    ) {
      const r = options.validations[currentRule.valid](
        result,
        results,
        currentRule
      );
      if (r.success) {
        // console.log("MATCH after validation", contextHierarchy);
        return {
          found: true,
          currentTokenIdx: currentTokenIdx,
          result,
        };
      } else {
        return {
          found: false,
          code: "validation-func-returns-false",
          error: r.error,
          rule: currentRule,
          currentTokenIdx: initialTokenIdx,
          contextHierarchy,
        };
      }
    } else {
      throw new Error(
        `Validation function ${currentRule.valid}, not found in options`
      );
    }
  } else {
    // console.log("MATCH after expression", contextHierarchy);
    return {
      found: true,
      currentTokenIdx: currentTokenIdx,
      result,
    };
  }
};

const getRulesForContext = (context, rules) =>
  rules.filter(({ type }) => type == context);

const transformRuleValues = (results, value) =>
  extractVariablesInJson(value, results);

const extractVariablesInJson = (obj, results) => {
  if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        k,
        extractVariablesInJson(v, results),
      ])
    );
  } else if (Array.isArray(obj)) {
    return obj.map((o) => extractVariablesInJson(o, results));
  } else if (typeof obj === "string") {
    return isVariable(obj) ? resolveVar(obj, results) : obj;
  } else {
    return obj;
  }
};

const isVariable = (v) => /\$[0-9]+(\.[a-zA-Z0-9]+)?/.test(v);

const resolveVar = (v, results) => {
  const varMatches = v.match(/\$[0-9]+(\.[a-zA-Z0-9]+)?/g);
  const matches = varMatches.map((match) => {
    const vars = match.match(/^\$([0-9]+)(\.([a-zA-Z0-9]+))?$/);
    const idx = parseInt(vars[1]) - 1;
    const attr = vars[3];
    const result = results[idx];
    if (attr) {
      return result.data[attr];
    } else if (typeof result.data !== "undefined") {
      return result.data.value;
    } else {
      return result;
    }
  });
  // If all values are strings, we insert them
  if (matches.every((val) => typeof val === "string")) {
    return varMatches.reduce(
      (finalResult, varMatch, index) =>
        finalResult.replace(varMatch, matches[index]),
      v
    );
  } else {
    // If all values are not strings, we return them as an array (except if there is only 1 object)
    return matches.length > 1 ? matches : matches[0];
  }
};

module.exports = { compile, compileFromFile };
