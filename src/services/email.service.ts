import nodemailer from "nodemailer";

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER || "",
      pass: process.env.EMAIL_PASS || "",
    },
  });
};

export const sendCustomerReactivationMail = async (
  email: string,
  name: string,
  reactivationToken: string,
) => {
  const transporter = createTransporter();

  // Backend API URL - use environment variable or default to localhost
  const backendUrl = "http://localhost:3000";
  const reactivationLink = `${backendUrl}/customer/reactivate-account/${reactivationToken}`;

  const mailOptions = {
    from: `"HSMS" <${process.env.EMAIL_USER || "noreply@homeservice.com"}>`,
    to: email,
    subject: "Reactivate Your Account",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reactivate Your Account</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Welcome Back!</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px;">Hello <strong>${name}</strong>,</p>
            <p style="font-size: 16px;">We received a request to reactivate your account. Click the button below to confirm:</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${reactivationLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;">Reactivate My Account</a>
            </div>

            <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
            <p style="font-size: 12px; color: #666; word-break: break-all; background: #fff; padding: 10px; border-radius: 5px;">${reactivationLink}</p>

            <p style="font-size: 14px; color: #666; margin-top: 20px;">⚠️ This link will expire in <strong>1 hour</strong> for security reasons.</p>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

            <p style="font-size: 12px; color: #999;">If you didn't request to reactivate your account, please ignore this email.</p>
          </div>
          <div style="text-align: center; padding: 20px; font-size: 12px; color: #999;">
            <p>&copy; ${new Date().getFullYear()} HomeService Management. All rights reserved.</p>
          </div>
        </body>
      </html>
    `,
    text: `
Hello ${name},

We received a request to reactivate your account. Click the link below to confirm:

${reactivationLink}

This link will expire in 1 hour for security reasons.

If you didn't request to reactivate your account, please ignore this email.

© ${new Date().getFullYear()} HSMS. All rights reserved.
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(
      `[Email] Reactivation email sent to ${email}: `,
      info.messageId,
    );
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[Email] Error sending reactivation email:", error);
    return { success: false, error };
  }
};

export const sendServiceProviderReactivationMail = async (
  email: string,
  name: string,
  reactivationToken: string,
) => {
  const transporter = createTransporter();

  // Backend API URL - use environment variable or default to localhost
  const backendUrl = "http://localhost:3000";
  const reactivationLink = `${backendUrl}/service-provider/reactivate-account/${reactivationToken}`;

  const mailOptions = {
    from: `"HSMS" <${process.env.EMAIL_USER || "noreply@homeservice.com"}>`,
    to: email,
    subject: "Reactivate Your Service Provider Account",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reactivate Your Service Provider Account</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Welcome Back, Provider!</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">We missed you on our platform</p>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px;">Hello <strong>${name}</strong>,</p>
            <p style="font-size: 16px;">We received a request to reactivate your Service Provider account. Click the button below to confirm and start receiving service requests again:</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${reactivationLink}" style="display: inline-block; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;">Reactivate My Account</a>
            </div>

            <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
            <p style="font-size: 12px; color: #666; word-break: break-all; background: #fff; padding: 10px; border-radius: 5px;">${reactivationLink}</p>

            <p style="font-size: 14px; color: #666; margin-top: 20px;">⚠️ This link will expire in <strong>1 hour</strong> for security reasons.</p>

            <div style="background: #fff; padding: 20px; border-radius: 8px; margin-top: 30px; border-left: 4px solid #f5576c;">
              <p style="font-size: 14px; margin: 0; color: #555;"><strong>📌 What happens next?</strong></p>
              <ul style="font-size: 14px; color: #666; margin: 10px 0 0 20px; padding: 0;">
                <li>Your profile will be visible to customers again</li>
                <li>You'll start receiving new service requests</li>
                <li>Your previous ratings and reviews remain intact</li>
              </ul>
            </div>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

            <p style="font-size: 12px; color: #999;">If you didn't request to reactivate your account, please ignore this email or contact support if you have concerns.</p>
          </div>
          <div style="text-align: center; padding: 20px; font-size: 12px; color: #999;">
            <p>&copy; ${new Date().getFullYear()} HomeService Management. All rights reserved.</p>
          </div>
        </body>
      </html>
    `,
    text: `
Hello ${name},

We received a request to reactivate your Service Provider account. Click the link below to confirm and start receiving service requests again:

${reactivationLink}

What happens next?
- Your profile will be visible to customers again
- You'll start receiving new service requests
- Your previous ratings and reviews remain intact

This link will expire in 1 hour for security reasons.

If you didn't request to reactivate your account, please ignore this email or contact support if you have concerns.

© ${new Date().getFullYear()} HSMS. All rights reserved.
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(
      `[Email] Service Provider reactivation email sent to ${email}: `,
      info.messageId,
    );
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[Email] Error sending service provider reactivation email:", error);
    return { success: false, error };
  }
};
