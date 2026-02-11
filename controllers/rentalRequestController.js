
const RentalRequest = require('../models/rentalRequestModel');
const Property = require('../models/propertyModel');
const History = require('../models/historyModel');
const cloudinary = require('../utils/cloudinary');
const { sendEmail, rentalRequestEmail } = require('../utils/sendEmail');
const User = require('../models/userModel');
const cron = require('node-cron');


// Tenant requests a property
const handleRequestProperty = async (req, res) => {
    try {
        // Get propertyId from URL params, not body
        const { propertyId } = req.params;
        const { fullName, message, requestedMoveInDate, duration } = req.body;
        const tenantId = req.user._id;

        // Validate required fields
        if (!propertyId) {
            return res.status(400).json({ 
                success: false, 
                message: "Property ID is required" 
            });
        }

        if (!message || !requestedMoveInDate) {
            return res.status(400).json({ 
                success: false, 
                message: "Message and move-in date are required" 
            });
        }

        // Check if property exists
        const property = await Property.findById(propertyId);
        if (!property) {
            return res.status(404).json({ 
                success: false, 
                message: "Property not found" 
            });
        }

        // Check if property is available
        if (property.status !== 'available') {
            return res.status(400).json({ 
                success: false, 
                message: "Property is not available for rent" 
            });
        }

        const name = await User.findOne({fullName: fullName})

        // Check if tenant already has a pending request
        const existingRequest = await RentalRequest.findOne({
            property: propertyId,
            tenant: tenantId,
            status: { $in: ['pending', 'approved'] }
        });

        if (existingRequest) {
            return res.status(400).json({ 
                success: false, 
                message: "You already have a pending or approved request for this property" 
            });
        }

        // Create rental request
        const rentalRequest = new RentalRequest({
            property: propertyId,
            tenant: tenantId,
            message,
            requestedMoveInDate: new Date(requestedMoveInDate),
            duration: duration || 12,
            status: 'pending'
        });

        await rentalRequest.save();

        // Log history
        const history = new History({
            action: "requestProperty",
            userId: tenantId,
            propertyId: propertyId,
            requestId: rentalRequest._id,
            notes: message.substring(0, 50) + '...'
        });
        await history.save();

        try {
                await rentalRequestEmail(email, name);
                } catch (emailError) {
                    console.error('Email sending failed:', emailError.message);
        }

        res.status(201).json({
            success: true,
            message: "Rental request submitted successfully",
            request: rentalRequest
        });

    } catch (error) {
        console.error("Error submitting rental request:", error);
        res.status(500).json({ 
            success: false, 
            message: error.message || "Failed to submit rental request"
        });
    }
};



// Get single rental request
const HandleGetARequest = async (req, res) => {
  try {
    const request = await RentalRequest.findOne({
      _id: req.params.id,
      tenant: req.user._id
    }).populate('property', 'title address city price media images');

    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: "Request not found" 
      });
    }

    res.json({
      success: true,
      request
    });
  } catch (error) {
    console.error("Error fetching rental request:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Cancel rental request
const HandleCancelRequest = async (req, res) => {
  try {
    const request = await RentalRequest.findOne({
      _id: req.params.id,
      tenant: req.user._id
    });

    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: 'Request not found' 
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only pending requests can be cancelled' 
      });
    }

    request.status = 'cancelled';
    await request.save();

    res.json({
      success: true,
      message: 'Request cancelled successfully',
      request
    });
  } catch (error) {
    console.error("Error cancelling rental request:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};





// Get tenant's rental requests and leases
const handleGetTenantRequests = async (req, res) => {
    try {
        const tenantId = req.user._id;
        const requests = await RentalRequest.find({ tenant: tenantId })
            .populate('property', 'title price address city media images')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: "Rental requests retrieved",
            count: requests.length,
            requests
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// Tenant uploads payment receipt
const handleUploadPaymentReceipt = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { amount, paymentMethod, referenceNumber } = req.body;
        const receiptImage = req.file;

        const rentalRequest = await RentalRequest.findById(requestId)
            .populate('property', 'title price');
        
        if (!rentalRequest) {
            return res.status(404).json({ 
                success: false, 
                message: "Rental request not found" 
            });
        }

        if (rentalRequest.tenant.toString() !== req.user._id.toString()) {
            return res.status(403).json({ 
                success: false, 
                message: "Unauthorized" 
            });
        }

        if (rentalRequest.status !== 'approved') {
            return res.status(400).json({ 
                success: false, 
                message: "Only approved requests can have payments uploaded" 
            });
        }

        // Upload receipt to Cloudinary if image provided
        let receiptUrl = '';
        let receiptPublicId = '';
        
        if (receiptImage) {
            const uploadResult = await cloudinary.uploader.upload(receiptImage.path, {
                folder: 'payment-receipts'
            });
            receiptUrl = uploadResult.secure_url;
            receiptPublicId = uploadResult.public_id;
        }

        // Update payment details
        rentalRequest.paymentDetails = {
            amount: amount || rentalRequest.property.price,
            method: paymentMethod,
            reference: referenceNumber,
            receiptImage: receiptUrl,
            receiptPublicId: receiptPublicId,
            paymentDate: new Date(),
            verified: false
        };
        
        await rentalRequest.save();

        // Notify admin
        await sendEmail({
            to: 'sackagent@gmail.com',
            subject: 'Payment Receipt Uploaded',
            html: `
                <h3>Payment Receipt Uploaded</h3>
                <p>Request ID: ${requestId}</p>
                <p>Tenant: ${req.user.fullName}</p>
                <p>Property: ${rentalRequest.property.title}</p>
                <p>Amount: ₦${amount || rentalRequest.property.price}</p>
                <p>Reference: ${referenceNumber}</p>
            `
        });

        res.status(200).json({
            success: true,
            message: "Payment receipt uploaded successfully. Awaiting admin verification.",
            request: rentalRequest
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// Get tenant's active lease
const handleGetTenantLease = async (req, res) => {
    try {
        const tenantId = req.user._id;
        
        const leaseRequest = await RentalRequest.findOne({ 
            tenant: tenantId, 
            status: 'active_lease' 
        })
            .populate('property', 'title address city media')
            .populate('assignedAdmin', 'name email');

        if (!leaseRequest) {
            return res.status(404).json({ 
                success: false, 
                message: "No active lease found" 
            });
        }

        res.status(200).json({
            success: true,
            message: "Lease retrieved successfully",
            lease: leaseRequest
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// Tenant sets auto-renewal preference
const handleSetAutoRenewal = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { autoRenew } = req.body;
        const tenantId = req.user._id;

        const rentalRequest = await RentalRequest.findOne({ 
            _id: requestId, 
            tenant: tenantId,
            status: 'active_lease' 
        });

        if (!rentalRequest) {
            return res.status(404).json({ 
                success: false, 
                message: "Active lease not found" 
            });
        }

        rentalRequest.leaseInfo.autoRenew = autoRenew;
        await rentalRequest.save();

        res.status(200).json({
            success: true,
            message: `Auto-renewal ${autoRenew ? 'enabled' : 'disabled'}`,
            request: rentalRequest
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};




// Register admin (only super admins can create other admins)
const handleRegisterAdmin = async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Create new admin user
    const admin = new User({
      fullName,
      email,
      password,
      role: role || 'admin',
      isVerified: true,
      kycVerified: true,
      isEmailVerified: true
    });

    await admin.save();

    res.status(201).json({
      success: true,
      message: 'Admin registered successfully',
      user: {
        id: admin._id,
        fullName: admin.fullName,
        email: admin.email,
        role: admin.role,
        kycVerified: admin.isEmailVerified,
        isVerified: admin.isVerified,
        isEmailVerified: admin.isEmailVerified
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all rental requests (admin view)
const handleGetAllRentalRequests = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const filter = {};
        
        if (status) {
            filter.status = status;
        }

        const requests = await RentalRequest.find(filter)
            .populate('property', 'title price address city')
            .populate('tenant', 'name email phone')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await RentalRequest.countDocuments(filter);

        res.status(200).json({
            success: true,
            message: "Rental requests retrieved",
            count: requests.length,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            requests
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};


// Admin processes rental request
const handleProcessRentalRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { status, adminNotes, adminResponse } = req.body;
        const adminId = req.user._id;

        const rentalRequest = await RentalRequest.findById(requestId)
            .populate('property')
            .populate('tenant');

        if (!rentalRequest) {
            return res.status(404).json({ 
                success: false, 
                message: "Rental request not found" 
            });
        }

        const property = await Property.findById(rentalRequest.property._id);
        if (!property) {
            return res.status(404).json({
                success: false,
                message: "The property in the request not found"
            });
        }

        // Update request
        rentalRequest.status = status;
        rentalRequest.adminNotes = adminNotes;
        rentalRequest.adminResponse = adminResponse;
        rentalRequest.assignedAdmin = adminId;
        rentalRequest.respondedAt = new Date();
        
        // If approved, set lease info
        if (status === 'approved') {
            rentalRequest.leaseInfo = {
                startDate: rentalRequest.requestedMoveInDate,
                monthlyRent: property.price,
                securityDeposit: property.price * 2,
                paymentStatus: 'pending',
                terms: 'Standard 1-year lease agreement'
            };
        }
        
        await rentalRequest.save();

        // Update property        
        if (status === 'approved') {
            property.status = 'rented';
            property.currentTenant = rentalRequest.tenant._id;
            property.rentStartDate = rentalRequest.requestedMoveInDate;
            
            // Calculate end date
            const endDate = new Date(rentalRequest.requestedMoveInDate);
            endDate.setMonth(endDate.getMonth() + rentalRequest.duration);
            property.rentEndDate = endDate;
            
            // Remove from pending requests
            property.pendingRequests = property.pendingRequests.filter(
                reqId => reqId.toString() !== requestId
            );
            property.approvedRequests.push(rentalRequest._id);
        } else if (status === 'rejected') {
            property.status = 'available';
            property.pendingRequests = property.pendingRequests.filter(
                reqId => reqId.toString() !== requestId
            );
        }

        await property.save();

        // Notify tenant
        await sendEmail({
            to: rentalRequest.tenant.email,
            subject: `Rental Request ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            html: `
                <h3>Your rental request has been ${status}</h3>
                <p>Property: ${property.title}</p>
                <p>Status: ${status}</p>
                <p>Admin Response: ${adminResponse || 'No additional notes'}</p>
                ${status === 'approved' ? 
                    '<p>Please proceed with payment to complete the rental process.</p>' : 
                    '<p>You can browse other available properties.</p>'
                }
            `
        });

        // Log history
        const history = new History({
            action: "processRentalRequest",
            user: adminId,
            property: property._id,
            tenant: rentalRequest.tenant._id,
            details: {
                requestId: rentalRequest._id,
                status: status,
                notes: adminNotes
            }
        });
        await history.save();

        res.status(200).json({
            success: true,
            message: `Rental request ${status} successfully`,
            request: rentalRequest
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// Admin verifies payment and activates lease
const handleVerifyPaymentAndActivateLease = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { verificationNotes } = req.body;
        const adminId = req.user._id;

        const rentalRequest = await RentalRequest.findById(requestId)
            .populate('property')
            .populate('tenant');

        if (!rentalRequest) {
            return res.status(404).json({ 
                success: false, 
                message: "Rental request not found" 
            });
        }

        if (rentalRequest.status !== 'approved') {
            return res.status(400).json({ 
                success: false, 
                message: "Only approved requests can have payments verified" 
            });
        }

        if (!rentalRequest.paymentDetails) {
            return res.status(400).json({ 
                success: false, 
                message: "No payment details found" 
            });
        }

        // Verify payment
        rentalRequest.paymentDetails.verified = true;
        rentalRequest.paymentDetails.verifiedBy = adminId;
        rentalRequest.paymentDetails.verifiedAt = new Date();
        
        // Activate lease
        rentalRequest.status = 'active_lease';
        rentalRequest.leaseInfo.paymentStatus = 'paid';
        rentalRequest.leaseInfo.signedAt = new Date();
        rentalRequest.leaseInfo.terms += `\n\nPayment verified by admin. Notes: ${verificationNotes || 'None'}`;
        rentalRequest.updatedAt = new Date();
        
        await rentalRequest.save();

        // Update property with lease dates
        const property = await Property.findById(rentalRequest.property._id);
        if (property) {
            property.rentStartDate = rentalRequest.leaseInfo.startDate;
            property.rentEndDate = rentalRequest.leaseInfo.endDate || 
                new Date(new Date(rentalRequest.leaseInfo.startDate).setMonth(
                    new Date(rentalRequest.leaseInfo.startDate).getMonth() + rentalRequest.duration
                ));
            await property.save();
        }

        // Notify tenant
        await sendEmail({
            to: rentalRequest.tenant.email,
            subject: 'Payment Verified & Lease Activated',
            html: `
                <h3>Payment Verified Successfully!</h3>
                <p>Your payment has been verified and your lease is now active.</p>
                <p>Property: ${property.title}</p>
                <p>Lease Start Date: ${new Date(rentalRequest.leaseInfo.startDate).toLocaleDateString()}</p>
                <p>Lease Duration: ${rentalRequest.duration} months</p>
                <p>Monthly Rent: ₦${rentalRequest.leaseInfo.monthlyRent}</p>
                <p>You can now access your lease details in your dashboard.</p>
            `
        });

        // Log history
        const history = new History({
            action: "activateLease",
            user: adminId,
            property: rentalRequest.property._id,
            tenant: rentalRequest.tenant._id,
            details: {
                requestId: rentalRequest._id,
                monthlyRent: rentalRequest.leaseInfo.monthlyRent,
                duration: rentalRequest.duration
            }
        });
        await history.save();

        res.status(200).json({
            success: true,
            message: "Payment verified and lease activated successfully",
            request: rentalRequest
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// Admin renews lease
const handleRenewLease = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { renewDuration, newMonthlyRent } = req.body;
        const adminId = req.user._id;

        const rentalRequest = await RentalRequest.findById(requestId)
            .populate('property')
            .populate('tenant');

        if (!rentalRequest) {
            return res.status(404).json({ 
                success: false, 
                message: "Lease not found" 
            });
        }

        if (rentalRequest.status !== 'active_lease') {
            return res.status(400).json({ 
                success: false, 
                message: "Only active leases can be renewed" 
            });
        }

        // Calculate new end date
        const currentEndDate = rentalRequest.leaseInfo.endDate || 
            new Date(new Date(rentalRequest.leaseInfo.startDate).setMonth(
                new Date(rentalRequest.leaseInfo.startDate).getMonth() + rentalRequest.duration
            ));
        
        const newEndDate = new Date(currentEndDate);
        newEndDate.setMonth(newEndDate.getMonth() + (renewDuration || 12));
        
        // Update lease info
        rentalRequest.leaseInfo.endDate = newEndDate;
        rentalRequest.duration += (renewDuration || 12);
        
        if (newMonthlyRent) {
            rentalRequest.leaseInfo.monthlyRent = newMonthlyRent;
            rentalRequest.leaseInfo.totalAmount = newMonthlyRent * rentalRequest.duration;
        }
        
        rentalRequest.leaseInfo.renewalOffered = false;
        rentalRequest.updatedAt = new Date();
        
        await rentalRequest.save();

        // Update property
        const property = await Property.findById(rentalRequest.property._id);
        if (property) {
            property.rentEndDate = newEndDate;
            await property.save();
        }

        // Notify tenant
        await sendEmail({
            to: rentalRequest.tenant.email,
            subject: 'Lease Renewed Successfully',
            html: `
                <h3>Lease Renewed</h3>
                <p>Your lease for ${property.title} has been renewed.</p>
                <p>New End Date: ${newEndDate.toLocaleDateString()}</p>
                <p>New Duration: ${renewDuration || 12} additional months</p>
                ${newMonthlyRent ? `<p>New Monthly Rent: ₦${newMonthlyRent}</p>` : ''}
            `
        });

        // Log history
        const history = new History({
            action: "renewLease",
            user: adminId,
            property: rentalRequest.property._id,
            tenant: rentalRequest.tenant._id,
            details: {
                requestId: rentalRequest._id,
                newEndDate: newEndDate,
                newDuration: renewDuration || 12
            }
        });
        await history.save();

        res.status(200).json({
            success: true,
            message: "Lease renewed successfully",
            request: rentalRequest
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// Get all active leases (admin view)
const handleGetAllActiveLeases = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        
        const leases = await RentalRequest.find({ status: 'active_lease' })
            .populate('property', 'title address city')
            .populate('tenant', 'name email phone')
            .populate('assignedAdmin', 'name')
            .sort({ 'leaseInfo.endDate': 1 }) // Sort by end date ascending
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await RentalRequest.countDocuments({ status: 'active_lease' });

        res.status(200).json({
            success: true,
            message: "Active leases retrieved",
            count: leases.length,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            leases
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// Get expiring leases
const handleGetExpiringLeases = async (req, res) => {
    try {
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        const expiringLeases = await RentalRequest.find({
            status: 'active_lease',
            'leaseInfo.endDate': { 
                $lte: thirtyDaysFromNow, 
                $gte: new Date() 
            },
            'leaseInfo.renewalOffered': false
        })
            .populate('property', 'title address')
            .populate('tenant', 'name email phone');

        res.status(200).json({
            success: true,
            message: "Expiring leases retrieved",
            count: expiringLeases.length,
            leases: expiringLeases
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// ============ CRON JOB FUNCTIONS ============

// Check for expiring leases and send notifications
const handleCheckExpiringLeases = async () => {
    try {
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        const expiringLeases = await RentalRequest.find({
            status: 'active_lease',
            'leaseInfo.endDate': { 
                $lte: thirtyDaysFromNow, 
                $gte: new Date() 
            },
            'leaseInfo.renewalOffered': false
        }).populate('tenant').populate('property');

        for (const lease of expiringLeases) {
            // Send renewal notification to tenant
            await sendEmail({
                to: lease.tenant.email,
                subject: 'Lease Renewal Notice',
                html: `
                    <h3>Lease Expiring Soon</h3>
                    <p>Your lease for ${lease.property.title} is expiring on ${lease.leaseInfo.endDate.toLocaleDateString()}</p>
                    <p>Please contact the admin to discuss renewal options.</p>
                    <p>If you wish to renew, please update your auto-renewal preference in your dashboard.</p>
                `
            });

            // Update flag
            lease.leaseInfo.renewalOffered = true;
            lease.leaseInfo.renewalDeadline = new Date(lease.leaseInfo.endDate);
            lease.leaseInfo.renewalDeadline.setDate(lease.leaseInfo.renewalDeadline.getDate() - 15);
            await lease.save();
        }
    } catch (error) {
        console.error('Error checking expiring leases:', error);
    }
};

// Auto-expire leases
const handleAutoExpireLeases = async () => {
    try {
        const now = new Date();
        const expiredLeases = await RentalRequest.find({
            status: 'active_lease',
            'leaseInfo.endDate': { $lt: now }
        }).populate('property').populate('tenant');

        for (const lease of expiredLeases) {
            if (lease.leaseInfo.autoRenew) {
                // Auto-renew for another year
                const newEndDate = new Date(lease.leaseInfo.endDate);
                newEndDate.setFullYear(newEndDate.getFullYear() + 1);
                
                lease.leaseInfo.endDate = newEndDate;
                lease.duration += 12;
                lease.leaseInfo.renewalOffered = false;
                
                // Update property
                await Property.findByIdAndUpdate(lease.property._id, {
                    rentEndDate: newEndDate
                });
                
                // Notify tenant
                await sendEmail({
                    to: lease.tenant.email,
                    subject: 'Lease Auto-Renewed',
                    html: `
                        <h3>Lease Auto-Renewed</h3>
                        <p>Your lease for ${lease.property.title} has been automatically renewed for another year.</p>
                        <p>New End Date: ${newEndDate.toLocaleDateString()}</p>
                    `
                });
            } else {
                // Mark lease as expired
                lease.status = 'expired_lease';
                lease.leaseInfo.terminatedAt = new Date();
                
                // Update property to available
                await Property.findByIdAndUpdate(lease.property._id, {
                    status: 'available',
                    currentTenant: null,
                    rentStartDate: null,
                    rentEndDate: null,
                    approvedRequests: []
                });
                
                // Notify tenant
                await sendEmail({
                    to: lease.tenant.email,
                    subject: 'Lease Expired',
                    html: `
                        <h3>Lease Expired</h3>
                        <p>Your lease for ${lease.property.title} has expired on ${lease.leaseInfo.endDate.toLocaleDateString()}</p>
                        <p>Please vacate the property and arrange for security deposit return.</p>
                    `
                });
            }
            
            await lease.save();
        }
    } catch (error) {
        console.error('Error auto-expiring leases:', error);
    }
};

// Schedule cron jobs (run daily at midnight)
cron.schedule('0 0 * * *', () => {
    handleCheckExpiringLeases();
    handleAutoExpireLeases();
});


module.exports = {
    // Tenant functions
    handleRequestProperty,
    handleGetTenantRequests,
    HandleGetARequest,
    HandleCancelRequest,
    handleUploadPaymentReceipt,
    handleGetTenantLease,
    handleSetAutoRenewal,

    // Admin functions
    handleRegisterAdmin,
    handleGetAllRentalRequests,
    handleProcessRentalRequest,
    handleVerifyPaymentAndActivateLease,
    handleRenewLease,
    handleGetAllActiveLeases,
    handleGetExpiringLeases,
    
    // Cron job functions (exported for testing)
    handleCheckExpiringLeases,
    handleAutoExpireLeases
};