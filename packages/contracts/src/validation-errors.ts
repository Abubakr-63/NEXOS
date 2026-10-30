import type { $ZodErrorMap } from "zod/v4/core";

// Preserve the application contract, not Zod's process-global locale. These
// options are attached only to NEXOS schemas/checks; other consumers are untouched.
export const validationErrors: { error: $ZodErrorMap } = {
  error: (issue) => {
    const input = issue.input;
    const received =
      input === null
        ? "null"
        : Array.isArray(input)
          ? "array"
          : input instanceof Date
            ? "date"
            : typeof input === "number" && Number.isNaN(input)
              ? "nan"
              : typeof input;
    switch (issue.code) {
      case "invalid_type":
        if (input === undefined) return "Required";
        if (
          typeof input === "number" &&
          !Number.isFinite(input) &&
          !Number.isNaN(input)
        )
          return "Expected integer, received float";
        return `Expected ${issue.expected}, received ${received}`;
      case "invalid_value": {
        if (issue.values.length === 1)
          return `Invalid literal value, expected ${JSON.stringify(issue.values[0])}`;
        const expected = issue.values
          .map((value) => `'${String(value)}'`)
          .join(" | ");
        if (input === undefined) return "Required";
        return typeof input === "string"
          ? `Invalid enum value. Expected ${expected}, received '${input}'`
          : `Expected ${expected}, received ${received}`;
      }
      case "invalid_format":
        return "Invalid";
      case "too_small":
      case "too_big": {
        const small = issue.code === "too_small";
        const bound = small ? issue.minimum : issue.maximum;
        if (issue.origin === "string")
          return `String must contain at ${small ? "least" : "most"} ${bound} character(s)`;
        if (issue.origin === "array")
          return `Array must contain at ${small ? "least" : "most"} ${bound} element(s)`;
        if (issue.origin === "number")
          return `Number must be ${small ? "greater" : "less"} than or equal to ${bound}`;
        return undefined;
      }
      case "unrecognized_keys":
        return `Unrecognized key(s) in object: ${issue.keys.map((key) => `'${key}'`).join(", ")}`;
      default:
        return undefined;
    }
  },
};

// Exact prior Zod 3.25.76 pattern: changing identifier acceptance during the
// security upgrade would affect existing accounts and HMAC normalization.
export const loginEmailPattern =
  /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
