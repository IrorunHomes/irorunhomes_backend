const mongoose = require('mongoose');

const sellRequestSchema = new mongoose.Schema({
    property: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Property',
        required: true
    },
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    buyer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    
    // Request Status
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed', 'sold', 'bought', 'unavailable', 'maintenance', 'pending'],
        default: 'pending'
    },
    
    // Request Details
    message: {
        type: String,
        required: true,
        minlength: 10,
        maxlength: 500
    },

    dealDetails: {
        salePrice: Number,
        terms: {
            type: String,
            default: 'Standard sale agreement'
        },
        dateOfSale: Date,
        dateOfPurchase: Date,
        specialConditions: [String],
        // Contact info for buyer/seller
        contactInfo: {
            phone: String,
            email: String,
            address: String,
        },
        
        // Commission details (if applicable)
        commissionAmount: Number,
        commissionPercentage: Number,
        commissionPaid: {
            type: Boolean,
            default: false
        },

        // Payment schedule (if applicable)
        paymentSchedule: [{
            amount: Number,
            paid: {
                type: Boolean,
                default: false
            },
            paymentMethod: {
                type: String,
                enum: ['cash', 'bank_transfer', 'mobile_money', 'check', 'other']
            },
            referenceNumber: String,
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
        }],
    },
    signedAgreement: {
        url: String,
        public_id: String,
        dateSigned: Date,
    },
    
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
sellRequestSchema.index({ property: 1, seller: 1 });
sellRequestSchema.index({ status: 1, createdAt: -1 });
sellRequestSchema.index({ 'dealDetails.dateOfSale': 1, status: 1 });

const SellRequest = mongoose.model('SellRequest', sellRequestSchema);
module.exports = SellRequest;