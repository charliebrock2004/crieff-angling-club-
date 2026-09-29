import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { formatDate, formatMoney } from "../format";
import type { BookingDetail } from "./data";

export function verificationUrl(siteUrl: string, code: string) {
  return `${siteUrl}/permit/verify/${code}`;
}

export async function qrPng(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, { errorCorrectionLevel: "M", margin: 1, width: 360, color: { dark: "#14221d", light: "#ffffff" } });
}

export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: "svg", errorCorrectionLevel: "M", margin: 0, color: { dark: "#14221d", light: "#0000" } });
}

const INK = rgb(0.078, 0.133, 0.114);
const MUTED = rgb(0.36, 0.4, 0.38);
const ACCENT = rgb(0.72, 0.47, 0.18);
const RULE = rgb(0.85, 0.83, 0.78);

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n+/)) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        out.push(line);
        line = word;
      } else line = next;
    }
    if (line) out.push(line);
  }
  return out;
}

// pdf-lib standard fonts are WinAnsi; strip characters they cannot encode.
const safe = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[^\x20-\x7E£·]/g, "");

/** A4 permit, one page per angler, each with its own QR code. */
export async function permitPdf(b: BookingDetail, siteUrl: string, conditions: string[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Crieff Angling Club permit ${b.reference}`);
  pdf.setAuthor("Crieff Angling Club");
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  for (const permit of b.permits) {
    const page: PDFPage = pdf.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    const m = 48;
    page.drawRectangle({ x: 0, y: height - 120, width, height: 120, color: INK });
    page.drawText("CRIEFF ANGLING CLUB", { x: m, y: height - 62, size: 24, font: serif, color: rgb(0.96, 0.94, 0.9) });
    page.drawText("DIGITAL FISHING PERMIT", { x: m, y: height - 88, size: 10, font: sansBold, color: ACCENT });
    const status = b.status === "paid" ? "VALID" : b.status.toUpperCase();
    page.drawText(status, { x: width - m - sansBold.widthOfTextAtSize(status, 14), y: height - 70, size: 14, font: sansBold, color: b.status === "paid" ? rgb(0.55, 0.8, 0.6) : rgb(0.95, 0.5, 0.45) });

    let y = height - 170;
    const field = (label: string, value: string, x: number, yy: number) => {
      page.drawText(label.toUpperCase(), { x, y: yy, size: 8, font: sansBold, color: MUTED });
      page.drawText(safe(value), { x, y: yy - 18, size: 14, font: sans, color: INK });
    };
    field("Angler", `${permit.anglerFirstName} ${permit.anglerLastName}`, m, y);
    field("Permit no.", permit.permitNumber, 330, y);
    y -= 56;
    field("Date", formatDate(b.fishingDate, "full"), m, y);
    field("Booking reference", b.reference, 330, y);
    y -= 56;
    field("Water", b.water.name, m, y);
    field("Beat", b.beat.name, 330, y);
    y -= 56;
    field("Permit type", b.permitType.name, m, y);
    field("Price", formatMoney(b.unitPricePence) + (b.boatFeePence ? ` + boat ${formatMoney(b.boatFeePence)}` : ""), 330, y);
    if (b.boat) {
      y -= 56;
      field("Boat", b.boat.name, m, y);
    }

    y -= 50;
    page.drawLine({ start: { x: m, y }, end: { x: width - m, y }, thickness: 1, color: RULE });

    const qr = await pdf.embedPng(await qrPng(verificationUrl(siteUrl, permit.verificationCode)));
    const qrSize = 150;
    page.drawImage(qr, { x: width - m - qrSize, y: y - qrSize - 20, width: qrSize, height: qrSize });
    page.drawText("Scan to verify", { x: width - m - qrSize, y: y - qrSize - 36, size: 9, font: sans, color: MUTED });
    page.drawText(permit.verificationCode, { x: width - m - qrSize, y: y - qrSize - 50, size: 9, font: sansBold, color: INK });

    let cy = y - 34;
    page.drawText("IMPORTANT CONDITIONS", { x: m, y: cy, size: 9, font: sansBold, color: ACCENT });
    cy -= 18;
    const textWidth = width - m * 2 - qrSize - 30;
    for (const c of conditions) {
      const lines = wrap(safe(c), sans, 9.5, textWidth - 10);
      page.drawText("•", { x: m, y: cy, size: 9.5, font: sans, color: INK });
      for (const line of lines) {
        page.drawText(line, { x: m + 10, y: cy, size: 9.5, font: sans, color: INK });
        cy -= 13;
      }
      cy -= 5;
      if (cy < 90) break;
    }

    page.drawLine({ start: { x: m, y: 70 }, end: { x: width - m, y: 70 }, thickness: 1, color: RULE });
    page.drawText(safe(`This permit is valid only for the named angler on the date, water and beat shown. Verify at ${siteUrl.replace(/^https?:\/\//, "")}/permit/verify`), {
      x: m,
      y: 52,
      size: 8,
      font: sans,
      color: MUTED,
      maxWidth: width - m * 2,
    });
  }
  return pdf.save();
}
