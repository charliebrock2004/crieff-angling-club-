// Functional end-to-end checks of admin + public workflows (local dev only).
import { chromium } from "playwright";
import postgres from "postgres";
const base = "http://localhost:3000";
const db = postgres(process.env.DATABASE_URL, { max: 1, types: { date: { to: 1082, from: [1082], serialize: (x) => x, parse: (x) => x } } });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const results = [];
const check = (name, ok, extra = "") => { results.push(ok); console.log(`${ok ? "✓" : "✗"} ${name}${extra ? ` — ${extra}` : ""}`); };
async function as(email) {
  const ctx = await browser.newContext();
  if (email) await ctx.addCookies([{ name: "e2e_user", value: email, url: base }]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("  pageerror:", e.message));
  return page;
}
const admin = await as("admin@example.com");
const anon = await as(null);
const nextWeekday = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() + 3); while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();
const [braid] = await db`select id from beats where slug = 'braidhaugh'`;
const [trout] = await db`select id from permit_types where slug = 'brown-trout-river'`;

// 1. Manual booking (brown trout season runs to 6 Oct; pick a date within it or use override)
await admin.goto(`${base}/admin/bookings/new?date=${nextWeekday}&beat=${braid.id}`);
await admin.selectOption("#permitTypeId", trout.id);
await admin.fill("#anglers", "Hamish Macbeth\nIsla Fraser");
await admin.fill("#firstName", "Hamish"); await admin.fill("#lastName", "Macbeth"); await admin.fill("#email", "hamish@example.com");
await admin.check("input[name=capacityOverride]"); // date may fall outside the trout season
await admin.click("button[type=submit]");
await admin.waitForURL(/\/admin\/bookings\/[0-9a-f-]{36}/, { timeout: 30000 }).catch(() => {});
const bookingUrl = admin.url();
check("manual booking created", /\/admin\/bookings\/[0-9a-f-]{36}/.test(bookingUrl), bookingUrl);
const bookingId = bookingUrl.match(/bookings\/([0-9a-f-]{36})/)?.[1];
const [bk] = bookingId ? await db`select status, quantity, total_pence from bookings where id = ${bookingId}` : [];
check("manual booking is paid with 2 permits", bk?.status === "paid" && bk?.quantity === 2, JSON.stringify(bk));

// 2. Permit verification: public sees initial only; bailiff sees full name
const [pm] = await db`select verification_code from permits where booking_id = ${bookingId} order by permit_number limit 1`;
await anon.goto(`${base}/permit/verify/${pm.verification_code}`);
const pubText = await anon.textContent("main");
check("public verification hides full name", pubText.includes("H. Macbeth") && !pubText.includes("Hamish Macbeth"));
const bailiff = await as("bailiff@example.com");
await bailiff.goto(`${base}/permit/verify/${pm.verification_code}`);
check("bailiff verification shows full name", (await bailiff.textContent("main")).includes("Hamish Macbeth"));
await bailiff.goto(`${base}/bailiff?date=${nextWeekday}`);
check("bailiff day list shows angler", (await bailiff.textContent("main")).includes("Isla Fraser"));

// 3. Cancel with refund (cash booking -> refund recorded)
await admin.goto(bookingUrl);
await admin.getByRole("button", { name: "Cancel booking" }).click();
await admin.fill("dialog[open] #reason", "River in flood");
await admin.locator("dialog[open] button[type=submit]").click();
await admin.waitForTimeout(2500);
const [bk2] = await db`select status, amount_refunded_pence, cancellation_reason from bookings where id = ${bookingId}`;
check("cancel + refund", bk2.status === "refunded" && bk2.amount_refunded_pence === bk.total_pence, JSON.stringify(bk2));
await anon.goto(`${base}/permit/verify/${pm.verification_code}`);
check("cancelled permit verifies as not valid", /REFUNDED|CANCELLED/.test(await anon.textContent("main")));

// 4. Block a date on Braidhaugh; public calendar reports it blocked
await admin.goto(`${base}/admin/availability`);
await admin.selectOption("#scope", `beat:${braid.id}`);
await admin.fill("#startDate", nextWeekday);
await admin.fill("#reason", "Test block"); await admin.fill("#publicNote", "Club match day");
await admin.getByRole("button", { name: "Add" }).click();
await admin.waitForTimeout(1500);
const cal = await (await fetch(`${base}/api/availability/calendar?month=${nextWeekday.slice(0, 7)}&beat=braidhaugh`)).json();
const day = cal.days.find((d) => d.date === nextWeekday);
check("blocked date shows as blocked publicly", day?.status === "blocked" || day?.status === "closed", JSON.stringify(day));
const [ov] = await db`select id from availability_overrides where reason = 'Test block'`;
check("block audited", (await db`select 1 from audit_logs where action = 'availability.block'`).length > 0);

// 5. Edit a price through the generic editor; public permits page reflects it
const [price] = await db`select pp.id from permit_prices pp join permit_types p on p.id = pp.permit_type_id where p.slug = 'brown-trout-river'`;
await admin.goto(`${base}/admin/permit-prices/${price.id}`);
await admin.fill("#price_pence", "8.50");
await admin.getByRole("button", { name: "Save changes" }).click();
await admin.waitForTimeout(1500);
const [p2] = await db`select price_pence from permit_prices where id = ${price.id}`;
check("price edited", p2.price_pence === 850);
await anon.goto(`${base}/permits`);
check("public permits page shows new price", (await anon.textContent("main")).includes("£8.50"));

// 6. Publish a news post
await admin.goto(`${base}/admin/news/new`);
await admin.fill("#title", "Autumn run arrives");
await admin.fill("#excerpt", "Fresh fish reported on the Drummond Castle water.");
await admin.fill("#body", "## Good news\n\nFish are **running**.");
await admin.selectOption("#status", "published");
await admin.getByRole("button", { name: /Create/ }).click();
await admin.waitForURL(/\/admin\/news\/[0-9a-f-]{36}/, { timeout: 20000 }).catch(() => {});
await anon.goto(`${base}/news/autumn-run-arrives`);
check("news post published", (await anon.textContent("main"))?.includes("Fish are running"));

// 7. Membership: apply -> offer -> offline payment -> active
await anon.goto(`${base}/membership/apply?type=local`);
for (const [k, v] of Object.entries({ firstName: "Morag", lastName: "Stewart", email: "morag@example.com", phone: "07700 900456", addressLine1: "2 Burrell St", town: "Crieff", postcode: "PH7 4DG" })) await anon.fill(`#${k}`, v);
await anon.getByRole("button", { name: "Submit application" }).click();
await anon.waitForTimeout(2000);
check("membership application received", (await anon.textContent("main")).includes("application"));
const [app] = await db`select id, status from membership_applications where email = 'morag@example.com'`;
await admin.goto(`${base}/admin/membership`);
await admin.getByRole("button", { name: "Offer place" }).first().click();
await admin.locator("dialog[open] button[type=submit]").click();
await admin.waitForTimeout(2000);
const [app2] = await db`select status, reference, access_token from membership_applications where id = ${app.id}`;
check("offer made", app2.status === "offered");
await anon.goto(`${base}/membership/pay/${app2.reference}?t=${encodeURIComponent(app2.access_token)}`);
check("pay page shows total", (await anon.textContent("main")).includes("£160"));
await admin.goto(`${base}/admin/membership`);
await admin.getByRole("button", { name: "Paid offline" }).first().click();
await admin.locator("dialog[open] button[type=submit]").click();
await admin.waitForTimeout(2500);
const [mem] = await db`select m.status, m.expires_on, m.membership_number from memberships m where application_id = ${app.id}`;
check("membership active", mem?.status === "active", JSON.stringify(mem));

// 8. Catch return (blank day, then with a fish)
await anon.goto(`${base}/catch-returns`);
await anon.fill("#anglerName", "Angus Test"); await anon.fill("#email", "angus@example.com");
await anon.selectOption("#items\\.0\\.speciesId", { label: "Sea trout" });
await anon.fill("#items\\.0\\.weightLb", "2.5");
await anon.getByRole("button", { name: "Submit catch return" }).click();
await anon.waitForTimeout(2000);
check("catch return recorded", (await db`select 1 from catch_return_items where weight_lb = 2.5`).length === 1);

// 9. Contact form
await anon.goto(`${base}/contact`);
await anon.fill("#name", "Visitor"); await anon.fill("#email", "v@example.com"); await anon.fill("#subject", "Parking"); await anon.fill("#message", "Where do I park at Braidhaugh?");
await anon.getByRole("button", { name: "Send message" }).click();
await anon.waitForTimeout(1500);
check("contact message stored", (await db`select 1 from contact_messages where subject = 'Parking'`).length === 1);

// 10. Non-admins can't reach admin
const angler = await as(null);
const r = await angler.goto(`${base}/admin`);
check("anonymous user cannot open /admin", !(await angler.textContent("body")).includes("Revenue this month"), `status ${r.status()}`);
const b2 = await as("bailiff@example.com");
const r2 = await b2.goto(`${base}/admin`);
check("bailiff gets 404 on /admin", r2.status() === 404);

// cleanup block
await db`delete from availability_overrides where id = ${ov.id}`;
await browser.close(); await db.end();
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
