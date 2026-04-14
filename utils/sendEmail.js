const { Resend } = require('resend');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// --- Configuration ---
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
const APP_NAME = 'Irorun Homes';
const BASE_URL = process.env.CLIENT_URL || 'http://localhost:8000'; 
const ADMIN_EMAIL = 'irorunhomesng@gmail.com';

let resend = null;
if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    console.error("❌ FATAL: RESEND_API_KEY or RESEND_FROM_EMAIL is missing in environment variables.");
} else {
    // Initialize Resend with API key
    resend = new Resend(RESEND_API_KEY);
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
        if (!resend) {
            console.warn(`📧 Resend API key is missing. Skipping email to: ${to}`);
            return { success: false, message: "API key not set." };
        }
        
        console.log(`📧 Sending email to: ${to} with subject: ${subject}`);
        
        const fullHtml = emailWrapper(htmlContent);

        const { data, error } = await resend.emails.send({
            from: `${APP_NAME} <${RESEND_FROM_EMAIL}>`,
            to: [to],
            subject: subject,
            html: fullHtml,
            text: text,
        });
        
        if (error) {
            console.error('❌ Error sending email via Resend API:', error);
            throw new Error(`Failed to send email: ${error.message}`);
        }
        
        console.log('✅ Email sent successfully via Resend API');
        console.log('📧 Email ID:', data?.id);
        
        return {
            success: true,
            id: data?.id,
        };
    } catch (error) {
        // Log detailed error from Resend API
        console.error('❌ Error sending email via Resend API:', error.message);
        
        // Throw a simplified error for the calling controller to handle
        throw new Error(`Failed to send email: ${error.message}`);
    }
}

/**
 * Send email to multiple recipients
 */
async function sendEmailToMultiple(
    recipients, 
    subject, 
    htmlContent, 
    text = ''
) {
    try {
        if (!resend) {
            console.warn(`📧 Resend API key is missing. Skipping emails.`);
            return { success: false, message: "API key not set." };
        }
        
        // Convert single recipient to array if needed
        const toList = Array.isArray(recipients) ? recipients : [recipients];
        
        console.log(`📧 Sending email to ${toList.length} recipients with subject: ${subject}`);
        
        const fullHtml = emailWrapper(htmlContent);

        // Resend doesn't support multiple recipients in one API call directly
        // Send individually to each recipient
        const results = [];
        for (const recipient of toList) {
            const { data, error } = await resend.emails.send({
                from: `${APP_NAME} <${RESEND_FROM_EMAIL}>`,
                to: [recipient],
                subject: subject,
                html: fullHtml,
                text: text,
            });
            
            if (error) {
                console.error(`❌ Error sending email to ${recipient}:`, error);
                results.push({ recipient, success: false, error: error.message });
            } else {
                console.log(`✅ Email sent successfully to ${recipient}`);
                results.push({ recipient, success: true, id: data?.id });
            }
        }
        
        const allSuccess = results.every(r => r.success);
        
        return {
            success: allSuccess,
            results: results,
        };
    } catch (error) {
        console.error('❌ Error sending email to multiple recipients:', error.message);
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
        throw error;
    }
};

/**
 * Send Forgot Password Email
 */
const sendForgotPasswordEmail = async (to, otp) => {
    const subject = 'Password Reset Request';
    const html = `
        <h2 style="color: #333; margin-top: 0;">Password Reset</h2>
        <p>You requested to reset your password. Your OTP is:</p>
        <div style="text-align: center; margin: 30px 0;">
            <div style="font-size: 32px; font-weight: bold; color: #013220; letter-spacing: 5px; background: #f0f0f0; padding: 15px; border-radius: 8px; display: inline-block;">
                ${otp}
            </div>
        </div>
        <p>This OTP will expire in <strong>10 minutes</strong>.</p>
        <p style="font-size: 0.9rem; color: #888;">If you didn't request this, please ignore this email.</p>
    `;
        const text = `Your ${APP_NAME} Password Reset code is: ${otp}. This code expires in 10 minutes.`;
    try {
        return await sendEmail(to, subject, html, text);
    } catch (err) {
        console.error('❌ sendForgotPasswordEmail failed:', err);
        throw err;
    }
};

/**
 * Send Welcome Email
 */
const sendWelcomeEmail = async (to, fullName) => {
    const subject = `Welcome to ${APP_NAME}!`;
    const html = `
        <h2 style="color: #333; margin-top: 0;">Welcome Aboard, ${fullName}!</h2>
        <p>We're thrilled to have you join the ${APP_NAME} community.</p>
        <p>You can now log in and start exploring apartments and properties.</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="${BASE_URL}/login"
                style="padding: 10px 20px; background-color: #013220; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;"
            >Go to Login</a>
        </div>
    `;
        const text = `Welcome to ${APP_NAME}, ${fullName}! You can now log in to your account.`;

    try {
        return await sendEmail(to, subject, html, text);
    } catch (err) {
        console.error('❌ sendWelcomeEmail failed:', err);
        throw err;
    }
};

/**
 * Send Rental Request Email (to admin and tenant)
 */
const sendRentalRequestEmail = async (tenantEmail, tenantName, propertyDetails, requestDetails) => {
    const { property, requestedMoveInDate, duration } = requestDetails;
    
    // Email to admin
    const adminSubject = `New Rental Request Received - ${APP_NAME}`;
    const adminHtml = `
        <h2 style="color: #333; margin-top: 0;">New Rental Request Received</h2>
        <p><strong>Tenant:</strong> ${tenantName} (${tenantEmail})</p>
        <p><strong>Property:</strong> ${property.title}</p>
        <p><strong>Property Address:</strong> ${property.address}, ${property.city}</p>
        <p><strong>Requested Move-in Date:</strong> ${new Date(requestedMoveInDate).toLocaleDateString()}</p>
        <p><strong>Lease Duration:</strong> ${duration || 12} months</p>
        <p><strong>Annual Rent:</strong> ₦${property.price?.toLocaleString() || 'N/A'}</p>
        <div style="margin: 30px 0; text-align: center;">
            <a href="${BASE_URL}/dashboard/super-admin/requests" 
               style="padding: 10px 20px; background-color: #013220; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                View Request in Dashboard
            </a>
        </div>
    `;
        const text = `New rental request received from ${tenantName} (${tenantEmail}) for property ${property.title}. Please review in the admin dashboard.`;

    // Email to tenant (confirmation)
    const tenantSubject = `Rental Request Received - ${property.title}`;
    const tenantHtml = `
        <h2 style="color: #333; margin-top: 0;">Thank You for Your Interest!</h2>
        <p>Dear ${tenantName},</p>
        <p>We have received your rental request for:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>${property.title}</strong></p>
            <p>📍 ${property.address}, ${property.city}</p>
            <p>📅 Move-in Date: ${new Date(requestedMoveInDate).toLocaleDateString()}</p>
            <p>⏱️ Duration: ${duration || 12} months</p>
            <p>💰 Annual Rent: ₦${property.price?.toLocaleString() || 'N/A'}</p>
        </div>
        <p>Our team will review your request and get back to you within 24-48 hours.</p>
        <p>You can track the status of your request in your dashboard.</p>
        <div style="margin: 30px 0; text-align: center;">
            <a href="${BASE_URL}/dashboard/tenant/requests" 
               style="padding: 10px 20px; background-color: #013220; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Track Your Request
            </a>
        </div>
    `;

    try {
        // Send to admin (and additional emails if needed)
        const adminRecipients = [ADMIN_EMAIL];
        
        await sendEmailToMultiple(adminRecipients, adminSubject, adminHtml, text);
        
        // Send confirmation to tenant
        await sendEmail(tenantEmail, tenantSubject, tenantHtml, text);
        
        console.log('✅ Rental request emails sent successfully');
        return { success: true };
    } catch (err) {
        console.error('❌ sendRentalRequestEmail failed:', err);
        throw err;
    }
};

/**
 * Send Payment Verification & Lease Activation Email
 */
const sendPaymentActivationEmail = async (tenantEmail, tenantName, leaseDetails) => {
    const subject = `Payment Verified & Lease Activated - ${APP_NAME}`;
    const html = `
        <h2 style="color: #333; margin-top: 0;">Payment Verified Successfully!</h2>
        <p>Dear ${tenantName},</p>
        <p>Your payment has been verified and your lease is now active.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Property:</strong> ${leaseDetails.propertyTitle}</p>
            <p><strong>Lease Start Date:</strong> ${new Date(leaseDetails.startDate).toLocaleDateString()}</p>
            <p><strong>Lease End Date:</strong> ${new Date(leaseDetails.endDate).toLocaleDateString()}</p>
            <p><strong>Lease Duration:</strong> ${leaseDetails.duration} months</p>
            <p><strong>Monthly Rent:</strong> ₦${leaseDetails.monthlyRent?.toLocaleString()}</p>
            <p><strong>Security Deposit:</strong> ₦${leaseDetails.securityDeposit?.toLocaleString()}</p>
        </div>
        
        <p>You can now access your lease details and manage your rental in your dashboard.</p>
        
        <div style="margin: 30px 0; text-align: center;">
            <a href="${BASE_URL}/dashboard/tenant/leases" 
               style="padding: 10px 20px; background-color: #013220; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                View Your Lease
            </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">Thank you for choosing ${APP_NAME}!</p>
    `;

    const text = `Payment Verified Successfully! Your lease for ${leaseDetails.propertyTitle} is now active.`;

    try {
        // Send to tenant
        await sendEmail(tenantEmail, subject, html, text);
        
        // Also notify admin
        const adminSubject = `Lease Activated - ${leaseDetails.propertyTitle}`;
        const adminHtml = `
            <h2 style="color: #333; margin-top: 0;">Lease Activated</h2>
            <p>Lease has been activated for:</p>
            <p><strong>Tenant:</strong> ${tenantName} (${tenantEmail})</p>
            <p><strong>Property:</strong> ${leaseDetails.propertyTitle}</p>
            <p><strong>Start Date:</strong> ${new Date(leaseDetails.startDate).toLocaleDateString()}</p>
            <p><strong>End Date:</strong> ${new Date(leaseDetails.endDate).toLocaleDateString()}</p>
        `;
        const adminText = `Lease activated for tenant ${tenantName} (${tenantEmail}) for property ${leaseDetails.propertyTitle}. Start Date: ${new Date(leaseDetails.startDate).toLocaleDateString()}, End Date: ${new Date(leaseDetails.endDate).toLocaleDateString()}`;
        
        await sendEmail(ADMIN_EMAIL, adminSubject, adminHtml, adminText);
        
        console.log('✅ Payment activation emails sent successfully');
        return { success: true };
    } catch (error) {
        console.error('❌ sendPaymentActivationEmail failed:', error);
        throw error;
    }
};


/**
 * Send email notification when a rental request is approved
 */
const sendRequestApprovedEmail = async (tenantEmail, tenantName, property, request) => {
    // Make sure property and request have all required fields
    if (!property || !request) {
        console.error('Missing property or request data for email');
        return;
    }

    const subject = `✅ Rental Request Approved - ${property.title || 'Property'}`;
    
    // Ensure all values exist before using them
    const propertyTitle = property.title || 'Property';
    const propertyAddress = property.address || 'Address not available';
    const propertyCity = property.city || '';
    const propertyPrice = property.price ? `₦${property.price.toLocaleString()}` : 'N/A';
    const moveInDate = request.requestedMoveInDate ? new Date(request.requestedMoveInDate).toLocaleDateString() : 'TBD';
    const duration = request.duration || 12;
    
    const html = `
        <h2 style="color: #333; margin-top: 0;">Great News! Your Rental Request Has Been Approved 🎉</h2>
        
        <p>Dear <strong>${tenantName}</strong>,</p>
        
        <p>We are pleased to inform you that your rental request for the following property has been <strong style="color: #28a745;">APPROVED</strong>!</p>
        
        <div style="background-color: #f0f9f0; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #28a745;">
            <h3 style="color: #013220; margin-top: 0; margin-bottom: 15px;">🏠 Property Details</h3>
            <p><strong>Property:</strong> ${propertyTitle}</p>
            <p><strong>Address:</strong> ${propertyAddress}${propertyCity ? `, ${propertyCity}` : ''}</p>
            <p><strong>Annual Rent:</strong> ${propertyPrice}</p>
            <p><strong>Move-in Date:</strong> ${moveInDate}</p>
            <p><strong>Lease Duration:</strong> ${duration} months</p>
        </div>
        
        <div style="background-color: #e7f3ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>📝 Admin Response:</strong></p>
            <p style="margin-top: 5px;">${request.adminResponse || 'Please proceed with payment to activate your lease.'}</p>
        </div>
        
        <p><strong>Next Steps:</strong></p>
        <ol style="margin-bottom: 25px;">
            <li>Make payment for the property (annual rent + security deposit)</li>
            <li>Upload your payment receipt using the button below</li>
            <li>Wait for admin verification (usually within 24-48 hours)</li>
            <li>Once verified, your lease will be activated immediately</li>
        </ol>
        
        <div style="margin: 30px 0; text-align: center;">
            <a href="${process.env.CLIENT_URL}/dashboard/tenant/requests/${request._id}/payments" 
               style="padding: 12px 25px; background-color: #013220; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                💳 Upload Payment Receipt
            </a>
        </div>
        
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
        
        <p style="color: #888; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} Irorun Homes. All rights reserved.
        </p>
    `;

    const text = `Congratulations ${tenantName}! Your rental request for ${propertyTitle} has been approved. Please proceed with payment to activate your lease.`;

    // Verify html is not empty
    if (!html || html.trim().length === 0) {
        throw new Error('Email HTML content is empty');
    }

    try {
        await sendEmail(tenantEmail, subject, html, text);
        console.log(`✅ Request approved email sent to ${tenantEmail}`);
    } catch (error) {
        console.error('❌ Error sending approval email:', error);
        throw error;
    }
};

/**
 * Send email notification when a rental request is rejected
 */
const sendRequestRejectedEmail = async (tenantEmail, tenantName, property, request) => {
    const subject = `📋 Rental Request Update - ${property.title}`;
    
    const html = `
        <h2 style="color: #333; margin-top: 0;">Update on Your Rental Request</h2>
        
        <p>Dear <strong>${tenantName}</strong>,</p>
        
        <p>Regarding your request for <strong>${property.title}</strong>:</p>
        
        <div style="background-color: #fff3f3; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #dc3545;">
            <h3 style="color: #721c24; margin-top: 0;">Status: Not Approved</h3>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>📝 Reason:</strong></p>
            <p style="margin-top: 5px;">${request.adminResponse || 'Your request was not approved at this time. This could be due to the property being no longer available or other applicants being selected.'}</p>
        </div>
        
        <p>Don't be discouraged! There are many other great properties available on our platform.</p>
        
        <div style="margin: 30px 0; text-align: center;">
            <a href="${BASE_URL}/properties" 
               style="padding: 12px 25px; background-color: #013220; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                🔍 Browse Other Properties
            </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">If you have any questions about this decision, please contact our support team.</p>
        
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
        
        <p style="color: #888; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
        </p>
    `;

    const text = `Dear ${tenantName}, your rental request for ${property.title} was not approved. Reason: ${request.adminResponse || 'No reason provided'}. Please check our platform for other available properties.`;

    try {
        await sendEmail(tenantEmail, subject, html, text);
        console.log(`✅ Request rejected email sent to ${tenantEmail}`);
        
        // Notify admin about the rejection
        const adminSubject = `Request Rejected - ${property.title}`;
        const adminHtml = `
            <h2 style="color: #333; margin-top: 0;">Rental Request Rejected</h2>
            <p>You have rejected the rental request for:</p>
            <ul>
                <li><strong>Tenant:</strong> ${tenantName} (${tenantEmail})</li>
                <li><strong>Property:</strong> ${property.title}</li>
                <li><strong>Reason:</strong> ${request.adminResponse || 'No reason provided'}</li>
            </ul>
        `;
        
        await sendEmail(ADMIN_EMAIL, adminSubject, adminHtml);
        
        return { success: true };
    } catch (error) {
        console.error('❌ Error sending rejection email:', error);
        throw error;
    }
};

/**
 * Send email notification when payment is verified and lease activated
 */
const sendPaymentVerifiedEmail = async (tenantEmail, tenantName, property, leaseDetails) => {
    const subject = `✅ Payment Verified & Lease Activated - ${property.title}`;
    
    const monthlyRent = leaseDetails.monthlyRent || property.price;
    const securityDeposit = leaseDetails.securityDeposit || property.price * 2;
    const startDate = leaseDetails.startDate || leaseDetails.requestedMoveInDate;
    const endDate = leaseDetails.endDate || new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + (leaseDetails.duration || 12)));
    
    const html = `
        <h2 style="color: #333; margin-top: 0;">Payment Verified Successfully! 🎉</h2>
        
        <p>Dear <strong>${tenantName}</strong>,</p>
        
        <p>Great news! Your payment has been verified and your lease is now <strong style="color: #28a745;">ACTIVE</strong>.</p>
        
        <div style="background-color: #f0f9f0; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #28a745;">
            <h3 style="color: #013220; margin-top: 0; margin-bottom: 15px;">📋 Lease Summary</h3>
            
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0;"><strong>Property:</strong></td>
                    <td style="padding: 8px 0;">${property.title}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0;"><strong>Address:</strong></td>
                    <td style="padding: 8px 0;">${property.address}, ${property.city}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0;"><strong>Lease Start Date:</strong></td>
                    <td style="padding: 8px 0;">${new Date(startDate).toLocaleDateString()}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0;"><strong>Lease End Date:</strong></td>
                    <td style="padding: 8px 0;">${new Date(endDate).toLocaleDateString()}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0;"><strong>Lease Duration:</strong></td>
                    <td style="padding: 8px 0;">${leaseDetails.duration || 12} months</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0;"><strong>Monthly Rent:</strong></td>
                    <td style="padding: 8px 0;">₦${monthlyRent.toLocaleString()}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0;"><strong>Security Deposit:</strong></td>
                    <td style="padding: 8px 0;">₦${securityDeposit.toLocaleString()}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0;"><strong>Total Paid:</strong></td>
                    <td style="padding: 8px 0;">₦${(monthlyRent * (leaseDetails.duration || 12) + securityDeposit).toLocaleString()}</td>
                </tr>
            </table>
        </div>
        
        <p><strong>What's Next?</strong></p>
        <ul style="margin-bottom: 25px;">
            <li>You can now access your full lease details in your dashboard</li>
            <li>Your landlord/agent will contact you to arrange key collection</li>
            <li>Review your lease terms and conditions carefully</li>
            <li>Set up auto-renewal preferences if desired</li>
        </ul>
        
        <div style="margin: 30px 0; text-align: center;">
            <a href="${BASE_URL}/dashboard/tenant/leases/${leaseDetails._id}" 
               style="padding: 12px 25px; background-color: #013220; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                📄 View Your Lease
            </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">Welcome to your new home! If you have any questions, please contact your property manager.</p>
        
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
        
        <p style="color: #888; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
        </p>
    `;

    const text = `Congratulations ${tenantName}! Your payment has been verified and your lease for ${property.title} is now active. Please check your dashboard for lease details.`;

    try {
        await sendEmail(tenantEmail, subject, html, text);
        console.log(`✅ Payment verified email sent to ${tenantEmail}`);
        
        // Notify admin about the activation
        const adminSubject = `Lease Activated - ${property.title}`;
        const adminHtml = `
            <h2 style="color: #333; margin-top: 0;">Lease Activated</h2>
            <p>Lease has been activated for:</p>
            <ul>
                <li><strong>Tenant:</strong> ${tenantName} (${tenantEmail})</li>
                <li><strong>Property:</strong> ${property.title}</li>
                <li><strong>Start Date:</strong> ${new Date(startDate).toLocaleDateString()}</li>
                <li><strong>End Date:</strong> ${new Date(endDate).toLocaleDateString()}</li>
            </ul>
        `;

        const adminText = `Lease activated for tenant ${tenantName} (${tenantEmail}) for property ${property.title}. Start Date: ${new Date(startDate).toLocaleDateString()}, End Date: ${new Date(endDate).toLocaleDateString()}`;
        
        await sendEmail(ADMIN_EMAIL, adminSubject, adminHtml, adminText);
        
        return { success: true };
    } catch (error) {
        console.error('❌ Error sending payment verification email:', error);
        throw error;
    }
};

/**
 * Send lease renewal notification
 */
const sendLeaseRenewalEmail = async (tenantEmail, tenantName, property, lease) => {
    const subject = `⚠️ Lease Expiring Soon - ${property.title}`;
    
    const endDate = new Date(lease.leaseInfo.endDate);
    const daysLeft = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));
    
    const html = `
        <h2 style="color: #333; margin-top: 0;">Your Lease is Expiring Soon</h2>
        
        <p>Dear <strong>${tenantName}</strong>,</p>
        
        <p>This is a friendly reminder that your lease for <strong>${property.title}</strong> is expiring in <strong style="color: #dc3545;">${daysLeft} days</strong>.</p>
        
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ffc107;">
            <p><strong>Current Lease End Date:</strong> ${endDate.toLocaleDateString()}</p>
            <p><strong>Days Remaining:</strong> ${daysLeft}</p>
        </div>
        
        <p><strong>What are your options?</strong></p>
        <ul style="margin-bottom: 25px;">
            <li><strong>Renew your lease</strong> - Continue renting with the same terms or negotiate new ones</li>
            <li><strong>Set auto-renewal</strong> - Enable auto-renewal in your dashboard to automatically renew</li>
            <li><strong>Move out</strong> - If you plan to move out, please notify us at least 30 days in advance</li>
        </ul>
        
        <div style="margin: 30px 0; text-align: center;">
            <a href="${BASE_URL}/dashboard/tenant/leases/${lease._id}/renew" 
               style="padding: 12px 25px; background-color: #013220; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin-right: 10px;">
                🔄 Review Renewal Options
            </a>
            <a href="${BASE_URL}/dashboard/tenant/leases/${lease._id}" 
               style="padding: 12px 25px; background-color: #6c757d; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                📄 View Lease Details
            </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">If you have already made arrangements for renewal, please disregard this message.</p>
        
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
        
        <p style="color: #888; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
        </p>
    `;

    const text = `Dear ${tenantName}, your lease for ${property.title} is expiring in ${daysLeft} days. Please review your renewal options in your dashboard.`;

    try {
        await sendEmail(tenantEmail, subject, html, text);
        console.log(`✅ Lease renewal email sent to ${tenantEmail}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Error sending lease renewal email:', error);
        throw error;
    }
};

/**
 * Send lease auto-renewed notification
 */
const sendLeaseAutoRenewedEmail = async (tenantEmail, tenantName, property, lease, newEndDate) => {
    const subject = `🔄 Lease Auto-Renewed - ${property.title}`;
    
    const html = `
        <h2 style="color: #333; margin-top: 0;">Your Lease Has Been Auto-Renewed</h2>
        
        <p>Dear <strong>${tenantName}</strong>,</p>
        
        <p>Your lease for <strong>${property.title}</strong> has been automatically renewed for another year based on your auto-renewal preference.</p>
        
        <div style="background-color: #e7f3ff; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h3 style="color: #013220; margin-top: 0;">Updated Lease Terms</h3>
            <p><strong>New End Date:</strong> ${new Date(newEndDate).toLocaleDateString()}</p>
            <p><strong>Monthly Rent:</strong> ₦${lease.leaseInfo.monthlyRent?.toLocaleString() || property.price?.toLocaleString()}</p>
            <p><strong>Duration:</strong> Additional 12 months</p>
        </div>
        
        <p>If you did not intend to renew or have questions about your lease, please contact our support team immediately.</p>
        
        <div style="margin: 30px 0; text-align: center;">
            <a href="${BASE_URL}/dashboard/tenant/leases/${lease._id}" 
               style="padding: 12px 25px; background-color: #013220; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                📄 View Updated Lease
            </a>
        </div>
        
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
        
        <p style="color: #888; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
        </p>
    `;

    const text = `Dear ${tenantName}, your lease for ${property.title} has been auto-renewed. New end date: ${new Date(newEndDate).toLocaleDateString()}. Please check your dashboard for details.`;

    try {
        await sendEmail(tenantEmail, subject, html, text);
        console.log(`✅ Lease auto-renewed email sent to ${tenantEmail}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Error sending lease auto-renewed email:', error);
        throw error;
    }
};

/**
 * Send lease expired notification
 */
const sendLeaseExpiredEmail = async (tenantEmail, tenantName, property, lease) => {
    const subject = `⚠️ Lease Expired - ${property.title}`;
    
    const html = `
        <h2 style="color: #333; margin-top: 0;">Your Lease Has Expired</h2>
        
        <p>Dear <strong>${tenantName}</strong>,</p>
        
        <p>Your lease for <strong>${property.title}</strong> expired on <strong>${new Date(lease.leaseInfo.endDate).toLocaleDateString()}</strong>.</p>
        
        <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #dc3545;">
            <p><strong>Important Actions Required:</strong></p>
            <ul style="margin-bottom: 0;">
                <li>Please vacate the property within the timeframe specified in your lease</li>
                <li>Arrange for return of your security deposit</li>
                <li>Schedule a final inspection with your landlord/agent</li>
            </ul>
        </div>
        
        <p>If you believe this is an error or have already made arrangements for renewal, please contact us immediately.</p>
        
        <div style="margin: 30px 0; text-align: center;">
            <a href="${BASE_URL}/contact" 
               style="padding: 12px 25px; background-color: #013220; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                📞 Contact Support
            </a>
        </div>
        
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
        
        <p style="color: #888; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
        </p>
    `;

    const text = `Dear ${tenantName}, your lease for ${property.title} has expired on ${new Date(lease.leaseInfo.endDate).toLocaleDateString()}. Please vacate the property and contact support if you have questions.`;

    try {
        await sendEmail(tenantEmail, subject, html, text);
        console.log(`✅ Lease expired email sent to ${tenantEmail}`);
        
        // Notify admin
        const adminSubject = `Lease Expired - ${property.title}`;
        const adminHtml = `
            <h2 style="color: #333; margin-top: 0;">Lease Expired</h2>
            <p>Lease has expired for:</p>
            <ul>
                <li><strong>Tenant:</strong> ${tenantName} (${tenantEmail})</li>
                <li><strong>Property:</strong> ${property.title}</li>
                <li><strong>Expiry Date:</strong> ${new Date(lease.leaseInfo.endDate).toLocaleDateString()}</li>
            </ul>
            <p>The property has been marked as available.</p>
        `;

        const adminText = `Lease expired for tenant ${tenantName} (${tenantEmail}) for property ${property.title}. Expiry Date: ${new Date(lease.leaseInfo.endDate).toLocaleDateString()}. Property marked as available.`;
        
        await sendEmail(ADMIN_EMAIL, adminSubject, adminHtml, adminText);
        
        return { success: true };
    } catch (error) {
        console.error('❌ Error sending lease expired email:', error);
        throw error;
    }
};

module.exports = {
    sendEmail,
    sendEmailToMultiple,
    sendOTPEmail,
    sendForgotPasswordEmail,
    sendWelcomeEmail,
    sendRentalRequestEmail,
    sendPaymentActivationEmail,
    sendLeaseRenewalEmail,
    sendRequestApprovedEmail,
    sendRequestRejectedEmail,
    sendPaymentVerifiedEmail,
    sendLeaseAutoRenewedEmail,
    sendLeaseExpiredEmail,
    ADMIN_EMAIL
};