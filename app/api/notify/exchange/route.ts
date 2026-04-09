import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  const { originalInvoiceNumber, newInvoiceNumber, difference, performedBy, performedAt } =
    await req.json();

  const adminEmail = process.env.NOTIFY_ADMIN_EMAIL;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT ?? 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!adminEmail || !smtpHost || !smtpUser || !smtpPass) {
    return NextResponse.json({ ok: false, reason: "email not configured" });
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Komfort POS";
  const performedAtFormatted = new Date(performedAt).toLocaleString("en-IN", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const diffLabel =
    Number(difference) > 0
      ? `Customer paid ₹${Number(difference).toFixed(2)}`
      : Number(difference) < 0
      ? `Refund issued ₹${Math.abs(Number(difference)).toFixed(2)}`
      : "No balance due";

  await transporter.sendMail({
    from: `"${appName} Alerts" <${smtpUser}>`,
    to: adminEmail,
    subject: `🔄 Exchange processed for Invoice ${originalInvoiceNumber}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
        <h2 style="color:#0284c7;margin-top:0;">Exchange Processed</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px 0;color:#64748b;font-weight:600;">Original Invoice</td><td style="padding:8px 0;font-weight:700;">${originalInvoiceNumber}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-weight:600;">New Invoice</td><td style="padding:8px 0;font-weight:700;">${newInvoiceNumber ?? "—"}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-weight:600;">Balance</td><td style="padding:8px 0;font-weight:700;">${diffLabel}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-weight:600;">Processed by</td><td style="padding:8px 0;font-weight:700;">${performedBy}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-weight:600;">Time</td><td style="padding:8px 0;">${performedAtFormatted}</td></tr>
        </table>
        <p style="margin-top:20px;font-size:12px;color:#94a3b8;">This is an automated alert from ${appName}.</p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
