

const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true 
    },
    description: { 
        type: String, 
        required: true 
    },
    price: { 
        type: Number, 
        required: true 
    },
    address: { 
        type: String, 
        required: true 
    },
    city: { 
        type: String, 
        required: true 
    },
    state: { 
        type: String, 
        required: true 
    },
    country: { 
        type: String, 
    },

    propertyType: {
        type: String,
        enum: ['apartment', 'land', 'house', 'commercial', 'industrial', 'other'],
        default: 'other',
    },

    propertyFor: {
        type: String,
        enum: ['rent', 'sale'],
        required: true
    },

    apartmentType: {
        type: String,
        enum: ['a-room', "shop", "office", 'complex', 'self-contained', 'room-and-parlour', 'two-bedroom', 'three-bedroom', 'flat', "others"],
        default: 'others',
    },
    unitNumber: { 
        type: String 
    },
    
    // Features as an object (not array)
    features: {
        bedrooms: { type: Number, default: 0 },
        bathrooms: { type: Number, default: 1 },
        parking: { type: Boolean, default: false },
        kitchen: { type: Boolean, default: true },
        toilet: { type: Number, default: 0 },
        amenities: { type: [String], default: [] },
        extras: { type: [String], default: [] },
    },

    media: {
        images: [
            {
                url: { type: String, required: true },
                public_id: { type: String, required: true }
            }
        ],
        videos: [
            {
                url: { type: String },
                public_id: { type: String }
            }
        ]
    },
   
    status: {
        type: String,
        enum: ['available', 'rented', 'bought', 'unavailable', 'maintenance', 'pending'],
        default: "available"
    },
    
    admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    pendingRequests: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RentalRequest'
    }],
    
    approvedRequests: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RentalRequest'
    }],

    // Landlord/House Owner Information
    landlordInfo: {
        // Personal Information
        personalInfo: {
            fullName: {
                type: String,
                required: true
            },
            email: {
                type: String,
                lowercase: true
            },
            phone: {
                type: String,
                required: true
            },
            alternativePhone: String,
        },
        
        // Contact Address
        contactAddress: {
            street: String,
            city: String,
            state: String,
            country: String,
        },
        
        // Bank Details (Admin-only)
        bankDetails: {
            bankName: {
                type: String,
                required: true
            },
            accountNumber: {
                type: String,
                required: true
            },
            accountName: {
                type: String,
                required: true
            },
        },
        
        // Emergency Contact
        emergencyContact: {
            name: String,
            relationship: String,
            phone: String,
            email: String
        },
        
        // Additional Information
        additionalInfo: {
            occupation: String,
            nextOfKin: String,
            relationshipToKin: String,
            kinPhone: String,
            notes: String
        },
        
        // Verification Status
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

    views: {
        type: Number,
        default: 0
    },

    isActive: {
        type: Boolean,
        default: true
    },

    listedDate: {
        type: Date,
        default: Date.now
    },

    listedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    rentedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    currentTenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },

    rentStartDate: { 
        type: Date 
    },
    
    rentEndDate: { 
        type: Date 
    },

    managementInfo: {
        commissionRate: {
            type: Number,
            default: 10.0
        },
        managementFee: Number,
        paymentSchedule: {
            type: String,
            enum: ['monthly', 'quarterly', 'yearly', 'one-time'],
            default: 'one-time'
        },
        contractStartDate: Date,
        contractEndDate: Date
    }
},
    { timestamps: true }
);

// Method to get public view (without landlord info)
propertySchema.methods.toPublicJSON = function() {
    const property = this.toObject();
    delete property.landlordInfo;
    delete property.managementInfo;
    delete property.pendingRequests;
    delete property.approvedRequests;
    return property;
};

// Method to get admin view (with all info)
propertySchema.methods.toAdminJSON = function() {
    return this.toObject();
};

// Virtual for landlord display (basic info only)
propertySchema.virtual('landlordBasicInfo').get(function() {
    if (!this.landlordInfo || !this.landlordInfo.personalInfo) {
        return null;
    }
    return {
        name: this.landlordInfo.personalInfo.fullName,
        phone: this.landlordInfo.personalInfo.phone,
        verified: this.landlordInfo.verified
    };
});

const Property = mongoose.model("Property", propertySchema);
module.exports = Property;