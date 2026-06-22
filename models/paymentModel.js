

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    lease: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lease',
        required: true
    },
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    property: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Property'
    },
    
    // Payment details
    amount: {
        type: Number,
        required: true
    },
    paymentType: {
        type: String,
        enum: ['rent', 'buy', 'sell', 'deposit', 'late_fee', 'early_payment', 'security_deposit', 'maintenance', 'other'],
        default: 'rent'
    },
    period: {
        month: Number,
        year: Number
    },
    
    // Manual payment details
    paymentMethod: {
        type: String,
        enum: ['cash', 'bank_transfer', 'mobile_money', 'check', 'other']
    },
    referenceNumber: {
        type: String,
        required: true
    },
    receiptImage: String,
    receiptPublicId: String,
    
    // Admin verification
    status: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
    },
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    verificationNotes: String,
    
    // Timestamps
    paymentDate: {
        type: Date,
        default: Date.now
    },
    verifiedAt: Date,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

paymentSchema.index({ lease: 1, paymentType: 1 });
paymentSchema.index({ tenant: 1, status: 1 });
paymentSchema.index({ paymentDate: 1 });

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;