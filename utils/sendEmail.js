const sgMail = require('@sendgrid/mail');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();


// --- Configuration ---
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL;
const APP_NAME = 'SackAgent';
const BASE_URL = process.env.CLIENT_URL || 'http://localhost:8000'; 

if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL) {
    console.error("❌ FATAL: SENDGRID_API_KEY or SENDGRID_FROM_EMAIL is missing in environment variables.");
} else {
    // SendGrid with API key
    sgMail.setApiKey(SENDGRID_API_KEY);
}

// --- Email Templates ---

// Email wrapper for consistent branding
const emailWrapper = (content) => `
    <div style="font-family: sans-serif; line-height: 1.5; color: #333; background-color: #f7f7f7; padding: 20px;">
        <div style="padding: 1rem; border: 1px solid #eee; border-radius: 8px; max-width: 600px; margin: 20px auto; background-color: #ffffff; box-shadow: 0 4px 8px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #eee;">
                <h2 style="color: #013220; margin: 0;">${APP_NAME}</h2>
            </div>
            ${content}
            <hr style="margin: 2rem 0; border: none; border-top: 1px solid #ddd;" />
            <p style="font-size: 0.9rem; color: #888; text-align: center;">If you didn't request this email, you can safely ignore it.</p>
        </div>
    </div>
`;

// --- Sending Function ---
async function sendEmail(
    to, 
    subject, 
    htmlContent, 
    text = ''
) {
    try {
        if (!SENDGRID_API_KEY) {
            console.warn(`📧 SendGrid API key is missing. Skipping email to: ${to}`);
            return { success: false, message: "API key not set." };
        }
        
        console.log(`📧 Sending email to: ${to} with subject: ${subject}`);
        
        const fullHtml = emailWrapper(htmlContent);

        const msg = {
            to: to,
            from: {
                name: APP_NAME,
                email: SENDGRID_FROM_EMAIL
            },
            subject: subject,
            text: text,
            html: fullHtml,
        };

        // Note: sgMail.send() returns a promise that resolves to an array of results
        const [response] = await sgMail.send(msg);
        
        console.log('✅ Email sent successfully via SendGrid API');
        console.log('📧 Status Code:', response.statusCode);
        
        return {
            success: true,
            statusCode: response.statusCode,
        };
    } catch (error) {
        // Log detailed error from SendGrid API
        console.error('❌ Error sending email via SendGrid API:', error.message);
        
        if (error.response) {
            console.error('SendGrid API Response Body:', error.response.body);
        }
        
        // Throw a simplified error for the calling controller to handle
        throw new Error(`Failed to send email: ${error.message}`);
    }
}


// --- Helper Functions ---

/**
 * Send OTP / Account Verification Email
 */
const sendOTPEmail = async (to, otp) => {
    const subject = `Your Verification Code - ${APP_NAME}`;
    const html = `
        <h2 style="color: #333; margin-top: 0;">Email Verification Required</h2>
        <p>Hello,</p>
        <p>Your verification code for ${APP_NAME} is:</p>
        <div style="text-align: center; margin: 30px 0;">
            <div style="font-size: 32px; font-weight: bold; color: #013220; letter-spacing: 5px; background: #f0f0f0; padding: 15px; border-radius: 8px; display: inline-block;">
                ${otp}
            </div>
        </div>
        <p>This code will expire in <strong>10 minutes</strong>.</p>
        <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
    `;

    const text = `Your ${APP_NAME} verification code is: ${otp}. This code expires in 10 minutes.`;

    try {
        return await sendEmail(to, subject, html, text);
    } catch (error) {
        console.error('❌ sendVerificationEmail failed:', error);
        throw error; // Re-throw the error for the controller to handle
    }
};

/**
 * Send Forgot Password Email
 */
const sendForgotPasswordEmail = async (to, resetLink) => {
    const subject = 'Password Reset Request';
    const html = `
        <h2 style="color: #333; margin-top: 0;">Password Reset</h2>
        <p>You requested to reset your password. Click the link below:</p>
        <div style="margin: 20px 0;">
             <a href="${resetLink}" 
                style="padding: 10px 20px; background-color: #013220; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;" 
                target="_blank"
             >Reset My Password</a>
        </div>
        <p style="font-size: 0.9rem; color: #888;">If the button above does not work, copy and paste the following link into your browser:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
    `;
    
    try {
        // Corrected call signature to match sendEmail(to, subject, html)
        return await sendEmail(to, subject, html);
    } catch (err) {
        console.error('❌ sendForgotPasswordEmail failed:', err);
        throw err;
    }
};

/**
 * Send Welcome Email
 */
 const sendWelcomeEmail = async (to, name) => {
    const subject = `Welcome to ${APP_NAME}!`;
    const html = `
        <h2 style="color: #333; margin-top: 0;">Welcome Aboard, ${name}!</h2>
        <p>We're thrilled to have you join the ${APP_NAME} community.</p>
        <p>You can now log in and start exploring appartments and properties.</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="${BASE_URL}/login"
                style="padding: 10px 20px; background-color: #013220; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;"
            >Go to Login</a>
        </div>
    `;
    
    try {
        // Corrected call signature to match sendEmail(to, subject, html)
        return await sendEmail(to, subject, html);
    } catch (err) {
        console.error('❌ sendWelcomeEmail failed:', err);
        throw err;
    }
};


 const rentalRequestEmail = async (to, name) => {
    const subject = `New Rental Request Received ${name}!`;
    const html = `
        <h3>New Rental Request</h3>
        <p>Property: ${property.title}</p>
        <p>Tenant: ${req.user.fullName || req.user.email}</p>
        <p>Requested Move-in: ${new Date(requestedMoveInDate).toLocaleDateString()}</p>
        <p>Duration: ${duration || 12} months</p>
    `;
    
    try {
        // Corrected call signature to match sendEmail(to, subject, html)
        return await sendEmail(to, subject, html);
    } catch (err) {
        console.error('❌ sendWelcomeEmail failed:', err);
        throw err;
    }
};


module.exports = {
    sendEmail,
    rentalRequestEmail,
    sendOTPEmail,
    sendForgotPasswordEmail,
    sendWelcomeEmail,
};



// // mailService.js
// import nodemailer from 'nodemailer';
// import dotenv from 'dotenv';

// dotenv.config();

// // Email wrapper for consistent branding
// const emailWrapper = (content) => `
//   <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
//     <div style="padding: 1rem; border: 1px solid #eee; border-radius: 8px; max-width: 600px; margin: auto;">
//       <div style="text-align: center; margin-bottom: 1rem;">
//         <img src="https://yourdomain.com/logo.png" alt="Company Logo" style="height: 50px;" />
//         <h2 style="color: #0057B7;">Property Guru platform</h2>
//       </div>
//       ${content}
//       <hr style="margin: 2rem 0;" />
//       <p style="font-size: 0.9rem; color: #888;">If you didn't request this email, you can safely ignore it.</p>
//     </div>
//   </div>
// `;

// /**
//  * Create a single transporter
//  * – use Gmail with app password or your own SMTP host
//  */
// const transporter = nodemailer.createTransport({
//   service: 'gmail', // or configure host/port manually
//   auth: {
//     user: process.env.EMAIL,
//     pass: process.env.EMAIL_PASSWORD,
//   },
//   tls: {
//     // ⚠️ Dev only – disables certificate check for self-signed certs
//     rejectUnauthorized: false,
//   },
// });

// /**
//  * Generic send email
//  */
// export const sendEmail = async ({ email, subject, html }) => {
//   try {
//     const info = await transporter.sendMail({
//       from: `"${process.env.EMAIL}" <${process.env.EMAIL}>`, // correct from
//       to: email,
//       subject,
//       html,
//     });
//     console.log('✅ Email sent:', info.messageId);
//     return info;
//   } catch (err) {
//     console.error('❌ sendEmail error:', err);
//     throw err;
//   }
// };

// /**
//  * Send OTP / Account Verification Email
//  */
// export const sendOTPEmail = async (email, subject, otp) => {
//   try {
//      const html = emailWrapper(`
//     <p>Hello,</p>
//     <p>Your OTP for verification is:</p>
//     <h2>${otp}</h2>
//     <p>This OTP will expire in 10 minutes.</p>
//   `);
//     await sendEmail({
//       email,
//       subject,
//       html,
//     });
//   } catch (err) {
//     console.error('❌ sendOTPEmail error:', err);
//   }
// };

// /**
//  * Send Forgot Password Email
//  */
// export const sendForgotPasswordEmail = async (email, resetLink) => {
//   try {
//     const html = `
//       <h1>Password Reset</h1>
//       <p>You requested to reset your password. Click the link below:</p>
//       <a href="${resetLink}" target="_blank">${resetLink}</a>
//     `;
//     await sendEmail({ email, subject: 'Password Reset Request', html });
//   } catch (err) {
//     console.error('❌ sendForgotPasswordEmail error:', err);
//   }
// };

// /**
//  * Send Welcome / Receipt / Notification Email
//  */
// export const sendWelcomeEmail = async (email, name) => {
//   try {
//     const html = `
//       <h1>Welcome ${name}!</h1>
//       <p>Thanks for joining ${process.env.EMAIL}. We’re glad to have you.</p>
//     `;
//     await sendEmail({
//       email,
//       subject: `Welcome to ${process.env.APP_NAME}`,
//       html,
//     });
//   } catch (err) {
//     console.error('❌ sendWelcomeEmail error:', err);
//   }
// };
