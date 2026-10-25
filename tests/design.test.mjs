import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const luminance = (hex) => {
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  const c = full
    .match(/[a-f\d]{2}/gi)
    .map((x) => parseInt(x, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
};
const roots = [...css.matchAll(/:root\s*\{([^}]+)\}/g)].map((match) =>
  Object.fromEntries(
    [...match[1].matchAll(/--([\w-]+):\s*#([a-f\d]+);/gi)].map((m) => [
      m[1],
      m[2],
    ]),
  ),
);
for (const [index, appearance] of ["light", "dark"].entries()) {
  const tokens = { ...roots[0], ...roots[index] };
  for (const [foreground, background] of [
    ["ink", "surface"],
    ["muted", "surface"],
    ["muted", "canvas"],
    ["on-accent", "accent"],
    ["danger", "surface"],
    ["positive", "surface"],
  ]) {
    test(`${appearance} ${foreground} on ${background} contrast ≥4.5:1`, () => {
      assert.ok(tokens[foreground] && tokens[background]);
      const a = luminance(tokens[foreground]),
        b = luminance(tokens[background]);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      assert.ok(ratio >= 4.5, `${ratio.toFixed(2)}:1`);
    });
  }
}
