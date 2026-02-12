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
  const backendUrl = process.env.BACKEND_URL || "http://localhost:9000";
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
  const backendUrl = process.env.BACKEND_URL || "http://localhost:9000";
  const reactivationLink = `${backendUrl}/serviceProvider/reactivate-account/${reactivationToken}`;

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
            <p>&copy; ${new Date().getFullYear()} HSMS. All rights reserved.</p>
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

export const sendServiceProviderSuspensionMail = async (
  email: string,
  name: string,
  suspensionReason: string,
) => {
  const transporter = createTransporter();

  // Support email - use environment variable or default
  const supportEmail = process.env.SUPPORT_EMAIL || "support@homeservice.com";

  const mailOptions = {
    from: `"HSMS" <${process.env.EMAIL_USER || "noreply@homeservice.com"}>`,
    to: email,
    subject: "Your Service Provider Account Has Been Suspended",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Account Suspension Notice</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">⚠️ Account Suspended</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Important Notice Regarding Your Account</p>
          </div>

          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px;">Hello <strong>${name}</strong>,</p>
            <p style="font-size: 16px;">We are writing to inform you that your Service Provider account has been <strong style="color: #ee5a24;">suspended</strong> due to a violation of our platform policies.</p>

            <div style="background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ee5a24;">
              <p style="font-size: 14px; margin: 0 0 10px 0; color: #555;"><strong>📌 Reason for Suspension:</strong></p>
              <p style="font-size: 14px; margin: 0; color: #666; font-style: italic;">"${suspensionReason}"</p>
            </div>

            <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <p style="font-size: 14px; margin: 0 0 10px 0; color: #856404;"><strong>⚠️ What This Means:</strong></p>
              <ul style="font-size: 14px; color: #856404; margin: 10px 0 0 20px; padding: 0;">
                <li>Your profile is no longer visible to customers</li>
                <li>You will not receive new service requests</li>
                <li>Existing customers can still view your profile</li>
                <li>Your previous ratings and reviews remain visible</li>
              </ul>
            </div>

            <div style="background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #17a2b8;">
              <p style="font-size: 14px; margin: 0 0 10px 0; color: #555;"><strong>📧 Next Steps:</strong></p>
              <ul style="font-size: 14px; color: #666; margin: 10px 0 0 20px; padding: 0;">
                <li>If you believe this is an error, contact our support team</li>
                <li>Provide any relevant information or evidence for review</li>
                <li>We will review your case and respond within 3-5 business days</li>
              </ul>
            </div>

            <p style="font-size: 16px; margin: 30px 0 20px 0;">Need help? Contact our support team:</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="mailto:${supportEmail}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;">Contact Support</a>
            </div>

            <p style="font-size: 14px; color: #666; text-align: center;">Or email us at: <a href="mailto:${supportEmail}" style="color: #667eea; text-decoration: none;">${supportEmail}</a></p>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

            <p style="font-size: 12px; color: #999;">We value your partnership and hope to resolve this matter quickly.</p>
          </div>

          <div style="text-align: center; padding: 20px; font-size: 12px; color: #999;">
            <p>&copy; ${new Date().getFullYear()} HomeService Management. All rights reserved.</p>
          </div>
        </body>
      </html>
    `,
    text: `
Hello ${name},

We are writing to inform you that your Service Provider account has been SUSPENDED due to a violation of our platform policies.

REASON FOR SUSPENSION:
"${suspensionReason}"

WHAT THIS MEANS:
- Your profile is no longer visible to customers
- You will not receive new service requests
- Existing customers can still view your profile
- Your previous ratings and reviews remain visible

NEXT STEPS:
If you believe this is an error, contact our support team at ${supportEmail}
Provide any relevant information or evidence for review
We will review your case and respond within 3-5 business days

We value your partnership and hope to resolve this matter quickly.

© ${new Date().getFullYear()} HSMS. All rights reserved.
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(
      `[Email] Suspension email sent to ${email}: `,
      info.messageId,
    );
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[Email] Error sending suspension email:", error);
    return { success: false, error };
  }
};

export const sendServiceProviderUnsuspensionMail = async (
  email: string,
  name: string,
) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"HSMS" <${process.env.EMAIL_USER || "noreply@homeservice.com"}>`,
    to: email,
    subject: "Your Service Provider Account Has Been Reactivated",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Account Reactivated</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #26de81 0%, #20bf6b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">✅ Welcome Back!</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Your Account Has Been Reactivated</p>
          </div>

          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px;">Hello <strong>${name}</strong>,</p>
            <p style="font-size: 16px;">Great news! Your Service Provider account has been <strong style="color: #20bf6b;">reactivated</strong> and you can now start receiving service requests again.</p>

            <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
              <p style="font-size: 14px; margin: 0 0 10px 0; color: #155724;"><strong>✅ What Happens Next:</strong></p>
              <ul style="font-size: 14px; color: #155724; margin: 10px 0 0 20px; padding: 0;">
                <li>Your profile is now visible to customers again</li>
                <li>You'll start receiving new service requests immediately</li>
                <li>Your previous ratings and reviews remain intact</li>
                <li>All your account features have been fully restored</li>
              </ul>
            </div>

            <div style="background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
              <p style="font-size: 14px; margin: 0 0 10px 0; color: #555;"><strong>💡 Tips to Maintain Your Account:</strong></p>
              <ul style="font-size: 14px; color: #666; margin: 10px 0 0 20px; padding: 0;">
                <li>Provide excellent service to maintain good ratings</li>
                <li>Respond to service requests promptly</li>
                <li>Follow our platform policies and guidelines</li>
                <li>Keep your profile information up to date</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <p style="font-size: 16px; margin: 0 0 20px 0;">Ready to get started? Log in to your dashboard now!</p>
              <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/provider/dashboard" style="display: inline-block; background: linear-gradient(135deg, #26de81 0%, #20bf6b 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;">Go to Dashboard</a>
            </div>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

            <p style="font-size: 14px; color: #666;">If you have any questions or need assistance, feel free to reach out to our support team.</p>
            <p style="font-size: 12px; color: #999; margin-top: 20px;">We're excited to have you back on our platform!</p>
          </div>

          <div style="text-align: center; padding: 20px; font-size: 12px; color: #999;">
            <p>&copy; ${new Date().getFullYear()} HomeService Management. All rights reserved.</p>
          </div>
        </body>
      </html>
    `,
    text: `
Hello ${name},

Great news! Your Service Provider account has been REACTIVATED and you can now start receiving service requests again.

WHAT HAPPENS NEXT:
- Your profile is now visible to customers again
- You'll start receiving new service requests immediately
- Your previous ratings and reviews remain intact
- All your account features have been fully restored

TIPS TO MAINTAIN YOUR ACCOUNT:
- Provide excellent service to maintain good ratings
- Respond to service requests promptly
- Follow our platform policies and guidelines
- Keep your profile information up to date

Log in to your dashboard: ${process.env.FRONTEND_URL || "http://localhost:3000"}/serviceProvider/login

If you have any questions or need assistance, feel free to reach out to our support team.

We're excited to have you back on our platform!

© ${new Date().getFullYear()} HSMS. All rights reserved.
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(
      `[Email] Unsuspension email sent to ${email}: `,
      info.messageId,
    );
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[Email] Error sending unsuspension email:", error);
    return { success: false, error };
  }
};
