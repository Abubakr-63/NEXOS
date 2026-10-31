import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  type Locale,
} from "../apps/web/lib/i18n/types";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatTime,
} from "../apps/web/lib/i18n/formatters";
import { interpolate } from "../apps/web/lib/i18n/context";

const MESSAGES_DIR = path.resolve(__dirname, "../apps/web/messages");

function loadJson(locale: string): Record<string, unknown> {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
  assert.ok(fs.existsSync(filePath), `Dictionary file missing: ${filePath}`);
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content);
}

function flattenKeys(
  obj: Record<string, unknown>,
  prefix = "",
): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === "string") {
          result.set(`${fullPath}.${index}`, item);
        } else if (item && typeof item === "object") {
          const nested = flattenKeys(
            item as Record<string, unknown>,
            `${fullPath}.${index}`,
          );
          for (const [nestedPath, nestedVal] of nested.entries()) {
            result.set(nestedPath, nestedVal);
          }
        }
      });
    } else if (value && typeof value === "object") {
      const nested = flattenKeys(value as Record<string, unknown>, fullPath);
      for (const [nestedPath, nestedVal] of nested.entries()) {
        result.set(nestedPath, nestedVal);
      }
    } else if (typeof value === "string") {
      result.set(fullPath, value);
    } else {
      throw new Error(
        `Unexpected non-string leaf value at ${fullPath}: ${typeof value}`,
      );
    }
  }
  return result;
}

function extractParams(template: string): Set<string> {
  const params = new Set<string>();
  const regex = /\{([a-zA-Z0-9_]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(template)) !== null) {
    params.add(match[1]);
  }
  return params;
}

test("i18n: supported locales list is exact [en, ru, tg]", () => {
  assert.deepEqual([...SUPPORTED_LOCALES], ["en", "ru", "tg"]);
  assert.equal(DEFAULT_LOCALE, "en");
  assert.equal(isSupportedLocale("en"), true);
  assert.equal(isSupportedLocale("ru"), true);
  assert.equal(isSupportedLocale("tg"), true);
  assert.equal(isSupportedLocale("fr"), false);
  assert.equal(isSupportedLocale(""), false);
});

test("i18n: dictionaries exist and have 100% key parity across en, ru, and tg", () => {
  const enDict = loadJson("en");
  const ruDict = loadJson("ru");
  const tgDict = loadJson("tg");

  const enKeys = flattenKeys(enDict);
  const ruKeys = flattenKeys(ruDict);
  const tgKeys = flattenKeys(tgDict);

  assert.ok(
    enKeys.size > 80,
    `Expected substantial dictionary size, got ${enKeys.size} keys`,
  );

  const missingInRu = [...enKeys.keys()].filter((k) => !ruKeys.has(k));
  const missingInTg = [...enKeys.keys()].filter((k) => !tgKeys.has(k));
  const extraInRu = [...ruKeys.keys()].filter((k) => !enKeys.has(k));
  const extraInTg = [...tgKeys.keys()].filter((k) => !enKeys.has(k));

  assert.deepEqual(
    missingInRu,
    [],
    `Keys present in en.json but missing in ru.json: ${missingInRu.join(", ")}`,
  );
  assert.deepEqual(
    missingInTg,
    [],
    `Keys present in en.json but missing in tg.json: ${missingInTg.join(", ")}`,
  );
  assert.deepEqual(
    extraInRu,
    [],
    `Keys present in ru.json but missing in en.json: ${extraInRu.join(", ")}`,
  );
  assert.deepEqual(
    extraInTg,
    [],
    `Keys present in tg.json but missing in en.json: ${extraInTg.join(", ")}`,
  );
  assert.equal(
    enKeys.size,
    ruKeys.size,
    `Total key count mismatch between EN (${enKeys.size}) and RU (${ruKeys.size})`,
  );
  assert.equal(
    enKeys.size,
    tgKeys.size,
    `Total key count mismatch between EN (${enKeys.size}) and TG (${tgKeys.size})`,
  );
});

test("i18n: no translation strings are empty or whitespace-only", () => {
  for (const locale of SUPPORTED_LOCALES) {
    const dict = loadJson(locale);
    const keys = flattenKeys(dict);
    for (const [key, val] of keys.entries()) {
      assert.ok(
        val.trim().length > 0,
        `Empty or whitespace string found in ${locale}.json at "${key}"`,
      );
    }
  }
});

test("i18n: variable placeholders {param} match identically across all locales", () => {
  const enKeys = flattenKeys(loadJson("en"));
  const ruKeys = flattenKeys(loadJson("ru"));
  const tgKeys = flattenKeys(loadJson("tg"));

  for (const [key, enValue] of enKeys.entries()) {
    const enParams = extractParams(enValue);
    if (enParams.size === 0) continue;

    const ruValue = ruKeys.get(key) ?? "";
    const tgValue = tgKeys.get(key) ?? "";

    const ruParams = extractParams(ruValue);
    const tgParams = extractParams(tgValue);

    for (const param of enParams) {
      assert.ok(
        ruParams.has(param),
        `Placeholder {${param}} in key "${key}" missing in ru.json ("${ruValue}")`,
      );
      assert.ok(
        tgParams.has(param),
        `Placeholder {${param}} in key "${key}" missing in tg.json ("${tgValue}")`,
      );
    }
  }
});

test("i18n: Tajik Cyrillic distinct letters (ҷ, ҳ, қ, ӯ, ғ, ӣ) are present", () => {
  const tgDict = loadJson("tg");
  const tgText = JSON.stringify(tgDict);

  const tajikSpecificChars = ["ҷ", "ҳ", "қ", "ӯ", "ғ", "ӣ"];
  for (const char of tajikSpecificChars) {
    const found = tgText.includes(char) || tgText.includes(char.toUpperCase());
    assert.ok(
      found,
      `Expected standard Tajik character '${char}' to be present in tg.json`,
    );
  }
});

test("i18n: ICU interpolation formats plurals and placeholders correctly", () => {
  const single = interpolate(
    "{count, plural, =1 {# project} other {# projects}}",
    { count: 1 },
    "en",
  );
  assert.equal(single, "1 project");

  const plural = interpolate(
    "{count, plural, =1 {# project} other {# projects}}",
    { count: 5 },
    "en",
  );
  assert.equal(plural, "5 projects");

  const custom = interpolate(
    "Hello {username}, you have {count, plural, =1 {# update} other {# updates}}.",
    { username: "Alice", count: 3 },
    "en",
  );
  assert.equal(custom, "Hello Alice, you have 3 updates.");

  const fallback = interpolate("Draft {id} revision {rev}", { id: "p1", rev: 2 });
  assert.equal(fallback, "Draft p1 revision 2");
});

test("i18n: formatters handle locale-sensitive numbers and dates consistently", () => {
  const testDate = new Date("2026-10-31T12:00:00Z");

  const enDate = formatDate(testDate, "en");
  const ruDate = formatDate(testDate, "ru");
  const tgDate = formatDate(testDate, "tg");

  assert.ok(typeof enDate === "string" && enDate.length > 0);
  assert.ok(typeof ruDate === "string" && ruDate.length > 0);
  assert.ok(typeof tgDate === "string" && tgDate.length > 0);

  const enNum = formatNumber(12500.5, "en");
  const ruNum = formatNumber(12500.5, "ru");
  const tgNum = formatNumber(12500.5, "tg");

  assert.ok(enNum.includes("12,500.5") || enNum.includes("12500.5"));
  assert.ok(typeof ruNum === "string" && ruNum.length > 0);
  assert.ok(typeof tgNum === "string" && tgNum.length > 0);

  const enTime = formatTime(testDate, "en");
  assert.ok(typeof enTime === "string" && enTime.length > 0);

  const dt = formatDateTime(testDate, "tg");
  assert.ok(typeof dt === "string" && dt.length > 0);
});
