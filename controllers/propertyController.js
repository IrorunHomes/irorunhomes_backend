
const Property = require('../models/propertyModel');
const History = require('../models/historyModel');
const User = require('../models/userModel');
const cloudinary = require('../utils/cloudinary');


// Get all properties without any checks but with visibility control
const handleShowAllPropertiesToTenant = async (req, res) => { 
    try {
        const properties = await Property.find({ isActive: true })
        .select('-landlordInfo -managementInfo -emergencyContact -additionalInfo -pendingRequests -approvedRequests')
    res.status(200).json({
        success: true,
        count: properties.length,
        properties
    });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

const handleShowPropertiesToTenantById = async (req, res) => { 
    try {
        const { id } = req.params;
        const property = await Property.findById(id)
        .select('-landlordInfo -managementInfo -emergencyContact -additionalInfo -pendingRequests -approvedRequests');
        if (!property) {
            return res.status(404).json({
                success: false,
                message: "Property not found"
            });
        }
        res.status(200).json({
            success: true,
            property
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// GET ALL PROPERTY
const handleGetAllProperty = async (req, res) => {
    try {
        // Check if user is admin
        const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
        
        if (!isAdmin) {
            return res.status(403).json({ 
                success: false, 
                message: "Only admins can access all properties" 
            });
        }

        const properties = await Property.find({ isActive: true })
            .populate('listedBy', 'name email')
            .populate('admin', 'superAdmin name email')
            .populate('currentTenant', 'name email phone');

        res.status(200).json({
            success: true,
            message: "All properties found",
            count: properties.length,
            properties
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// Property listing with landlord info (Admin only)
const handlePropertyListing = async (req, res) => {
    try {
        // Check if user is admin
        const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
        
        if (!isAdmin) {
            return res.status(403).json({ 
                success: false, 
                message: "Only admins can list property" 
            });
        }

        // Extract ALL fields from request body
        const {
            // Property Information
            title,
            description,
            price,
            address,
            city,
            state,
            country,
            propertyType,
            propertyFor,
            apartmentType,
            unitNumber,
            apartmentCount,
            
            // Features (will be converted to nested object)
            bedrooms,
            bathrooms,
            parking,
            kitchen,
            toilet,
            amenities,
            extras,
            
            // Landlord/House Owner Information
            landlordFullName,
            landlordEmail,
            landlordPhone,
            landlordAlternativePhone,
            
            // Landlord Contact Address
            landlordStreet,
            landlordCity,
            landlordState,
            landlordCountry,
                        
            // Landlord Bank Details
            bankName,
            accountNumber,
            accountName,
            
            // Emergency Contact
            emergencyContactName,
            emergencyContactRelationship,
            emergencyContactPhone,
            emergencyContactEmail,
            
            // Additional Landlord Info
            landlordOccupation,
            nextOfKin,
            relationshipToKin,
            kinPhone,
            landlordNotes,
            
            // Management Info
            commissionRate,
            managementFee,
            paymentSchedule,
            contractStartDate,
            contractEndDate
            
        } = req.body;

        // Validate required fields
        if (!title || !description || !price || !address || !city || !state || !apartmentType || !propertyType || !propertyFor) {
            return res.status(400).json({
                success: false,
                message: "Missing required property fields: title, description, price, address, city, state, apartmentType, propertyType, propertyFor"
            });
        }

        // Validate required landlord information
        if (!landlordFullName || !landlordPhone) {
            return res.status(400).json({
                success: false,
                message: "Landlord full name and phone are required"
            });
        }

        if (!bankName || !accountNumber || !accountName) {
            return res.status(400).json({
                success: false,
                message: "Bank details are required"
            });
        }

        // Parse features as nested object (matches schema)
        const features = {
            bedrooms: parseInt(bedrooms) || 0,
            bathrooms: parseInt(bathrooms) || 1,
            parking: parking === 'true' || parking === true,
            kitchen: kitchen === 'true' || kitchen === true,
            toilet: parseInt(toilet) || 0,
            amenities: amenities ? (typeof amenities === 'string' ? amenities.split(',') : [].concat(amenities)) : [],
            extras: extras ? (typeof extras === 'string' ? extras.split(',') : [].concat(extras)) : []
        };

        // Process media files
        let media = {
            images: [],
            videos: []
        };

        // Process images
        if (req.files && req.files.images) {
            const imagesArray = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
            
            for (let file of imagesArray) {
                // Validate image file size
                if (file.size > 10 * 1024 * 1024) {
                    return res.status(400).json({ 
                        success: false, 
                        message: `Image ${file.originalname} is too large. Maximum 10MB per image.` 
                    });
                }

                try {
                    const uploadRes = await new Promise((resolve, reject) => {
                        const uploadStream = cloudinary.uploader.upload_stream(
                            {
                                folder: 'properties/images',
                                resource_type: 'image',
                                quality: 'auto',
                                fetch_format: 'auto'
                            },
                            (error, result) => {
                                if (error) reject(error);
                                else resolve(result);
                            }
                        );
                        uploadStream.end(file.buffer);
                    });

                    media.images.push({
                        url: uploadRes.secure_url,
                        public_id: uploadRes.public_id,
                        originalName: file.originalname,
                        size: file.size,
                        mimetype: file.mimetype
                    });
                } catch (uploadError) {
                    console.error('Image upload error:', uploadError);
                    return res.status(500).json({ 
                        success: false, 
                        message: `Failed to upload image: ${file.originalname}` 
                    });
                }
            }
        }

        // Process videos
        if (req.files && req.files.videos) {
            const videosArray = Array.isArray(req.files.videos) ? req.files.videos : [req.files.videos];
            
            if (videosArray.length > 1) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Only one video allowed per property" 
                });
            }

            const videoFile = videosArray[0];
            
            if (videoFile.size > 50 * 1024 * 1024) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Video ${videoFile.originalname} is too large. Maximum 50MB per video.` 
                });
            }

            try {
                const uploadRes = await new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        {
                            folder: 'properties/videos',
                            resource_type: 'video',
                            quality: 'auto'
                        },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );
                    uploadStream.end(videoFile.buffer);
                });

                media.videos.push({
                    url: uploadRes.secure_url,
                    public_id: uploadRes.public_id,
                    originalName: videoFile.originalname,
                    size: videoFile.size,
                    mimetype: videoFile.mimetype,
                    duration: uploadRes.duration
                });
            } catch (uploadError) {
                console.error('Video upload error:', uploadError);
                return res.status(500).json({ 
                    success: false, 
                    message: `Failed to upload video: ${videoFile.originalname}` 
                });
            }
        }

        // Validate that at least one image is provided
        if (media.images.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "At least one image is required for property listing" 
            });
        }

        // Create the property WITH nested structure
        const property = new Property({
            // Basic property info (top-level fields)
            title,
            description,
            price: parseFloat(price),
            address,
            city,
            state,
            country: country || 'Nigeria',
            apartmentType,
            propertyType,
            propertyFor,
            unitNumber: unitNumber || '',
            features, // Nested object created above
            apartmentCount: parseInt(apartmentCount) || 1,
            
            // Media (nested object)
            media,
            
            // Admin info
            admin: req.user._id,
            listedBy: req.user._id,
            
            // Status
            status: 'available',
            
            // Landlord/House Owner Information (nested structure)
            landlordInfo: {
                personalInfo: {
                    fullName: landlordFullName,
                    email: landlordEmail ? landlordEmail.toLowerCase() : '',
                    phone: landlordPhone,
                    alternativePhone: landlordAlternativePhone || '',
                },
                
                contactAddress: {
                    street: landlordStreet || '',
                    city: landlordCity || '',
                    state: landlordState || '',
                    country: landlordCountry || '',
                },
                
                bankDetails: {
                    bankName,
                    accountNumber,
                    accountName
                },
                
                emergencyContact: {
                    name: emergencyContactName || '',
                    relationship: emergencyContactRelationship || '',
                    phone: emergencyContactPhone || '',
                    email: emergencyContactEmail || ''
                },
                
                additionalInfo: {
                    occupation: landlordOccupation || '',
                    nextOfKin: nextOfKin || '',
                    relationshipToKin: relationshipToKin || '',
                    kinPhone: kinPhone || '',
                    notes: landlordNotes || ''
                },
                
                verified: false
            },
            
            // Management Info (nested structure)
            managementInfo: {
                commissionRate: parseFloat(commissionRate) || 10.0,
                managementFee: parseFloat(managementFee) || 0,
                paymentSchedule: paymentSchedule || 'one-time',
                contractStartDate: contractStartDate ? new Date(contractStartDate) : new Date(),
                contractEndDate: contractEndDate ? new Date(contractEndDate) : null
            }
        });

        await property.save();

        // Log the action in history
        const history = new History({
            action: "New Property listed",
            userId: req.user._id,
            propertyId: property._id,
            startDate: new Date(),
            notes: "History recorded",
            status: "active"


        });
        await history.save();

        // Return full details to admin
        res.status(201).json({
            success: true,
            message: "Property listed successfully with landlord information",
            data: property.toAdminJSON()
        });

    } catch (error) {
        console.error("Error listing property:", error);
        res.status(500).json({
            success: false,
            message: "Failed to list property",
            error: error.message
        });
    }
};

// User view property by ID (Admin only)
const handleViewPropertyById = async (req, res) => {
    try {
        const { id } = req.params;
        const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
        
        if (!isAdmin) {
            return res.status(403).json({ 
                success: false, 
                message: "Only admins can view property details" 
            });
        }
        
        const property = await Property.findById(id)
            .populate('listedBy', 'name email');

        if (!property) {
            return res.status(404).json({ 
                success: false, 
                message: "Property not found" 
            });
        }

        res.status(200).json({
            success: true,
            message: "Property found",
            property
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};


// UPDATE A PROPERTY (Admin only)
const handleUpdateAPropertyById = async (req, res) => {
    try {
        const { propertyId } = req.params;

        if (!propertyId) {
            return res.status(400).json({ 
                success: false, 
                message: "Property ID is missing" 
            });
        }

        const property = await Property.findById(propertyId);
        if (!property) {
            return res.status(404).json({ 
                success: false, 
                message: "No property found" 
            });
        }

        // If updating landlord info, make sure required fields are present
        if (req.body.landlordInfo) {
            const landlordInfo = req.body.landlordInfo;
            if (landlordInfo.personalInfo) {
                if (!landlordInfo.personalInfo.fullName || !landlordInfo.personalInfo.phone) {
                    return res.status(400).json({ 
                        success: false, 
                        message: "Landlord full name and phone are required" 
                    });
                }
            }
            
            if (landlordInfo.bankDetails) {
                if (!landlordInfo.bankDetails.bankName || 
                    !landlordInfo.bankDetails.accountNumber || 
                    !landlordInfo.bankDetails.accountName) {
                    return res.status(400).json({ 
                        success: false, 
                        message: "Bank name, account number, and account name are required" 
                    });
                }
            }
        }

        const updatedProperty = await Property.findByIdAndUpdate(
            id,
            { $set: req.body },
            { new: true, runValidators: true }
        ).populate('listedBy', 'name email');

        res.status(200).json({
            success: true,
            message: "Property updated successfully",
            updatedProperty: updatedProperty.toAdminJSON()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// DELETE A PROPERTY FROM LISTINGS (Admin only)
const deletePropertyById = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                message: "Only admins can delete properties" 
            });
        }

        if (!id || id.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Property ID is missing" 
            });
        }

        const property = await Property.findById(id);
        if (!property) {
            return res.status(404).json({
                success: false,
                message: "Property not found"
            });
        }

        // Delete media from Cloudinary
        if (property.media && property.media.images) {
            for (const image of property.media.images) {
                if (image.public_id) {
                    await cloudinary.uploader.destroy(image.public_id);
                }
            }
        }
        
        if (property.media && property.media.videos) {
            for (const video of property.media.videos) {
                if (video.public_id) {
                    await cloudinary.uploader.destroy(video.public_id, { resource_type: 'video' });
                }
            }
        }

        await Property.findByIdAndDelete(id);
        
        // Log the action
        const history = new History({
            action: "deleteProperty",
            user: req.user._id,
            propertyId: id,
            details: {
                propertyTitle: property.title,
                landlordName: property.landlordInfo?.personalInfo?.fullName
            }
        });
        await history.save();

        res.status(200).json({
            success: true,
            message: "Property deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get landlord info by property ID (Admin only)
const handleGetLandlordInfoByPropertyId = async (req, res) => {
    try {
        const { propertyId } = req.params;
        
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                message: "Only admins can view landlord information" 
            });
        }

        const property = await Property.findById(propertyId);
        
        if (!property) {
            return res.status(404).json({ 
                success: false, 
                message: "Property not found" 
            });
        }

        // Get all properties with same landlord (based on phone/email)
        const landlordProperties = await Property.find({
            $or: [
                { 'landlordInfo.personalInfo.phone': property.landlordInfo.personalInfo.phone },
                { 'landlordInfo.personalInfo.email': property.landlordInfo.personalInfo.email }
            ],
            _id: { $ne: propertyId }
        }).select('title address city status price apartmentType');

        res.status(200).json({
            success: true,
            message: "Landlord information retrieved",
            data: {
                landlord: property.landlordInfo,
                currentProperty: {
                    _id: property._id,
                    title: property.title,
                    address: property.address
                },
                otherProperties: landlordProperties,
                totalPropertiesOwned: landlordProperties.length + 1
            }
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// Search properties by landlord info (Admin only)
const handleSearchPropertiesByLandlord = async (req, res) => {
    try {
        const { search, page = 1, limit = 20 } = req.query;
        
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                message: "Only admins can search by landlord" 
            });
        }

        let filter = { isActive: true };
        
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            filter.$or = [
                { 'landlordInfo.personalInfo.fullName': searchRegex },
                { 'landlordInfo.personalInfo.phone': searchRegex },
                { 'landlordInfo.personalInfo.email': searchRegex },
                { 'landlordInfo.personalInfo.idNumber': searchRegex }
            ];
        }

        const properties = await Property.find(filter)
            .select('title address city price status landlordInfo.personalInfo.fullName landlordInfo.personalInfo.phone')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Property.countDocuments(filter);

        res.status(200).json({
            success: true,
            message: "Properties found",
            count: properties.length,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            properties
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};




// ADD PROPERTY TO FAVOURITE
const addFavourite = async (req, res) => {
  try {
    const propertyId = req.params.propertyId;
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId).select("-password");
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found"
      });
    }

    if (!Array.isArray(user.favourites)) {
      user.favourites = [];
    }

    const index = user.favourites.findIndex(
      (id) => id.toString() === propertyId
    );

    if (index > -1) {
      return res.status(200).json({
        success: false,
        message: "Property already in favourite"
      });
    } else {
      user.favourites.push(propertyId);
      await user.save();
      return res.status(200).json({
        success: true,
        message: "Property added to favourite successfully"
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// REMOVE PROPERTY FROM FAVOURITES
const removeFavourite = async (req, res) => {
  try {
    const propertyId = req.params.propertyId;
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId).select("-password");
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found"
      });
    }

    if (!Array.isArray(user.favourites)) {
      user.favourites = [];
    }

    const index = user.favourites.findIndex(
      (id) => id.toString() === propertyId
    );

    if (index > -1) {
      user.favourites.splice(index, 1);
      await user.save();
      return res.status(200).json({
        success: true,
        message: "Property removed from favourite successfully"
      });
    } else {
      return res.status(404).json({
        success: false,
        message: "Property not in favourite"
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET FAVOURITES
const getFavourite = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId).populate("favourites").select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    res.status(200).json({
      success: true,
      message: "All favourites",
      count: user.favourites ? user.favourites.length : 0,
      favourites: user.favourites || []
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};





module.exports = {
    handlePropertyListing,
    handleGetAllProperty,
    handleShowAllPropertiesToTenant,
    handleShowPropertiesToTenantById,
    handleGetLandlordInfoByPropertyId,
    handleViewPropertyById,
    handleUpdateAPropertyById,
    handleGetLandlordInfoByPropertyId,
    handleSearchPropertiesByLandlord,
    deletePropertyById,
    addFavourite,
    removeFavourite,
    getFavourite
};