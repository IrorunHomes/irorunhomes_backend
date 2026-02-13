
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware')
const {
    handlePropertyListing,
    handleGetAllProperty,
    handleShowAllPropertiesToTenant,
    handleShowPropertiesToTenantById,
    handleViewPropertyById,
    handleUpdateAPropertyById,
    handleGetLandlordInfoByPropertyId,
    handleSearchPropertiesByLandlord,
    deletePropertyById,
    addFavourite,
    removeFavourite,
    getFavourite
} = require('../controllers/propertyController');
const { uploadPropertyMedia } = require('../utils/multer');



// Property routes
router.post('/list-property', 
    protect, 
    authorizeRoles(['admin', 'super_admin']),
    uploadPropertyMedia, 
    handlePropertyListing
);
    
router.get('/all-properties', protect, authorizeRoles(['admin', 'super_admin']), handleGetAllProperty);
router.get('/public', handleShowAllPropertiesToTenant);
router.get('/public/:id', handleShowPropertiesToTenantById);
router.get('/property/:id', protect, authorizeRoles(['admin', 'super_admin']), handleViewPropertyById);
router.put('/update-property/:id', protect, authorizeRoles(['admin', 'super_admin']), handleUpdateAPropertyById);
router.get('/landlord-info/:propertyId', protect, authorizeRoles(['admin', 'super_admin']), handleGetLandlordInfoByPropertyId);
router.get('/search-by-landlord/:landlordId', protect, authorizeRoles(['admin', 'super_admin']), handleSearchPropertiesByLandlord);
router.delete('/delete-property/:id', protect, authorizeRoles(['admin', 'super_admin']), deletePropertyById);
router.post('/add-favourite/:propertyId', protect, addFavourite);
router.delete('/remove-favourite/:propertyId', protect, removeFavourite);
router.get('/my-favourites', protect, getFavourite);

module.exports = router;