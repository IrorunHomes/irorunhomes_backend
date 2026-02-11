const mongoose = require('mongoose');

const rentalRequestSchema = new mongoose.Schema({
    property: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Property',
        required: true
    },
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Request Status
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed', 'active_lease', 'expired_lease', 'renewal_pending'],
        default: 'pending'
    },
    
    // Request Details
    message: {
        type: String,
        required: true,
        minlength: 10,
        maxlength: 500
    },
    requestedMoveInDate: {
        type: Date,
        required: true
    },
    duration: {
        type: Number,
        default: 12,
        min: 1,
        max: 24
    },
    
    // LEASE INFORMATION (Added when approved)
    leaseInfo: {
        startDate: Date,
        endDate: Date,
        monthlyRent: Number,
        securityDeposit: Number,
        totalAmount: Number,
        terms: {
            type: String,
            default: 'Standard 1-year lease agreement'
        },
        
        // Renewal Information
        autoRenew: {
            type: Boolean,
            default: false
        },
        renewalOffered: {
            type: Boolean,
            default: false
        },
        renewalDeadline: Date,
        
        // Payment Tracking
        paymentStatus: {
            type: String,
            enum: ['pending', 'partial', 'paid', 'overdue'],
            default: 'pending'
        },
        
        // Additional Terms
        specialConditions: [String],
        signedAt: Date,
        terminatedAt: Date
    },
    
    // Payment Details
    paymentDetails: {
        amount: Number,
        method: {
            type: String,
            enum: ['cash', 'bank_transfer', 'mobile_money', 'check']
        },
        reference: String,
        receiptImage: String,
        receiptPublicId: String,
        paymentDate: Date,
        verified: {
            type: Boolean,
            default: false
        },
        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        verifiedAt: Date
    },
    
    // Tenant documents
    documents: [{
        type: {
            type: String,
            enum: ['id_card', 'employment_letter', 'bank_statement', 'reference_letter']
        },
        url: String,
        public_id: String,
        verified: {
            type: Boolean,
            default: false
        }
    }],
    
    // Admin handling
    assignedAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    adminNotes: String,
    adminResponse: String,
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    respondedAt: Date,
    expiresAt: {
        type: Date,
        default: function() {
            const date = new Date();
            date.setDate(date.getDate() + 7); // Request expires in 7 days
            return date;
        }
    }
});

// Indexes
rentalRequestSchema.index({ property: 1, tenant: 1 });
rentalRequestSchema.index({ status: 1, createdAt: -1 });
rentalRequestSchema.index({ 'leaseInfo.endDate': 1, status: 1 }); // For lease expiry checks
rentalRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for checking if it's an active lease
rentalRequestSchema.virtual('isActiveLease').get(function() {
    return this.status === 'active_lease';
});

// Virtual for checking if lease is expiring soon
rentalRequestSchema.virtual('isExpiringSoon').get(function() {
    if (this.status !== 'active_lease' || !this.leaseInfo.endDate) {
        return false;
    }
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return this.leaseInfo.endDate <= thirtyDaysFromNow && this.leaseInfo.endDate > new Date();
});

const RentalRequest = mongoose.model('RentalRequest', rentalRequestSchema);
module.exports = RentalRequest;