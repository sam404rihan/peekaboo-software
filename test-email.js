// Quick test script to verify SMTP email configuration
// Run with: node test-email.js

const nodemailer = require('nodemailer');

console.log('🧪 Testing SMTP Configuration for Komfort POS...\n');

const config = {
  host: 'smtp.gmail.com',
  port: 587,
  user: 'samarrihan048@gmail.com',
  pass: 'dqohbezrplekisea',
  adminEmail: 'samarrihan048@gmail.com',
  appName: 'Komfort'
};

console.log('Configuration:');
console.log(`  Host: ${config.host}:${config.port}`);
console.log(`  From: ${config.user}`);
console.log(`  To: ${config.adminEmail}`);
console.log(`  App: ${config.appName}\n`);

const transporter = nodemailer.createTransport({
  host: config.host,
  port: config.port,
  secure: false,
  auth: {
    user: config.user,
    pass: config.pass
  }
});

console.log('📧 Sending test email...');

transporter.sendMail({
  from: `"${config.appName} Alerts" <${config.user}>`,
  to: config.adminEmail,
  subject: `✅ SMTP Test - ${config.appName} POS`,
  html: `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
      <h2 style="color:#059669;margin-top:0;">✅ SMTP Test Successful</h2>
      <p style="font-size:14px;line-height:1.6;color:#334155;">
        Your SMTP configuration is working correctly! You will now receive email notifications when invoices are voided.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:20px;background:#f8fafc;border-radius:8px;padding:16px;">
        <tr><td style="padding:8px;color:#64748b;font-weight:600;">SMTP Host:</td><td style="padding:8px;font-weight:700;">${config.host}</td></tr>
        <tr><td style="padding:8px;color:#64748b;font-weight:600;">SMTP Port:</td><td style="padding:8px;font-weight:700;">${config.port}</td></tr>
        <tr><td style="padding:8px;color:#64748b;font-weight:600;">From:</td><td style="padding:8px;font-weight:700;">${config.user}</td></tr>
        <tr><td style="padding:8px;color:#64748b;font-weight:600;">To:</td><td style="padding:8px;font-weight:700;">${config.adminEmail}</td></tr>
      </table>
      <p style="margin-top:20px;font-size:12px;color:#94a3b8;">
        This is a test email from ${config.appName} POS.
      </p>
    </div>
  `
})
.then(() => {
  console.log('✅ Email sent successfully!\n');
  console.log(`📬 Check your inbox at: ${config.adminEmail}`);
  console.log('   (Don\'t forget to check spam/junk folder if you don\'t see it)\n');
  console.log('🎉 Your SMTP setup is working correctly!');
  process.exit(0);
})
.catch((err) => {
  console.error('❌ Error sending email:\n');
  console.error(`   ${err.message}\n`);
  console.error('💡 Troubleshooting tips:');
  console.error('   1. Check that your Gmail App Password is correct');
  console.error('   2. Make sure 2-Step Verification is enabled on your Google account');
  console.error('   3. Verify the email address is correct');
  console.error('   4. Check your internet connection\n');
  console.error('📖 See SMTP_SETUP.md for detailed troubleshooting guide');
  process.exit(1);
});
