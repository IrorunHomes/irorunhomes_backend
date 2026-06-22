

const mongoose = require('mongoose');

const sellPropertySchema = new mongoose.Schema({
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
        required: true
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
        enum: ['available', 'sold', 'bought', 'unavailable', 'maintenance', 'pending'],
        default: "available"
    },
    
    admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    sellPendingRequests: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SellRequest'
    }],
    
    approvedRequests: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SellRequest'
    }],

    // Landlord/House Owner Information
    ownerInfo: {
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

    soldBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    boughtBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    currentTenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },

    soldDate: { 
        type: Date 
    },
    
    boughtDate: { 
        type: Date 
    },

    managementInfo: {
        commissionRate: {
            type: Number,
            default: 10.0
        },
        managementFee: Number,
        contractStartDate: Date,
        contractEndDate: Date
    }
},
    { timestamps: true }
);

// Method to get public view (without landlord info)
sellPropertySchema.methods.toPublicJSON = function() {
    const property = this.toObject();
    delete property.ownerInfo;
    delete property.managementInfo;
    delete property.pendingRequests;
    delete property.approvedRequests;
    return property;
};

// Method to get admin view (with all info)
sellPropertySchema.methods.toAdminJSON = function() {
    return this.toObject();
};

// Virtual for owner display (basic info only)
sellPropertySchema.virtual('ownerBasicInfo').get(function() {
    if (!this.ownerInfo || !this.ownerInfo.personalInfo) {
        return null;
    }
    return {
        name: this.ownerInfo.personalInfo.fullName,
        phone: this.ownerInfo.personalInfo.phone,
        verified: this.ownerInfo.verified
    };
});

const SellProperty = mongoose.model("SellProperty", sellPropertySchema);
module.exports = SellProperty;