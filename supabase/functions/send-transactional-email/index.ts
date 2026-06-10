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

const TEMPLATES: Record<string, (d: Record<string, any>) => { subject: string; html: string }> = {
  "customer-password-reset": renderPasswordReset,
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
