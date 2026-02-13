// utils/multerConfig.js
const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

// Enhanced file filter for both images and videos
const fileFilter = (req, file, cb) => {
  // Check if it's an image
  const imageTypes = /jpeg|jpg|png|gif|webp|avif/;
  const isImage = imageTypes.test(path.extname(file.originalname).toLowerCase()) && 
                  file.mimetype.startsWith('image/');
  
  // Check if it's a video
  const videoTypes = /mp4|avi|mov|mkv|webm/;
  const isVideo = videoTypes.test(path.extname(file.originalname).toLowerCase()) && 
                  file.mimetype.startsWith('video/');

  if (isImage || isVideo) {
    return cb(null, true);
  } else {
    cb(new Error('Only image and video files are allowed. Images: JPEG, JPG, PNG, GIF, WEBP, AVIF. Videos: MP4, AVI, MOV, MKV, WEBM'));
  }
};

// Create separate upload instances for different scenarios
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter
});

// For single image upload (payment receipts, profile pictures, etc.)
const uploadSingleImage = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB for receipts
  },
  fileFilter: (req, file, cb) => {
    const imageTypes = /jpeg|jpg|png|gif|webp|avif/;
    const isImage = imageTypes.test(path.extname(file.originalname).toLowerCase()) && 
                    file.mimetype.startsWith('image/');
    
    if (isImage) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (JPEG, JPG, PNG, GIF, WEBP, AVIF)'));
    }
  }
}).single('receiptImage'); // Specify the field name here

// For multiple images upload
const uploadImages = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB for images
  },
  fileFilter: (req, file, cb) => {
    const imageTypes = /jpeg|jpg|png|gif|webp|avif/;
    const isImage = imageTypes.test(path.extname(file.originalname).toLowerCase()) && 
                    file.mimetype.startsWith('image/');
    
    if (isImage) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (JPEG, JPG, PNG, GIF, WEBP, AVIF)'));
    }
  }
}).array('images', 10); // Max 10 images

// For video upload
const uploadVideos = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const videoTypes = /mp4|avi|mov|mkv|webm/;
    const isVideo = videoTypes.test(path.extname(file.originalname).toLowerCase()) && 
                    file.mimetype.startsWith('video/');
    
    if (isVideo) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed (MP4, AVI, MOV, MKV, WEBM)'));
    }
  }
}).single('video'); // Single video

// For property listing with multiple images and optional video
const uploadPropertyMedia = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter
}).fields([
  { name: 'images', maxCount: 10 },
  { name: 'videos', maxCount: 1 }
]);

// For payment receipt upload
const uploadPaymentReceipt = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB for receipts
  },
  fileFilter: (req, file, cb) => {
    const imageTypes = /jpeg|jpg|png|gif|webp|avif/;
    const isImage = imageTypes.test(path.extname(file.originalname).toLowerCase()) && 
                    file.mimetype.startsWith('image/');
    
    // Also allow PDF for receipts
    const isPDF = file.mimetype === 'application/pdf';
    
    if (isImage || isPDF) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, JPG, PNG) and PDF files are allowed for receipts'));
    }
  }
}).single('receiptImage');

module.exports = {
  upload,
  uploadSingleImage,
  uploadImages,
  uploadVideos,
  uploadPropertyMedia,
  uploadPaymentReceipt
};