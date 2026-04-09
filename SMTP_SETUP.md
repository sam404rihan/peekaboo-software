# SMTP Email Setup Guide for Komfort POS

Email notifications are sent to administrators when invoices are voided. This guide helps you set up SMTP email delivery.

---

## ✅ Your Current Setup

You're already configured with Gmail SMTP! Your `.env` file has:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=samarrihan048@gmail.com
SMTP_PASS=dqohbezrplekisea
NOTIFY_ADMIN_EMAIL=samarrihan048@gmail.com
NEXT_PUBLIC_APP_NAME=Komfort
```

### Test the Setup

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Navigate to an invoice and click "Void Invoice"

3. Check your email at `samarrihan048@gmail.com` for a notification

---

## 📧 Gmail SMTP Setup (Your Current Provider)

### Important: App Password

The password `dqohbezrplekisea` appears to be a Gmail App Password (good!). If you need to regenerate it:

1. **Enable 2-Factor Authentication** on your Google account
   - Go to: https://myaccount.google.com/security
   - Enable "2-Step Verification"

2. **Generate App Password**
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Name it "Komfort POS"
   - Copy the 16-character password
   - Use it as `SMTP_PASS` in `.env`

### Gmail Settings

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587                    # Use 465 for SSL (secure: true)
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
```

---

## 🔧 Alternative SMTP Providers

### SendGrid (Recommended for Production)

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
NOTIFY_ADMIN_EMAIL=admin@yourdomain.com
```

**Setup:**
1. Sign up at https://sendgrid.com
2. Create an API key: Settings > API Keys > Create API Key
3. Use "apikey" as username and your API key as password

### AWS SES

```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
NOTIFY_ADMIN_EMAIL=admin@yourdomain.com
```

**Setup:**
1. Verify your email/domain in AWS SES
2. Create SMTP credentials in AWS SES Console
3. Use the provided username and password

### Microsoft 365 / Outlook

```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
NOTIFY_ADMIN_EMAIL=admin@yourdomain.com
```

### Custom SMTP Server

```env
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587                    # or 465 for SSL
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-password
NOTIFY_ADMIN_EMAIL=admin@yourdomain.com
```

---

## 📋 Email Notification Details

### What Triggers an Email?

- When any user (admin or cashier) voids an invoice
- Sent to the address in `NOTIFY_ADMIN_EMAIL`

### Email Content

Subject: ⚠️ Invoice {number} has been voided

Body includes:
- Invoice number
- Amount (₹)
- Who voided it
- When it was voided
- Invoice ID

### Example Email

```
Invoice Voided

Invoice:       INV-001
Amount:        ₹1,234.56
Voided by:     John Doe (john@example.com)
Voided at:     1 April 2026, 7:00 PM
Invoice ID:    abc123def456

This is an automated alert from Komfort.
```

---

## 🧪 Testing Your Setup

### Test Script

Create a test file `test-email.js`:

```javascript
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'samarrihan048@gmail.com',
    pass: 'dqohbezrplekisea'
  }
});

transporter.sendMail({
  from: '"Komfort Alerts" <samarrihan048@gmail.com>',
  to: 'samarrihan048@gmail.com',
  subject: '✅ SMTP Test - Komfort POS',
  html: '<h2>Success!</h2><p>Your SMTP configuration is working correctly.</p>'
})
.then(() => console.log('✅ Email sent successfully!'))
.catch((err) => console.error('❌ Error:', err.message));
```

Run it:
```bash
node test-email.js
```

---

## 🚨 Troubleshooting

### "Authentication failed" Error

**Gmail:**
- Make sure you're using an App Password, not your regular password
- Enable "Less secure app access" if not using 2FA (not recommended)
- Check that 2-Step Verification is enabled

**Other providers:**
- Verify username and password are correct
- Check if your account requires special authentication

### "Connection timeout" Error

- Check `SMTP_HOST` is correct
- Try port 465 with `secure: true` instead of 587
- Verify your firewall isn't blocking outbound SMTP

### Email Goes to Spam

- Add SPF/DKIM records to your domain (for production)
- Use a verified sender domain
- Consider using SendGrid or AWS SES for production

### No Email Received

1. Check the browser console for errors
2. Verify `NOTIFY_ADMIN_EMAIL` is correct
3. Check spam/junk folder
4. Run the test script above to isolate the issue

---

## 🔐 Security Best Practices

### Development
- ✅ Use App Passwords (not real passwords)
- ✅ Keep `.env` in `.gitignore` (already done)
- ✅ Never commit credentials to Git

### Production
- Use environment variables in your hosting platform (Vercel, etc.)
- Use dedicated email service (SendGrid, AWS SES)
- Set up SPF, DKIM, and DMARC records
- Use a dedicated `noreply@` or `alerts@` sender address

---

## 🚀 Production Deployment

When deploying to Vercel/Production:

1. **Don't commit `.env` to Git** (already in `.gitignore`)

2. **Add environment variables in Vercel Dashboard:**
   - Project → Settings → Environment Variables
   - Add all SMTP variables
   - Select "Production" environment

3. **Redeploy** after adding variables

---

## 📝 Need Help?

If emails still aren't working:
1. Check the browser Network tab when voiding an invoice
2. Look for `/api/notify/void` request
3. Check the response for error messages
4. Run the test script to verify SMTP credentials

---

## ✨ Optional: Customize Email Template

Edit: `app/api/notify/void/route.ts`

Change the HTML template starting at line 36 to customize:
- Colors
- Logo
- Layout
- Additional information

---

Your SMTP is already configured! Try voiding a test invoice to see it in action. 🎉
