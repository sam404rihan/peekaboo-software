import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  const { invoiceNumber, invoiceId, grandTotal, voidedBy, voidedAt } =
    await req.json();

  const adminEmail = process.env.NOTIFY_ADMIN_EMAIL;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT ?? 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!adminEmail || !smtpHost || !smtpUser || !smtpPass) {
    // Silently skip — email not configured
    return NextResponse.json({ ok: false, reason: "email not configured" });
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Komfort POS";
  const voidedAtFormatted = new Date(voidedAt).toLocaleString("en-IN", {
    dateStyle: "long",
    timeStyle: "short",
  });

  await transporter.sendMail({
    from: `"${appName} Alerts" <${smtpUser}>`,
    to: adminEmail,
    subject: `⚠️ Invoice ${invoiceNumber} has been voided`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
        <h2 style="color:#b7102a;margin-top:0;">Invoice Voided</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px 0;color:#64748b;font-weight:600;">Invoice</td><td style="padding:8px 0;font-weight:700;">${invoiceNumber}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-weight:600;">Amount</td><td style="padding:8px 0;font-weight:700;">₹${Number(grandTotal).toFixed(2)}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-weight:600;">Voided by</td><td style="padding:8px 0;font-weight:700;">${voidedBy}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-weight:600;">Voided at</td><td style="padding:8px 0;">${voidedAtFormatted}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-weight:600;">Invoice ID</td><td style="padding:8px 0;font-size:12px;color:#94a3b8;">${invoiceId}</td></tr>
        </table>
        <p style="margin-top:20px;font-size:12px;color:#94a3b8;">This is an automated alert from ${appName}.</p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
