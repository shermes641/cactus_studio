/*
  Netlify Function: node-mailer.ts
  This function is used to send emails to users.
  It supports sending verification and password reset emails using Gmail API with a service account.
    replyTo?: string
    fromName?: string
    attachments?: {
      filename: string
      mimeType: string
      contentBase64: string
    }[]

await fetch("/.netlify/functions/node-mailer", {
  method: "POST",
  body: JSON.stringify({
    email,
    token,
    type: "verify",
    attachments: [
      {
        filename: "terms.pdf",
        mimeType: "application/pdf",
        contentBase64: pdfBase64
      }
    ]
  })
});

{
  replyTo: "support@cactusstudio.shop",
  fromName: "Cactus Support"
}

*/

import { Handler } from "@netlify/functions";
import { google } from "googleapis";
import { neon } from '@netlify/neon';

const sql = neon(process.env.NETLIFY_DATABASE_URL!);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const {
      email,
      token,
      type,
      name,
      test,
      replyTo,
      fromName,
      attachments = []
    } = JSON.parse(event.body || "{}");

    if (!email || !token || !type) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing email, token, or type" })
      };
    }

    const ip =
      event.headers["x-nf-client-connection-ip"] ||
      event.headers["x-forwarded-for"] ||
      "unknown";

    const ua = event.headers["user-agent"] || "unknown";

    const baseUrl = process.env.URL || "http://localhost:8888";
    let subject = "";
    let html = "";
    let link = "";

    if (type === "verify") {
      link = `${baseUrl}/verify?token=${token}&email=${encodeURIComponent(email)}`;
      subject = "Verify your email - Cactus Studio";
      html = baseTemplate(`
        <h3>Welcome ${name || "Cactus Lover"}!</h3>
        <p>Please verify your email address:</p>
        ${button(link, "Verify Email")}
        <p style="font-size:13px;color:#666;margin-top:20px">
          Or copy & paste:<br/>
          <a href="${link}">${link}</a>
        </p>
      `);
    } else if (type === "reset") {
      link = `${baseUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
      subject = "Password Reset - Cactus Studio";
      html = baseTemplate(`
        <h3>Password Reset</h3>
        <p>You requested a password reset.</p>
        ${button(link, "Reset Password", "#1976d2")}
        <p style="font-size:13px;color:#666;margin-top:20px">
          This link expires in 1 hour.
        </p>
      `);
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid email type" })
      };
    }

    const sender = "cactus@cactusstudio.shop";

    await logAudit(sql, {
      email,
      action: "email.requested",
      entityType: "email",
      entityId: type,
      ip,
      ua,
      metadata: {
        type,
        replyTo,
        fromName,
        hasAttachments: attachments.length > 0
      }
    });

    if (test || process.env.EMAIL_TEST_MODE === "true") {
      await logAudit(sql, {
        email,
        action: "email.test",
        entityType: "email",
        entityId: type,
        success: true,
        ip,
        ua,
        metadata: { link }
      });
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, link, html })
      };
    }

    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/gmail.send"],
      subject: sender
    });

    const gmail = google.gmail({ version: "v1", auth });

    // ---- MIME message ----
    const boundary = "boundary123";

    let mime = [
      `From: "${fromName || "Cactus Studio"}" <${sender}>`,
      `To: ${email}`,
      replyTo ? `Reply-To: ${replyTo}` : null,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/html; charset=utf-8",
      "",
      html
    ].filter(Boolean);

    for (const att of attachments) {
      mime.push(
        "",
        `--${boundary}`,
        `Content-Type: ${att.mimeType}`,
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${att.filename}"`,
        "",
        att.contentBase64
      );
    }

    mime.push("", `--${boundary}--`);

    const encoded = Buffer.from(mime.join("\n"))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encoded }
    });

    await logAudit(sql, {
      email,
      action: "email.sent",
      entityType: "email",
      entityId: type,
      success: true,
      ip,
      ua,
      metadata: {
        subject,
        attachments: attachments.map((a: any) => a.filename)
      }
    });

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (e: any) {
    console.error(e);

    try {
      await logAudit(sql, {
        email: (() => {
          try {
            return JSON.parse(event.body || "{}")?.email;
          } catch {
            return undefined;
          }
        })(),
        action: "email.failed",
        entityType: "email",
        success: false,
        message: e.message,
        ip:
          event.headers["x-nf-client-connection-ip"] ||
          event.headers["x-forwarded-for"] ||
          "unknown",
        ua: event.headers["user-agent"] || "unknown"
      });
    } catch {
      // never block response on audit failure
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message })
    };
  }

};

// ---- templates ----
function baseTemplate(content: string) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f5f5f5;padding:30px">
    <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:8px;padding:24px">
      ${content}
      <hr style="margin:30px 0;border:none;border-top:1px solid #eee" />
      <p style="font-size:12px;color:#888;text-align:center">
        © ${new Date().getFullYear()} Cactus Studio
      </p>
    </div>
  </div>
  `;
}

function button(href: string, text: string, color = "#4CAF50") {
  return `
    <a href="${href}" style="display:inline-block;padding:12px 22px;
       background:${color};color:#fff;text-decoration:none;border-radius:6px">
      ${text}
    </a>
  `;
}

type AuditLog = {
  userId?: string;
  email?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  success?: boolean;
  message?: string;
  ip?: string;
  ua?: string;
  metadata?: Record<string, any>;
};

async function logAudit(
  sql: any,
  data: AuditLog
) {
  await sql`
    INSERT INTO audit_logs (
      user_id,
      user_email,
      action,
      entity_type,
      entity_id,
      success,
      message,
      ip_address,
      user_agent,
      metadata
    ) VALUES (
      ${data.userId ?? null},
      ${data.email ?? null},
      ${data.action},
      ${data.entityType ?? null},
      ${data.entityId ?? null},
      ${data.success ?? true},
      ${data.message ?? null},
      ${data.ip ?? null},
      ${data.ua ?? null},
      ${JSON.stringify(data.metadata ?? {})}::jsonb
    )
  `;
}
