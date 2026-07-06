const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Configure local storage path
const uploadDir = path.join(__dirname, '../../uploads');

// Ensure the upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer disk storage configuration
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique name: timestamp + random number + original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'visita-' + uniqueSuffix + ext);
  }
});

// File filter (accept only images)
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes (JPG, PNG, WEBP, etc.)'), false);
  }
};

// Configure upload middleware
const upload = multer({
  storage: diskStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

/**
 * Storage Service Abstraction
 * Handles saving and deleting files. Currently supports local storage.
 * To migrate to Cloudflare R2, rewrite the contents of saveFile and deleteFile.
 */
const storageService = {
  /**
   * Save uploaded file and return its URL/path
   * @param {Object} file - The file object from Multer
   * @param {Object} req - The Express request object (to construct URLs if needed)
   * @returns {Promise<string>} The relative file URL to save in the database
   */
  saveFile: async (file, req) => {
    // Local implementation: returns the URL path to access the file
    // Example: /uploads/visita-123456.jpg
    return `/uploads/${file.filename}`;
  },

  /**
   * Delete a file from storage
   * @param {string} fileUrl - The saved database URL path
   * @returns {Promise<void>}
   */
  deleteFile: async (fileUrl) => {
    // Local implementation: delete file from system
    try {
      const filename = path.basename(fileUrl);
      const filePath = path.join(uploadDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted file: ${filePath}`);
      }
    } catch (error) {
      console.error(`Error deleting local file ${fileUrl}:`, error);
    }
  }
};

module.exports = {
  upload,
  storageService
};
