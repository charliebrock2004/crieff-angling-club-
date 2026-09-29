// Usage: node scripts/screenshot.mjs <path> <outfile> [width] [fullPage]
import { chromium } from "playwright";
const [path = "/", out = "shot.png", width = "1440", full = "0"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(width) < 600 ? 844 : 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(`http://localhost:3000${path}`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: out, fullPage: full === "1" });
if (errors.length) console.log("ERRORS:", errors.join("\n"));
await browser.close();
