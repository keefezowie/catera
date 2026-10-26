// @vitest-environment jsdom
import { expect, it } from "vitest";
import { typing } from "../apps/web/src/components/command-menu";

it("shortcuts stand down while focus is in a field", () => {
  document.body.innerHTML =
    '<input id="a"><textarea id="b"></textarea><select id="c"></select>' +
    '<div contenteditable="true"><span id="d">x</span></div><button id="e"></button>';
  const at = (id: string) => document.getElementById(id);
  expect(typing(at("a"))).toBe(true);
  expect(typing(at("b"))).toBe(true);
  expect(typing(at("c"))).toBe(true);
  expect(typing(at("d"))).toBe(true);
  expect(typing(at("e"))).toBe(false);
  expect(typing(document.body)).toBe(false);
  expect(typing(null)).toBe(false);
});
