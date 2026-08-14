# Email Delivery (Supabase Auth + Resend)

## Why

Supabase's built-in SMTP service is shared and best-effort — it is not for
production use:

- **Rate limit**: 2 emails per hour per project (can change without notice).
- **Team-only recipients**: unless custom SMTP is enabled, messages are only
  delivered to addresses in the project's team. Any other address fails with
  `Email address not authorized`.
- **No SLA** on delivery or uptime.

MealLedger needs password-reset and email-confirmation links to reach real
users, so it uses a custom SMTP provider. This guide wires **Resend** into
Supabase Auth. Any SMTP-capable provider works (Resend, AWS SES, Postmark,
Brevo, Twilio SendGrid); Resend is chosen for its free tier and simple domain
verification.

## Cost

- Enabling Custom SMTP on Supabase is **free** on every plan.
- Resend free tier covers this app: ~3,000 emails/month and 100/day (limits
  change over time — check <https://resend.com/pricing>). Reset and
  confirmation emails are a handful per day, so the cost is **$0**.
- The only real "risk" is deliverability, not money: if SPF/DKIM/DMARC are
  missing, emails land in spam and users never get their reset links. Step 2
  below prevents that.

## Prerequisites

- A domain you control DNS for. Resend recommends a dedicated sending
  subdomain (for example `auth.yourdomain.com`) to isolate sending reputation
  from the main domain.
- Access to the Supabase project dashboard.
- Access to <https://resend.com>.

## 1. Resend: create account and API key

1. Sign up at <https://resend.com>.
2. Go to **API Keys** → **Create API Key**, name it (for example
   `supabase-auth`), and give it **Full access**. Copy the key — it is shown
   once. Keep it out of the repo and Vite environment files; it is pasted into
   the Supabase dashboard only.

## 2. Resend: add and verify a sending domain

1. Go to **Domains** → **Add Domain**.
2. Enter the sending subdomain (for example `auth.yourdomain.com`) and pick a
   region. Keep **Open and click tracking** disabled for transactional auth
   email.
3. Resend shows DNS records to add at your DNS provider. Add the provided
   **SPF** and **DKIM** TXT/CNAME records exactly as shown. Do not add your
   own SPF record if Resend provides one — a domain must have only one SPF
   record.
4. Wait for the domain status to become **Verified** (Resend checks the
   records; propagation can take minutes to hours).
5. **Add DMARC** manually (Resend does not write it for you). Create a TXT
   record at `_dmarc.auth.yourdomain.com`:

   ```text
   v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
   ```

   `p=none` is a safe starting policy; tighten to `p=quarantine` later once
   you confirm SPF/DKIM pass. Verify records afterward with
   <https://mxtoolbox.com> (SPF/DKIM/DMARC lookup).

## 3. Supabase: enable Custom SMTP

Supabase dashboard → your project → **Authentication → SMTP Settings** →
**Enable Custom SMTP**, then fill in:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `587` (STARTTLS; `465` for implicit TLS also works) |
| Username | `resend` |
| Password | the Resend API key from step 1 |
| Sender email | `no-reply@auth.yourdomain.com` |
| Sender name | MealLedger |

Save. From this point Supabase Auth sends all email (confirmation, password
reset, OTP, invites) through Resend to **any** address.

Management API alternative (same settings, scriptable):

```bash
export SUPABASE_ACCESS_TOKEN="your-access-token"   # supabase.com/dashboard/account/tokens
export PROJECT_REF="rolsgcftiqvobdfzsktu"

curl -X PATCH "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "external_email_enabled": true,
    "mailer_secure_email_change_enabled": true,
    "mailer_autoconfirm": false,
    "smtp_admin_email": "no-reply@auth.yourdomain.com",
    "smtp_host": "smtp.resend.com",
    "smtp_port": 587,
    "smtp_user": "resend",
    "smtp_pass": "your-resend-api-key",
    "smtp_sender_name": "MealLedger"
  }'
```

## 4. Post-save behavior

- To protect the new sender's reputation, Supabase imposes a **30 emails/hour**
  guard after enabling custom SMTP. Adjust it in **Authentication → Rate
  Limits** if ever needed. 30/hour is far beyond this app's needs.
- Send a test message from the SMTP Settings page (if the test button is
  available) or request a password-reset link in the app (step 5). Check the
  Resend dashboard **Emails** table for delivery status and any bounce.

## 5. Verify the full flow in the app

1. Make sure the links inside emails point to the **production** site, not a
   local dev server — set the Site URL and Redirect URLs per the [Auth URL
   Configuration](frontend-hosting.md#auth-url-configuration) section.
   Production sets `VITE_AUTH_REDIRECT_URL` to the deployed URL (see
   `.env.example`), so password-reset emails link to the deployed `/account`
   even if the dashboard Site URL drifts; the Site URL still governs
   confirmation/OTP emails. The live Site URL was verified out of spec
   (`http://localhost:3000`, and the allow-list missing every `/account` URL)
   via `npm run test:auth-config` — fix it to the production domain before
   testing, then re-run the check.
2. In the app, request a password reset for a real inbox. Confirm the email's
   link host is the production domain (never `127.0.0.1`).
3. Paste the reset link back into the app's Reset link field (or open it in
   the same browser), set a new password, and sign in with email + password.
   This is covered by the auth tests; the manual run proves end-to-end
   delivery.

## Security and abuse

- The Resend API key is a credential. Store it only in the Supabase dashboard;
  never commit it or put it in Vite environment files.
- Custom SMTP means email can be sent to any address, so bots can burn your
  Resend quota and damage the sending domain's reputation by mass sign-ups.
  Mitigations (Supabase docs): enable CAPTCHA on sign-up, prefer social login,
  and **never disable email confirmation** under pressure.
- Use a dedicated subdomain and sender address for auth email, and do not mix
  marketing mail into the same domain/sender.

## Rollback

Toggle **Enable Custom SMTP** off in SMTP Settings. Supabase reverts to its
built-in service with all its restrictions (2/hour, team-only, best-effort).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Reset email never arrives | Check the Resend **Emails** table for the delivery status; check the recipient's spam folder; confirm the domain is **Verified** in Resend. |
| Emails land in spam | SPF/DKIM/DMARC missing or misconfigured (step 2). Verify with mxtoolbox; remember a domain can have only one SPF record. |
| `Email rate limit exceeded` | Built-in 2/hour limit is still active because custom SMTP did not save, or the 30/hour guard is hit. Check SMTP Settings saved state and the Rate Limits page. |
| `Email address not authorized` | Built-in service still active (custom SMTP not saved) — the team-only restriction. |
| Links in email point to `127.0.0.1` | Supabase **Site URL** is still set to a local dev URL; update URL Configuration to the deployed URL. |
