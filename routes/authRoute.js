const express = require('express');
const router = express.Router();
const { 
    handleRegister,
    handleUserLogin,
    logoutUser,
    handleVerifyOTP,
    resendOTP,
    handlegetUserProfile,
    handleGetAllUsers,
    handleUpdateUserProfile,
    handleForgotPassword,
    handleResetPassword
 } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const {authorizeRoles} = require('../middleware/roleMiddleware');


// Registration Route
router.post('/register', handleRegister);
router.post('/login', handleUserLogin);
router.post('/logout', logoutUser);
router.post('/verify-otp', handleVerifyOTP);
router.post('/resend-otp', resendOTP);
router.get('/profile', protect, handlegetUserProfile);
router.put('/profile', protect, handleUpdateUserProfile);
router.post('/forgot-password', handleForgotPassword);
router.post('/reset-password', handleResetPassword);


// Admin route to get all users
router.get('/users', protect, authorizeRoles(['admin', 'super_admin']), handleGetAllUsers);

module.exports = router;