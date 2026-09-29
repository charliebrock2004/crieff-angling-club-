import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown, stripMarkdown } from "@/lib/markdown";
import { bookingConfirmationEmail } from "@/lib/email/templates";
import { checkoutSchema, contactSchema } from "@/lib/validation";
import { slugify } from "@/lib/admin/crud";
import { bookingReference, verificationCode, safeEqual } from "@/lib/ids";
import type { BookingDetail } from "@/lib/permits/data";

describe("markdown renderer", () => {
  it("renders headings, lists, emphasis and links", () => {
    const html = renderToStaticMarkup(Markdown({ source: "## Title\n\nSome **bold** and *it*.\n\n- one\n- two\n\n[Rules](/rules)" })!);
    expect(html).toContain("<h2>Title</h2>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain('href="/rules"');
  });

  it("never outputs raw HTML or javascript: links", () => {
    const html = renderToStaticMarkup(Markdown({ source: '<script>alert(1)</script>\n\n[x](javascript:alert(1)) <img src=x onerror=alert(1)>' })!);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("&lt;script&gt;");
  });

  it("strips markdown for meta descriptions", () => {
    expect(stripMarkdown("## Hi **there** [link](/x)")).toBe("Hi there link");
  });
});

describe("emails", () => {
  it("escapes customer-provided content", () => {
    const b = {
      reference: "CAC-ABCDEF",
      accessToken: "tok",
      fishingDate: "2027-05-04",
      quantity: 1,
      totalPence: 700,
      unitPricePence: 700,
      boatFeePence: 0,
      water: { name: "River Earn" },
      beat: { name: "Braidhaugh" },
      permitType: { name: "Brown Trout" },
      boat: null,
      permits: [{ anglerFirstName: "<b>Evil</b>", anglerLastName: "O'Neil" }],
      contact: { firstName: '"><script>x</script>' },
    } as unknown as BookingDetail;
    const e = bookingConfirmationEmail(b, { siteUrl: "https://example.test", conditions: ["Fly only & <no bait>"] });
    expect(e.html).not.toContain("<script>x");
    expect(e.html).not.toContain("<b>Evil</b>");
    expect(e.html).toContain("&lt;b&gt;Evil&lt;/b&gt;");
    expect(e.html).toContain("Fly only &amp; &lt;no bait&gt;");
    expect(e.text).toContain("CAC-ABCDEF");
    expect(e.subject).toContain("CAC-ABCDEF");
  });
});

describe("validation", () => {
  const contact = { firstName: "A", lastName: "B", email: " A@Example.COM ", phone: "07700 900123", addressLine1: "1 St", town: "Crieff", postcode: "ph73aa" };
  it("normalises emails and UK postcodes", () => {
    const r = contactSchema.parse(contact);
    expect(r.email).toBe("a@example.com");
    expect(r.postcode).toBe("PH7 3AA");
  });
  it("requires one angler name per permit", () => {
    const r = checkoutSchema.safeParse({ date: "2027-05-04", beatId: crypto.randomUUID(), permitTypeId: crypto.randomUUID(), quantity: 2, anglers: [{ firstName: "a", lastName: "b" }], contact });
    expect(r.success).toBe(false);
  });
  it("rejects filled honeypots and invalid input", () => {
    expect(checkoutSchema.safeParse({ date: "2027-02-30", beatId: "x", permitTypeId: "y", quantity: 0, anglers: [], contact }).success).toBe(false);
    const ok = { date: "2027-05-04", beatId: crypto.randomUUID(), permitTypeId: crypto.randomUUID(), quantity: 1, anglers: [{ firstName: "a", lastName: "b" }], contact };
    expect(checkoutSchema.safeParse(ok).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...ok, website: "http://spam" }).success).toBe(false);
  });
});

describe("ids", () => {
  it("generates well-formed, unambiguous codes", () => {
    expect(bookingReference()).toMatch(/^CAC-[2-9A-HJKMNP-Z]{6}$/);
    expect(verificationCode()).toMatch(/^[2-9A-HJKMNP-Z]{14}$/);
    expect(new Set(Array.from({ length: 2000 }, verificationCode)).size).toBe(2000);
  });
  it("compares tokens safely", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
  it("slugifies titles", () => {
    expect(slugify("Autumn Run — Fish & Chips!")).toBe("autumn-run-fish-and-chips");
  });
});
