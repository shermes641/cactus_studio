import type { Handler } from "@netlify/functions";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { email, token, type, name, test } = JSON.parse(event.body || "{}");

    if (!email || !token || !type) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing email, token, or type" }) };
    }

    const baseUrl = process.env.URL || "http://localhost:8888";
    let subject = "";
    let html = "";
    let link = "";

    if (type === 'verify') {
      link = `${baseUrl}/verify?token=${token}&email=${encodeURIComponent(email)}`;
      subject = "Verify your email - Cactus Studio";
      html = `
        <h3>Welcome ${name || 'Cactus Lover'}!</h3>
        <p>Please verify your email address to complete your registration:</p>
        <a href="${link}" style="display:inline-block; padding:10px 20px; background-color:#4CAF50; color:white; text-decoration:none; border-radius:5px;">Verify Email</a>
        <p style="font-size:0.9em; color:#666;">Or click here: <a href="${link}">${link}</a></p>
      `;
    } else if (type === 'reset') {
      link = `${baseUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
      subject = "Password Reset Request - Cactus Studio";
      html = `
        <h3>Password Reset</h3>
        <p>You requested a password reset. Click the link below to set a new password:</p>
        <a href="${link}" style="display:inline-block; padding:10px 20px; background-color:#008CBA; color:white; text-decoration:none; border-radius:5px;">Reset Password</a>
        <p style="font-size:0.9em; color:#666;">Or click here: <a href="${link}">${link}</a></p>
        <p>This link will expire in 1 hour.</p>
      `;
    } else {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid email type" }) };
    }

    // Check for test flag or env var to skip actual sending
    if (test || process.env.EMAIL_TEST_MODE === 'true') {
      console.log(`[TEST EMAIL] To: ${email}, Type: ${type}, Link: ${link}`);
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: "Test mode: Email logged", link, html }),
      };
    }

    await transporter.sendMail({
      from: `"Cactus Studio" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: subject,
      html: html,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (e: any) {
    console.error("Email error:", e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
