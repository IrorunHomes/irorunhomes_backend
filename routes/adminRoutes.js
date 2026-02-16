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
const { handleGetAllUsers, handleGetUserById, handleUpdateUserProfile, handleUpdateUserStatus, handleVerifyUserKYC } = require('../controllers/authController');


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

router.get('/users', protect, authorizeRoles(['admin', 'super_admin']), handleGetAllUsers);
router.get('/users/:userId', protect, authorizeRoles(['admin', 'super_admin']), handleGetUserById);
router.put('/users/:userId', protect, authorizeRoles(['admin', 'super_admin']), handleUpdateUserProfile);
router.put('/users/:userId/status', protect, authorizeRoles(['admin', 'super_admin']), handleUpdateUserStatus);
router.patch('/users/:userId/verify', protect, authorizeRoles(['admin', 'super_admin']), handleVerifyUserKYC);

module.exports = router;