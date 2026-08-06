// Sends transactional emails via Resend from noreply@stylysapp.com
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FROM = "STYLYS <noreply@stylysapp.com>";

function renderPasswordReset(data: Record<string, any>) {
  const name = data.name || "there";
  const brandName = data.brandName || "your store";
  const resetUrl = data.resetUrl;
  const subject = `Reset your ${brandName} STYLYS password`;
  const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#111">
    <div style="max-width:520px;margin:0 auto;padding:40px 24px">
      <div style="font-size:20px;font-weight:600;letter-spacing:0.04em;margin-bottom:28px">STYLYS</div>
      <h1 style="font-size:22px;font-weight:600;margin:0 0 16px">Reset your password</h1>
      <p style="font-size:15px;line-height:1.55;color:#333;margin:0 0 12px">Hi ${name},</p>
      <p style="font-size:15px;line-height:1.55;color:#333;margin:0 0 24px">
        We received a request to reset the password for your STYLYS shopper account on ${brandName}.
        Click the button below to set a new password. This link expires in 1 hour.
      </p>
      <p style="margin:0 0 32px">
        <a href="${resetUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px;font-weight:500">Set new password</a>
      </p>
      <p style="font-size:13px;color:#666;line-height:1.5;margin:0 0 8px">If the button doesn't work, paste this URL into your browser:</p>
      <p style="font-size:13px;color:#666;word-break:break-all;margin:0 0 32px"><a href="${resetUrl}" style="color:#666">${resetUrl}</a></p>
      <p style="font-size:13px;color:#888;line-height:1.5;margin:0">If you didn't request this, you can safely ignore this email — your password will stay the same.</p>
    </div>
  </body></html>`;
  return { subject, html };
}

function renderCustomerDataExport(data: Record<string, any>) {
  const brandName = data.brandName || "your store";
  const subject = `Your personal data held by ${brandName} via STYLYS`;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 0;color:#888;width:160px;vertical-align:top">${label}</td><td style="padding:4px 0;color:#333">${value}</td></tr>`;

  const accountRows = [
    data.accountEmail ? row("Email", data.accountEmail) : "",
    data.accountName ? row("Name", data.accountName) : "",
    data.accountCreatedAt ? row("Account created", fmt(data.accountCreatedAt)) : "",
  ].filter(Boolean).join("");

  const accountSection = accountRows
    ? `<h2 style="font-size:16px;font-weight:600;margin:24px 0 8px">Account</h2><table style="width:100%;border-collapse:collapse">${accountRows}</table>`
    : "";

  let profileSection = "";
  if (data.quizCompleted) {
    const arr = (v: unknown) => (Array.isArray(v) && v.length ? (v as string[]).join(", ") : null);
    const profileRows = [
      data.bodyShape ? row("Body shape", data.bodyShape) : "",
      arr(data.preferredColors) ? row("Preferred colors", arr(data.preferredColors)!) : "",
      arr(data.avoidedColors) ? row("Avoided colors", arr(data.avoidedColors)!) : "",
      data.sizeInfo ? row("Size info", JSON.stringify(data.sizeInfo)) : "",
      arr(data.occasions) ? row("Occasions", arr(data.occasions)!) : "",
      data.budgetRange ? row("Budget range", data.budgetRange) : "",
    ].filter(Boolean).join("");
    if (profileRows) {
      profileSection = `<h2 style="font-size:16px;font-weight:600;margin:24px 0 8px">Style Profile</h2><table style="width:100%;border-collapse:collapse">${profileRows}</table>`;
    }
  }

  const activitySection = `<h2 style="font-size:16px;font-weight:600;margin:24px 0 8px">Activity</h2><table style="width:100%;border-collapse:collapse">${row("Recommendations", `${data.recommendationCount ?? 0} generated`)}${row("Saved outfits", `${data.savedOutfitCount ?? 0} saved`)}</table>`;

  const retentionSection = `<p style="font-size:13px;color:#888;line-height:1.5;margin:24px 0 0;padding-top:16px;border-top:1px solid #eee">To request deletion of your data, contact ${brandName} directly.</p>`;

  const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#111"><div style="max-width:520px;margin:0 auto;padding:40px 24px"><div style="font-size:20px;font-weight:600;letter-spacing:0.04em;margin-bottom:28px">STYLYS</div><h1 style="font-size:22px;font-weight:600;margin:0 0 8px">Your personal data</h1><p style="font-size:14px;color:#666;margin:0 0 24px">Held by <strong>${brandName}</strong> via STYLYS</p>${accountSection}${profileSection}${activitySection}${retentionSection}</div></body></html>`;

  return { subject, html };
}

function renderSupportTicketReceived(data: Record<string, any>) {
  const subject = `[Support] ${data.priority === "priority" ? "[PRIORITY] " : ""}New ticket: ${data.ticketSubject}`;
  const priorityBadge = data.priority === "priority"
    ? `<span style="display:inline-block;background:#b91c1c;color:#fff;font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;margin-left:8px">PRIORITY</span>`
    : `<span style="display:inline-block;background:#6b7280;color:#fff;font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;margin-left:8px">STANDARD</span>`;
  const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#111"><div style="max-width:600px;margin:0 auto;padding:40px 24px"><div style="font-size:20px;font-weight:600;letter-spacing:0.04em;margin-bottom:28px">STYLYS</div><h1 style="font-size:20px;font-weight:600;margin:0 0 4px">New support ticket ${priorityBadge}</h1><p style="font-size:13px;color:#888;margin:0 0 24px">${new Date().toUTCString()}</p><table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px"><tr><td style="padding:6px 0;color:#888;width:100px;vertical-align:top">From</td><td style="padding:6px 0;color:#111">${data.fromEmail}</td></tr><tr><td style="padding:6px 0;color:#888;vertical-align:top">Subject</td><td style="padding:6px 0;color:#111">${data.ticketSubject}</td></tr></table><div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;font-size:14px;color:#333;line-height:1.6;white-space:pre-wrap">${data.message}</div></div></body></html>`;
  return { subject, html };
}

function renderSupportTicketConfirmation(data: Record<string, any>) {
  const responseTime = data.priority === "priority" ? "4 hours" : "24–48 hours";
  const subject = `We received your support request`;
  const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#111"><div style="max-width:520px;margin:0 auto;padding:40px 24px"><div style="font-size:20px;font-weight:600;letter-spacing:0.04em;margin-bottom:28px">STYLYS</div><h1 style="font-size:22px;font-weight:600;margin:0 0 16px">We got your message</h1><p style="font-size:15px;line-height:1.55;color:#333;margin:0 0 16px">Thanks for reaching out. We'll get back to you within <strong>${responseTime}</strong>.</p><div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:0 0 24px"><p style="font-size:12px;color:#888;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.05em">Your message</p><p style="font-size:14px;font-weight:600;color:#111;margin:0 0 8px">${data.ticketSubject}</p><p style="font-size:14px;color:#555;line-height:1.55;margin:0;white-space:pre-wrap">${data.message}</p></div><p style="font-size:13px;color:#888;line-height:1.5;margin:0">You can also reach us at <a href="mailto:support@stylysapp.com" style="color:#111">support@stylysapp.com</a>.</p></div></body></html>`;
  return { subject, html };
}

const TEMPLATES: Record<string, (d: Record<string, any>) => { subject: string; html: string }> = {
  "customer-password-reset": renderPasswordReset,
  "customer-data-export": renderCustomerDataExport,
  "support-ticket-received": renderSupportTicketReceived,
  "support-ticket-confirmation": renderSupportTicketConfirmation,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { templateName, recipientEmail, templateData, subject: subjectOverride } = await req.json();
    if (!templateName || !recipientEmail) {
      return new Response(JSON.stringify({ error: "templateName and recipientEmail are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const renderer = TEMPLATES[templateName];
    if (!renderer) {
      return new Response(JSON.stringify({ error: `Unknown template: ${templateName}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subject, html } = renderer(templateData || {});

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [recipientEmail],
        subject: subjectOverride || subject,
        html,
      }),
    });

    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("Resend send failed:", resp.status, result);
      return new Response(JSON.stringify({ error: "Failed to send email", details: result }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-transactional-email error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
