
const User = require('../models/userModel');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendOTPEmail, sendWelcomeEmail } = require('../utils/sendEmail');
const RentalRequest = require('../models/rentalRequestModel');
const History = require('../models/historyModel');


// Generate short-lived access token
const generateAccessToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });
};

// Generate long-lived refresh token
const generateRefreshToken = (user) => {
  return jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });
};

// User Registration
const handleRegister = async (req, res) => {
    try {
        const { fullName, email, phone, password } = req.body;

        // Validation
        if (!fullName || !email || !password || !phone) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address"
            });
        }

        // Validate password
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters long"
            });
        }

        // Validate phone (basic validation)
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        if (!phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid phone number"
            });
        }

        // Check if user exists
        const existingUser = await User.findOne({ 
            $or: [
                { email: email.toLowerCase() },
                { phone: phone }
            ]
        });
        
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                message: existingUser.email === email.toLowerCase() 
                    ? 'Email already registered' 
                    : 'Phone number already registered'
            });
      }
      
      const hashedPassword = await bcrypt.hash(password, 12);


        // Generate OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Create user
        const user = new User({
            fullName: fullName.trim(),
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            password: hashedPassword,
            otp: otp,
            otpExpires: otpExpires,
            isActive: true,
            role: 'tenant'
        });

        // Save user
        await user.save();
        try {
            await sendOTPEmail(email, otp);
        } catch (emailError) {
            console.error('Email sending failed:', emailError.message);
        }
        res.status(201).json({
            success: true,
            message: 'Account created successfully. Please check your email for OTP verification.',
          user: {
            fullName: user.fullName,
            email: user.email,
            phone: user.phone
            }
        });

    } catch (error) {
        console.error('Registration error:', error);

        res.status(500).json({ 
            success: false, 
            message: 'Server error during registration',
            error: error.message});
    }
};


// LOGIN
const handleUserLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: "Email and password are required" 
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid email or password" 
      });
    }

const isMatch = await bcrypt.compare(password, user?.password)
        if (!isMatch) {
            res.status(400).json({
                message: "Incorrect password or email"
            })
        };

    if (!user.isEmailVerified || !user.isVerified) {
      // Store email for verification page
      return res.status(403).json({ 
        success: false,
        message: "Email not verified. Please verify to login.",
        requiresVerification: true,
        email: user.email
      });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Set cookies
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Return complete user information
    res.status(200).json({
      success: true,
      message: "Login successful",
      accessToken,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        isEmailVerified: user.isEmailVerified,
        kycVerified: user.kycVerified,
        avatar: user.avatar,
        phone: user.phone
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error during login" 
    });
  }
};


// Get User Profile
const handlegetUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -otp -otpExpires');
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};


// GET ALL REGISTERED USERS
const handleGetAllUsers = async (req, res) => {
    try {
        const { 
            role, 
            status, 
            search, 
            page = 1, 
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const userRole = req.user.role;
        const query = {};

        if (userRole === 'admin') {
            query.role = 'tenant';
        } else if (userRole === 'super_admin') {
            query.role = { $ne: 'super_admin' };
            
        }

        // Status filters
        if (status === 'verified') {
            query.isEmailVerified = true;
            query.kycVerified = true;
        } else if (status === 'pending') {
            query.$or = [
                { isEmailVerified: false },
                { kycVerified: false }
            ];
        } else if (status === 'suspended') {
            query.isActive = false;
        }

        // Search functionality
        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Execute query with pagination
        const users = await User.find(query)
            .select('-password -resetPasswordToken -resetPasswordExpire')
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        // Get total count for pagination
        const total = await User.countDocuments(query);

        // Get additional stats for each user
        const enhancedUsers = await Promise.all(users.map(async (user) => {
            const userObj = user.toObject();
            
            // Get active leases count
            const activeLeases = await RentalRequest.countDocuments({
                tenant: user._id,
                status: 'active_lease'
            });

            // Get pending requests count
            const pendingRequests = await RentalRequest.countDocuments({
                tenant: user._id,
                status: 'pending'
            });

            // Get total requests
            const totalRequests = await RentalRequest.countDocuments({
                tenant: user._id
            });

            return {
                ...userObj,
                stats: {
                    activeLeases,
                    pendingRequests,
                    totalRequests
                }
            };
        }));

        // Calculate summary statistics
        const stats = {
            totalUsers: total,
            totalTenants: await User.countDocuments({ role: 'tenant' }),
            totalAdmins: await User.countDocuments({ role: 'admin' }),
            verifiedUsers: await User.countDocuments({ 
                isEmailVerified: true, 
                kycVerified: true,
                ...(userRole === 'admin' ? { role: 'tenant' } : {})
            }),
            pendingVerification: await User.countDocuments({
                $or: [
                    { isEmailVerified: false },
                    { kycVerified: false }
                ],
                ...(userRole === 'admin' ? { role: 'tenant' } : {})
            }),
            activeLeases: await RentalRequest.countDocuments({ status: 'active_lease' })
        };

        res.status(200).json({
            success: true,
            message: "Users retrieved successfully",
            data: {
                users: enhancedUsers,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / limit)
                },
                stats
            }
        });

    } catch (error) {
        console.error("❌ Error fetching users:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch users"
        });
    }
};


//Get single user by ID (Admin/Super Admin)
const handleGetUserById = async (req, res) => {
    try {
        const { userId } = req.params;
        const userRole = req.user.role;

        const user = await User.findById(userId)
            .select('-password -resetPasswordToken -resetPasswordExpire');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Check permissions
        if (userRole === 'admin' && user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: "Admin can only view tenant accounts"
            });
        }

        if (userRole === 'super_admin' && user.role === 'super_admin') {
            return res.status(403).json({
                success: false,
                message: "Super admin cannot view other super admin accounts"
            });
        }

        // Get user's rental history
        const rentalHistory = await RentalRequest.find({
            tenant: user._id
        })
            .populate('property', 'title address price')
            .sort({ createdAt: -1 })
            .limit(10);

        // Get statistics
        const stats = {
            totalRequests: await RentalRequest.countDocuments({ tenant: user._id }),
            pendingRequests: await RentalRequest.countDocuments({ 
                tenant: user._id, 
                status: 'pending' 
            }),
            approvedRequests: await RentalRequest.countDocuments({ 
                tenant: user._id, 
                status: 'approved' 
            }),
            activeLeases: await RentalRequest.countDocuments({ 
                tenant: user._id, 
                status: 'active_lease' 
            }),
            rejectedRequests: await RentalRequest.countDocuments({ 
                tenant: user._id, 
                status: 'rejected' 
            }),
            totalPayments: await RentalRequest.countDocuments({ 
                tenant: user._id,
                'paymentDetails.verified': true 
            })
        };

        res.status(200).json({
            success: true,
            message: "User retrieved successfully",
            data: {
                user,
                stats,
                rentalHistory
            }
        });

    } catch (error) {
        console.error("❌ Error fetching user:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch user"
        });
    }
};

// Update user status (activate/suspend)
const handleUpdateUserStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { isActive, reason } = req.body;
        const adminId = req.user._id;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Check permissions
        if (req.user.role === 'admin' && user.role !== 'tenant') {
            return res.status(403).json({
                success: false,
                message: "Admin can only update tenant accounts"
            });
        }

        user.isActive = isActive;
        await user.save();

        // Log to history
        await History.create({
            action: isActive ? "activateUser" : "suspendUser",
            userId: adminId,
            targetUser: userId,
            notes: `User ${isActive ? 'activated' : 'suspended'} by admin`
        });

        res.status(200).json({
            success: true,
            message: `User ${isActive ? 'activated' : 'suspended'} successfully`,
            data: {
                _id: user._id,
                fullName: user.fullName,
                email: user.email,
                isActive: user.isActive
            }
        });

    } catch (error) {
        console.error("❌ Error updating user status:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to update user status"
        });
    }
};

//Verify user KYC
const handleVerifyUserKYC = async (req, res) => {
    try {
        const { userId } = req.params;
        const { verified, notes } = req.body;
        const adminId = req.user._id;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        user.kycVerified = verified;
        if (verified) {
            user.kycSubmittedAt = new Date();
        }
        await user.save();

        // Log to history
        await History.create({
            action: verified ? "verifyKYC" : "rejectKYC",
            userId: adminId,
            targetUser: userId,
            notes: notes || `KYC ${verified ? 'verified' : 'rejected'}`
        });

        res.status(200).json({
            success: true,
            message: `KYC ${verified ? 'verified' : 'rejected'} successfully`,
            data: {
                _id: user._id,
                fullName: user.fullName,
                kycVerified: user.kycVerified
            }
        });

    } catch (error) {
        console.error("❌ Error verifying KYC:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to verify KYC"
        });
    }
};


// Update user profile
const handleUpdateUserProfile = async (req, res) => {
  try {
      const user = await User.findById(req.user.id);
        if (!user) {
          return res.status(404).json({ success: false, message: "User not found" });
        }

        const { fullName, email, phone } = req.body;
        if (fullName) user.fullName = fullName;
        if (email) user.email = email;
        if (phone) user.phone = phone;
        

        await user.save();

        res.status(200).json({
          success: true,
          message: "Profile updated successfully",
          user: {
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone
          }
        });
      } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, message: "Internal server error" });
      }
};

// LOGOUT
const logoutUser = (req, res) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.status(200).json({ message: "Logged out successfully" });
};

// VERIFY EMAIL
const handleVerifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validate input
    if (!email || !otp) {
      return res.status(400).json({ 
        success: false,
        message: "Email and OTP are required" 
      });
    }

    // Validate OTP format
    if (otp.length !== 6 || isNaN(otp)) {
      return res.status(400).json({ 
        success: false,
        message: "OTP must be a 6-digit number" 
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ 
        success: false,
        message: "User not found with this email" 
      });
    }

    if (!user.otp || !user.otpExpires) {
      return res.status(400).json({ 
        success: false,
        message: "No OTP found. Please request a new OTP." 
      });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ 
        success: false,
        message: "Incorrect OTP. Please check and try again." 
      });
    }

    if (user.otpExpires < Date.now()) {
      return res.status(400).json({ 
        success: false,
        message: "OTP has expired. Please request a new OTP." 
      });
    }

    // Mark user as verified
    user.isVerified = true;
    user.isEmailVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    
    await user.save();


    // Send welcome email
    try {
      await sendWelcomeEmail(email,  user.fullName);
    } catch (emailError) {
      console.error('Welcome email error:', emailError);
    }

    res.status(200).json({ 
      success: true,
      message: "Email verified successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
      }
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error during verification" 
    });
  }
};

// RESEND OTP
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate input
    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: "Email is required" 
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found for email:', email);
      return res.status(404).json({ 
        success: false,
        message: "User not found with this email" 
      });
    }

    // Check if user is already verified
    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified. Please login instead."
      });
    }

    // Generate new OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    
    await user.save();

    // Send OTP email
    try {
      await sendOTPEmail(email, otp);
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError);
    }

    res.status(200).json({ 
      success: true,
      message: "OTP resent successfully",
      expiresIn: 10 * 60 * 1000
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ 
      success: false,
      message: "Failed to resend OTP. Please try again." 
    });
  }
};




module.exports = {
    handleRegister,
    handleUserLogin,
    logoutUser,
    handleVerifyOTP,
    resendOTP,
    handlegetUserProfile,
    handleGetAllUsers,
    handleUpdateUserProfile,
    handleGetUserById,
    handleUpdateUserStatus,
    handleVerifyUserKYC
};