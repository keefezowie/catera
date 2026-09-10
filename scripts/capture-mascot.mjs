import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import sharp from "sharp";
const out = new URL("../output/mascot-motion/", import.meta.url);
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  headless: true,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 900 },
    reducedMotion: "no-preference",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:3000/dev/mascot");
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".mascot-animation")].every(
      (el) => el.dataset.ready === "true",
    ),
  );
  await page.screenshot({
    path: new URL("desktop.png", out).pathname.replace(/^\/([A-Z]:)/, "$1"),
    fullPage: true,
  });
  const tiles = [];
  for (const [pose, time] of [
    ["neutral", 0],
    ["half", 1130],
    ["closed", 1200],
  ]) {
    await page.locator(".mascot-animation").evaluateAll(
      (elements, t) =>
        elements.forEach((el) =>
          el.getAnimations({ subtree: true }).forEach((a) => {
            a.pause();
            a.currentTime = t;
          }),
        ),
      time,
    );
    for (let index = 0; index < 3; index++) {
      const buffer = await page
        .locator(".mascot-animation")
        .nth(index)
        .screenshot();
      const background = ["#FFF7E9", "#FFFFFF", "#163D2E"][index];
      const tile = await sharp({
        create: { width: 240, height: 240, channels: 4, background },
      })
        .composite([{ input: buffer, gravity: "center" }])
        .png()
        .toBuffer();
      tiles.push({
        input: tile,
        left: index * 240,
        top: (pose === "neutral" ? 0 : pose === "half" ? 1 : 2) * 240,
      });
    }
  }
  await sharp({
    create: { width: 720, height: 720, channels: 4, background: "#FFF7E9" },
  })
    .composite(tiles)
    .png()
    .toFile(new URL("poses.png", out).pathname.replace(/^\/([A-Z]:)/, "$1"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Mulai memuat", exact: true }).click();
  await page.locator(".mascot-loading-visual").waitFor({ state: "visible" });
  await page.screenshot({
    path: new URL("mobile-web.png", out).pathname.replace(/^\/([A-Z]:)/, "$1"),
    fullPage: true,
  });
  await fs.writeFile(
    new URL("browser.json", out),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        browser: await browser.version(),
        errors,
        viewports: ["1200x900", "390x844"],
        poses: ["neutral", "half", "closed"],
        nativeDeviceTested: false,
      },
      null,
      2,
    ),
  );
  if (errors.length) throw new Error(errors.join("\n"));
} finally {
  await browser.close();
}
