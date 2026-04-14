
const Payment = require('../models/paymentModel');
const Lease = require('../models/leaseModel');
const { sendEmail } = require('../utils/sendEmail');

const recordPayment = async (req, res) => {
    try {
        const { leaseId, amount, paymentMethod, referenceNumber, notes, receiptImage } = req.body;
        const tenantId = req.user.id;

        const lease = await Lease.findOne({ _id: leaseId, tenant: tenantId });
        if (!lease) {
            return res.status(404).json({ success: false, message: 'Lease not found' });
        }

        // Create payment record
        const payment = new Payment({
            lease: leaseId,
            tenant: tenantId,
            amount,
            paymentMethod,
            referenceNumber,
            notes,
            receiptImage,
            status: 'pending',
            paymentDate: new Date()
        });

        await payment.save();

        // Notify admin for confirmation
        await sendEmail({
            to: 'irorunhomesng@gmail.com',
            subject: 'New Payment Requires Confirmation',
            html: `
                <h3>New Payment Recorded</h3>
                <p>Tenant: ${req.user.name}</p>
                <p>Property: ${lease.property.title}</p>
                <p>Amount: $${amount}</p>
                <p>Method: ${paymentMethod}</p>
                <p>Reference: ${referenceNumber}</p>
                <p>Please verify and confirm this payment in the admin panel.</p>
            `
        });

        res.status(201).json({
            success: true,
            message: 'Payment recorded successfully. Awaiting admin confirmation.',
            payment
        });

    } catch (error) {
        console.error('Record payment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const confirmPayment = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { paymentId } = req.params;
        const { status, notes } = req.body;

        const payment = await Payment.findById(paymentId)
            .populate('lease')
            .populate('tenant');

        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        payment.status = status;
        payment.confirmedBy = req.user.id;
        payment.confirmedAt = new Date();
        payment.notes = notes || payment.notes;

        await payment.save();

        // Update lease payment status
        if (status === 'confirmed') {
            const lease = await Lease.findById(payment.lease);
            if (payment.paymentType === 'rent') {
                lease.paymentStatus = 'paid';
            }
            await lease.save();
        }

        // Notify tenant
        await sendEmail({
            to: payment.tenant.email,
            subject: `Payment ${status}`,
            html: `
                <h3>Payment ${status.charAt(0).toUpperCase() + status.slice(1)}</h3>
                <p>Your payment of $${payment.amount} has been ${status}.</p>
                <p>Reference: ${payment.referenceNumber}</p>
                <p>Admin Notes: ${notes || 'No additional notes'}</p>
                ${status === 'confirmed' ? '<p>Thank you for your payment!</p>' : '<p>Please contact support for more information.</p>'}
            `
        });

        res.json({
            success: true,
            message: `Payment ${status} successfully`,
            payment
        });

    } catch (error) {
        console.error('Confirm payment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getTenantPayments = async (req, res) => {
    try {
        const tenantId = req.user.id;
        const payments = await Payment.find({ tenant: tenantId })
            .populate('lease', 'property')
            .sort({ createdAt: -1 });

        res.json(payments);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};



module.exports = {
    recordPayment,
    confirmPayment,
    getTenantPayments
};