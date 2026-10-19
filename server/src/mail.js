// Sends email through Brevo's HTTPS API (https://www.brevo.com). We use an HTTP API
// rather than SMTP because Render's free tier blocks outbound SMTP ports.
//
// Env: BREVO_API_KEY, MAIL_FROM (a sender address verified in Brevo), MAIL_FROM_NAME.
// Without BREVO_API_KEY, emails are printed to the server log instead (handy locally).

const { BREVO_API_KEY, MAIL_FROM, MAIL_FROM_NAME = "LeetCode Tracker" } = process.env;

export const mailConfigured = !!(BREVO_API_KEY && MAIL_FROM);

export async function sendMail({ to, subject, text, html }) {
  if (!mailConfigured) {
    console.log(`\n[mail not configured; would send to ${to}]\nSubject: ${subject}\n\n${text}\n`);
    return;
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: MAIL_FROM, name: MAIL_FROM_NAME },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });
  if (!res.ok) throw new Error(`Brevo responded ${res.status}: ${await res.text()}`);
}
