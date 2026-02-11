import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  try {
    const { to, otp } = await req.json();

    // Check for required environment variables
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PWD) {
      console.error("Missing Gmail credentials in environment variables");
      return NextResponse.json(
        { 
          error: "Email service not configured. Please set GMAIL_USER and GMAIL_PWD environment variables." 
        },
        { status: 500 }
      );
    }

    // Validate email and OTP
    if (!to || !otp) {
      return NextResponse.json(
        { error: "Missing required fields: to and otp" },
        { status: 400 }
      );
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PWD,
      },
    });

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to,
      subject: "Welcome to Aether Dash - Verify Your Email",
      html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Aether Dash</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background-color: #ffffff;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          text-align: center;
        }
        h1 {
          color: #333333;
          text-align: center;
        }
        p {
          color: #555555;
          line-height: 1.6;
          text-align: center;
        }
        .otp {
          font-size: 24px;
          font-weight: bold;
          color: #007bff;
          text-align: center;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          font-size: 14px;
          color: #888888;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Welcome to Aether Dash!</h1>
        <p>Thank you for signing up with Aether Dash. We're excited to have you on board!</p>
        <p>To complete your registration, please verify your email address using the OTP below:</p>
        <div class="otp">${otp}</div>
        <p>If you did not sign up for Aether Dash, please ignore this email.</p>
        <div class="footer">
          <p>Best regards,<br>The Aether Dash Team</p>
        </div>
      </div>
    </body>
    </html>
  `,
    };
    
    await transporter.sendMail(mailOptions);
    return NextResponse.json(
      { message: "Email sent successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { 
        error: "Failed to send email",
        details: error.message || "Unknown error occurred"
      },
      { status: 500 }
    );
  }
}
