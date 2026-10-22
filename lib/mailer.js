const nodemailer = require('nodemailer');

let _t = null;
function transport() {
  if (!_t) _t = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: +process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return _t;
}

function base(title, body) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#EFE7D8;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#F8F4E9;border:1px solid rgba(30,42,56,.2);border-top:4px solid #A9822C;">
  <tr><td style="padding:24px 28px;border-bottom:1px solid rgba(30,42,56,.15);">
    <b style="font-size:17px;color:#1E2A38;">CGST &amp; Customs Guest House, Kolkata</b><br>
    <span style="font-size:11px;color:#4B5A6B;">Departmental Accommodation Portal</span>
  </td></tr>
  <tr><td style="padding:28px;">${body}</td></tr>
  <tr><td style="padding:14px 28px;background:#E4DAC5;border-top:1px solid rgba(30,42,56,.1);font-size:11px;color:#4B5A6B;font-family:monospace;">
    Automated message · Rates per CBIC F.No.712/171/HRD/WF/18 dt. 16.12.2019
  </td></tr>
</table></td></tr></table></body></html>`;
}

async function send({ to, subject, html }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return; // Email not configured — skip silently
  try { await transport().sendMail({ from: process.env.EMAIL_FROM, to, subject, html }); }
  catch (e) { console.error('Email send failed:', e.message); }
}

const sendApprovalEmail = (to, d) => send({
  to, subject: `✓ Booking Approved — ${d.checkIn} to ${d.checkOut} | CGST Guest House`,
  html: base('Booking Approved', `
    <p style="font-size:20px;font-weight:700;color:#3F6C51;margin:0 0 4px;">✓ Booking Approved</p>
    <p style="color:#4B5A6B;font-size:13px;">Your application has been approved by the JC/ADC.</p>
    <table width="100%" cellpadding="7" cellspacing="0" style="border:1px solid rgba(30,42,56,.18);font-size:13px;font-family:monospace;margin-top:12px;">
      <tr><td style="color:#4B5A6B;width:45%;">Applicant</td><td><b>${d.name}</b></td></tr>
      <tr style="background:#F8F4E9;"><td style="color:#4B5A6B;">Room</td><td><b>${d.roomLabel}</b></td></tr>
      <tr><td style="color:#4B5A6B;">Check-in</td><td><b>${d.checkIn}</b></td></tr>
      <tr style="background:#F8F4E9;"><td style="color:#4B5A6B;">Check-out</td><td><b>${d.checkOut}</b></td></tr>
      <tr><td style="color:#4B5A6B;">Nights</td><td>${d.nights}</td></tr>
      <tr style="background:#F8F4E9;"><td style="color:#4B5A6B;">Rate/day</td><td>Rs. ${d.rate}</td></tr>
      <tr><td style="color:#4B5A6B;font-weight:700;">Total</td><td><b>Rs. ${d.total}</b></td></tr>
      <tr style="background:#F8F4E9;"><td style="color:#4B5A6B;">Payment</td><td>${d.payMode === 'upi' ? '📲 UPI' : '💵 Cash'}${d.upiRef ? ' · UTR: ' + d.upiRef : ''}</td></tr>
    </table>
    <p style="margin-top:16px;padding:12px;background:#e6ede8;border:1px solid #3F6C51;font-size:13px;color:#3F6C51;">
      Please carry this confirmation and a valid photo ID at check-in (12:00 noon).
    </p>`),
});

const sendRejectionEmail = (to, d) => send({
  to, subject: `Application Status — CGST Guest House Kolkata`,
  html: base('Application Not Approved', `
    <p style="font-size:20px;font-weight:700;color:#A13D2B;margin:0 0 4px;">✕ Application Not Approved</p>
    <p style="color:#4B5A6B;font-size:13px;">We regret your application could not be approved at this time.</p>
    <table width="100%" cellpadding="7" cellspacing="0" style="border:1px solid rgba(30,42,56,.18);font-size:13px;font-family:monospace;margin-top:12px;">
      <tr><td style="color:#4B5A6B;width:45%;">Applicant</td><td><b>${d.name}</b></td></tr>
      <tr style="background:#F8F4E9;"><td style="color:#4B5A6B;">Requested dates</td><td>${d.checkIn} → ${d.checkOut}</td></tr>
    </table>
    <p style="margin-top:16px;padding:12px;background:#fbe9e4;border:1px solid #A13D2B;font-size:13px;color:#A13D2B;">
      Contact the Guest House office for details. You may apply for alternate dates.
    </p>`),
});

const sendRegistrationEmail = (to, d) => send({
  to, subject: `Welcome to CGST Guest House Portal`,
  html: base('Welcome', `
    <p style="font-size:20px;font-weight:700;color:#1E2A38;margin:0 0 4px;">Welcome, ${d.name}</p>
    <p style="color:#4B5A6B;font-size:13px;">Your account has been created on the CGST Guest House Booking Portal.</p>
    <table width="100%" cellpadding="7" cellspacing="0" style="border:1px solid rgba(30,42,56,.18);font-size:13px;font-family:monospace;margin-top:12px;">
      <tr><td style="color:#4B5A6B;">Email</td><td><b>${d.email}</b></td></tr>
      <tr style="background:#F8F4E9;"><td style="color:#4B5A6B;">Role</td><td>${d.role === 'officer' ? 'Approving Officer (JC/ADC)' : 'Applicant'}</td></tr>
    </table>`),
});

module.exports = { sendApprovalEmail, sendRejectionEmail, sendRegistrationEmail };
