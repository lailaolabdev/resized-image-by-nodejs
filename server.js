const http = require("http");
const cors = require("cors");
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 3002;

// List of allowed origins
const allowedOrigins = [
    'https://example1.com',
    'https://example2.com',
];

// Set up CORS to allow requests from multiple origins
const corsOptions = {
    origin: (origin, callback) => {
        console.log("origin: ", origin)
        // Check if the origin is in the allowed origins list or if there is no origin (like for curl requests)
        if (allowedOrigins.includes(origin) || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Create multer storage with dynamic filename setting
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = '/app/files'; // Inside Docker container
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Multer handles req.body after file parsing, we need to access it before here
        const extension = path.extname(file.originalname);
        let fileName = req.body.file_name;
        
        if (!fileName) {
            fileName = uuidv4(); // Use a UUID if no filename is provided
        }
        
        cb(null, `${fileName}${extension}`);
    }
});

const uploadFile = multer({ storage: storage });

// Function to get the correct extension from the original file name
function getExtension(filename) {
    return path.extname(filename);
}

// Resize image function
async function resizeImage(inputPath, baseOutputDir, originalFilename) {
    try {
        const originalDir = path.join(baseOutputDir, 'original');
        const mediumDir = path.join(baseOutputDir, 'medium');
        const smallDir = path.join(baseOutputDir, 'small');

        const extension = getExtension(originalFilename);
        const uuid = uuidv4();
        const imageName = `${uuid}${extension}`;

        const originalPath = path.join(originalDir, imageName);
        const mediumPath = path.join(mediumDir, imageName);
        const smallPath = path.join(smallDir, imageName);

        fs.copyFileSync(inputPath, originalPath);

        const image = sharp(inputPath);

        await image.resize(900).jpeg({ quality: 80 }).toFile(mediumPath);
        await image.resize(300).jpeg({ quality: 90 }).toFile(smallPath);

        return imageName;
    } catch (err) {
        console.error('Error in resizeImage function:', err);  // Log function error
        return null;  // Ensure the error is propagated
    }
}

// Define the upload route for images
app.post('/upload-image', uploadFile.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' }); // Check if there is a file (req.file)
    const inputPath = req.file.path;
    const originalFilename = req.file.originalname;
    const outputDir = path.join(__dirname, 'images');
    try {
        const resizedImages = await resizeImage(inputPath, outputDir, originalFilename);
        res.status(200).json({
            message: 'Images have been resized and saved.',
            imageName: resizedImages
        });
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Error resizing images.', error: err.message });
    } finally {
        try {
            fs.unlinkSync(inputPath);
        } catch (unlinkErr) {
            console.error('Error deleting the file:', unlinkErr);  // Log file deletion error
        }
    }
});

// Serve static files from the images directory
app.use('/images', express.static(path.join(__dirname, 'images')));

// Define the upload route for files
app.post('/upload-file', (req, res) => {
    // We need to run multer middleware manually to ensure we can set the filename dynamically
    const upload = uploadFile.single('file');
    upload(req, res, function (err) {
        if (err) {
            return res.status(500).json({ message: 'Error uploading file.', error: err.message });
        }
        const file = req.file;
        const fileName = req.body.file_name;

        if (!file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }
        res.status(200).json({
            message: 'File has been uploaded.',
            fileName: file.filename,
            customFileName: fileName
        });
    });
});

// Serve static files from the files directory
app.use('/files', express.static(path.join(__dirname, 'files')));

// Error-handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
});

const server = http.createServer(app);
server.listen(port, () => {
    console.log("Server up and Running on port", port);
});