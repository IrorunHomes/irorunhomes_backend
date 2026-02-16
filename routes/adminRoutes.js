const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {authorizeRoles} = require('../middleware/roleMiddleware')
const { handleRegisterAdmin, 
        handleGetAllRentalRequests, 
        handleProcessRentalRequest,
        handleVerifyPaymentAndActivateLease,
        handleRenewLease,
        handleGetAllActiveLeases,
        handleGetExpiringLeases,
        handleCheckExpiringLeases,
        handleAutoExpireLeases
    } = require('../controllers/rentalRequestController');


// Admin routes
router.post('/register-admin', protect, authorizeRoles(['super_admin']), handleRegisterAdmin);
router.get('/requests', protect, authorizeRoles(['admin', 'super_admin']), handleGetAllRentalRequests);
router.put('/process-request/:requestId', protect, authorizeRoles(['admin', 'super_admin']), handleProcessRentalRequest);
router.put('/verify-payment/:requestId', protect, authorizeRoles(['admin', 'super_admin']), handleVerifyPaymentAndActivateLease);
router.put('/renew-lease/:requestId', protect, authorizeRoles(['admin', 'super_admin']), handleRenewLease);
router.get('/active-leases', protect, authorizeRoles(['admin', 'super_admin']), handleGetAllActiveLeases);
router.get('/expiring-leases', protect, authorizeRoles(['admin', 'super_admin']), handleGetExpiringLeases);
router.get('/check-expiring-leases', protect, authorizeRoles(['admin', 'super_admin']), handleCheckExpiringLeases);
router.post('/auto-expire-leases', protect, authorizeRoles(['admin', 'super_admin']), handleAutoExpireLeases);

module.exports = router;