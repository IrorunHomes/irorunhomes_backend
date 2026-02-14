
const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "RentalRequest" },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true },
    action: { type: String, required: true },
    startDate: { type: Date, default: Date.now },
    monthlyRent: { type: Number},
    duration: {type: Number},
    endDate: { type: Date },
    amount: {type: Number},
    notes: { type: String, trim: true },
    reference: {type: String},
    status: {
        type: String,
        enum: ["active", "archived"],
        default: "active"
    },
}, {
    timestamps: true
});

const History = mongoose.model("History", historySchema);
module.exports = History;