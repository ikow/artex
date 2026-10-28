const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const src = path.resolve(__dirname, "../src");

// Use the project's existing compiler, without adding a test runtime/dependency.
// Alias resolution is confined to these temporary CommonJS test modules.
require.extensions[".ts"] = (module, filename) => {
  const originalRequire = module.require.bind(module);
  module.require = (specifier) => originalRequire(
    specifier.startsWith("@/") ? path.join(src, specifier.slice(2)) : specifier,
  );
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  module._compile(output.outputText, filename);
};

const { english, chinese } = require("../src/lib/i18n/catalog.ts");
const { resolveLocale, isLocale, setLocale, getLocale, subscribeLocale, translate, t } =
  require("../src/lib/i18n/core.ts");
const { statusMeta } = require("../src/lib/status.ts");
const placeholders = (value) => (value.match(/\{\d+\}/g) ?? []).sort();

test.afterEach(() => setLocale("en"));

test("explicit language wins; supported browser language and English fallback are deterministic", () => {
  assert.equal(resolveLocale("en", ["zh-CN"]), "en");
  assert.equal(resolveLocale("zh-CN", ["en-US"]), "zh-CN");
  assert.equal(resolveLocale(undefined, ["zh-HK", "en"]), "zh-CN");
  assert.equal(resolveLocale("invalid", ["fr-FR", "en-GB"]), "en");
  assert.equal(resolveLocale(undefined, ["fr-FR", "de"]), "en");
  assert.equal(resolveLocale(undefined, []), "en");
  assert.equal(isLocale("zh-CN"), true);
  for (const value of ["en-GB", "constructor", null, undefined, {}, ""]) assert.equal(isLocale(value), false);
});

test("selection notifies subscribers once and rejects unsupported values", () => {
  setLocale("en");
  const seen = [];
  const unsubscribe = subscribeLocale(() => seen.push(getLocale()));
  setLocale("zh-CN");
  setLocale("zh-CN");
  setLocale("invalid");
  setLocale("en");
  unsubscribe();
  setLocale("zh-CN");
  assert.deepEqual(seen, ["zh-CN", "en"]);
});

test("both catalogs cover the same keys, preserve Chinese, and retain every interpolation", () => {
  assert.deepEqual(Object.keys(english).sort(), Object.keys(chinese).sort());
  for (const [key, translated] of Object.entries(english)) {
    assert.ok(translated.trim(), `Empty translation: ${key}`);
    assert.equal(chinese[key], key.split("\u0004").at(-1));
    assert.deepEqual(placeholders(translated), placeholders(chinese[key]), key);
    assert.equal(/\p{Script=Han}/u.test(translated), false, `Untranslated English message: ${key}`);
  }
});

test("unknown keys are readable and prototype properties are not messages", () => {
  assert.equal(translate("en", "unregistered.message"), "unregistered.message");
  assert.equal(translate("zh-CN", "unregistered.message"), "unregistered.message");
  assert.equal(translate("en", "constructor"), "constructor");
  assert.equal(translate("en", "__proto__"), "__proto__");
  assert.equal(translate("en", "确认删除任务 #{0}？"), "Confirm deletion of task #{0}?");
});

test("interpolated user content is neither translated nor interpreted as replacement syntax", () => {
  for (const value of ["中文任务", "$&", "{0}", "<img src=x onerror=alert(1)>", "GPT model / 工具"]) {
    assert.equal(translate("en", "确认删除任务 #{0}？", [value]), `Confirm deletion of task #${value}?`);
    assert.equal(translate("zh-CN", "确认删除任务 #{0}？", [value]), `确认删除任务 #${value}？`);
  }
  assert.equal(translate("en", "确认删除任务 #{0}？", [0]), "Confirm deletion of task #0?");
});

test("context disambiguates a setting being off from closing a dialog", () => {
  assert.equal(translate("en", "关闭"), "Close");
  assert.equal(translate("en", "关闭", [], "toggle"), "Off");
  assert.equal(translate("zh-CN", "关闭", [], "toggle"), "关闭");
});

test("imported status metadata follows language changes without changing identifiers or severity", () => {
  setLocale("en");
  const paused = statusMeta("task", "paused");
  const critical = statusMeta("severity", "critical");
  const tone = paused.tone;
  assert.equal(paused.label, "Paused");
  assert.equal(critical.label, "Critical");
  setLocale("zh-CN");
  assert.equal(paused.label, "已暂停");
  assert.equal(critical.label, "严重");
  assert.equal(statusMeta("task", "paused").tone, tone);
  assert.equal(statusMeta("task", "future-status").label, "future-status");
  assert.equal(t("取消"), "取消");
  setLocale("en");
  assert.equal(t("取消"), "Cancel");
});

test("all explicit source messages and interpolations have catalog entries", () => {
  const failures = [];
  function check(file, node, key, values, context) {
    const id = context ? `${context}\u0004${key}` : key;
    if (!Object.hasOwn(english, id)) failures.push(`${file}: missing ${JSON.stringify(id)}`);
    if (values && ts.isArrayLiteralExpression(values)) {
      for (const placeholder of placeholders(key)) {
        const index = Number(placeholder.slice(1, -1));
        if (index >= values.elements.length) failures.push(`${file}: missing value ${placeholder} in ${key}`);
      }
    }
  }
  function visitDirectory(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!["i18n", "mock"].includes(entry.name)) visitDirectory(file);
        continue;
      }
      if (!/\.tsx?$/.test(file)) continue;
      const sf = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
      function visit(node) {
        if (ts.isCallExpression(node)) {
          const name = node.expression.getText(sf);
          const messageIndex = name === "translate" || name === "sdkTool" ? 1 : 0;
          const key = node.arguments[messageIndex];
          if (["uiText", "translate", "sdkTool", "setError"].includes(name) && key && ts.isStringLiteral(key) && /\p{Script=Han}/u.test(key.text)) {
            const context = node.arguments[messageIndex + 2];
            check(file, node, key.text, node.arguments[messageIndex + 1], context && ts.isStringLiteral(context) ? context.text : undefined);
          }
        }
        if (ts.isJsxAttribute(node) && node.name.getText(sf) === "message" && node.initializer && ts.isStringLiteral(node.initializer)) {
          check(file, node, node.initializer.text);
        }
        ts.forEachChild(node, visit);
      }
      visit(sf);
    }
  }
  visitDirectory(src);
  assert.deepEqual(failures, []);
});
