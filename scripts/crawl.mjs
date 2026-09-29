// Visits routes in Chromium (optionally as a test user); reports non-200s and client errors.
import { chromium } from "playwright";
const base = "http://localhost:3000";
const routes = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext();
if (process.env.AS) await ctx.addCookies([{ name: "e2e_user", value: process.env.AS, url: base }]);
const page = await ctx.newPage();
let bad = 0;
for (const r of routes) {
  const errors = [];
  const onErr = (e) => errors.push(e.message);
  const onConsole = (m) => m.type() === "error" && !/openstreetmap|ERR_TUNNEL|Failed to load resource/.test(m.text()) && errors.push(m.text());
  page.on("pageerror", onErr);
  page.on("console", onConsole);
  const res = await page.goto(base + r, { waitUntil: "domcontentloaded", timeout: 90000 }).catch((e) => ({ status: () => "ERR " + e.message }));
  await page.waitForTimeout(300);
  const status = res.status();
  if (status !== 200 || errors.length) { bad++; console.log(`✗ ${status} ${r}\n   ${errors.join("\n   ").slice(0, 600)}`); } else console.log(`✓ ${r}`);
  page.off("pageerror", onErr); page.off("console", onConsole);
}
await browser.close();
process.exit(bad ? 1 : 0);
