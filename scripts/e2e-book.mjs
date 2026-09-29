// Drives the booking wizard end-to-end in Chromium.
import { chromium } from "playwright";
const out = process.argv[2] ?? ".";
const width = Number(process.argv[3] ?? 1280);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:3000/book?beat=braidhaugh", { waitUntil: "networkidle" });
// pick first available date (may need next month)
let btn = page.locator('[role=gridcell]:not([disabled])').first();
if (!(await btn.count())) { await page.getByLabel("Next month").click(); await page.waitForTimeout(800); btn = page.locator('[role=gridcell]:not([disabled])').first(); }
const label = await btn.getAttribute("aria-label");
await btn.click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/book-step2.png`, fullPage: true });
// permit
const permitBtn = page.locator("#step-permit button:not([disabled])").first();
await permitBtn.click();
await page.waitForTimeout(300);
await page.fill("#anglers\\.0\\.firstName", "Angus");
await page.fill("#anglers\\.0\\.lastName", "Tester");
for (const [k, v] of Object.entries({ firstName: "Angus", lastName: "Tester", email: "angus@example.com", phone: "07700 900123", addressLine1: "1 High Street", town: "Crieff", postcode: "ph73aa" })) {
  await page.fill(`#contact\\.${k}`, v);
}
await page.locator("#step-rules input[type=checkbox]").check();
await page.screenshot({ path: `${out}/book-filled.png`, fullPage: true });
await page.locator("aside button[type=submit]:visible").first().click();
await page.waitForTimeout(2500);
const alert = await page.locator("[role=alert]").allTextContents();
console.log("date:", label, "\nalerts:", alert.join(" | "), "\nurl:", page.url(), "\nerrors:", errors.join("\n"));
await page.screenshot({ path: `${out}/book-result.png`, fullPage: false });
await browser.close();
