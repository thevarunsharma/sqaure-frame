class SquareFrameProcessor {
    constructor() {
        this.initializeElements();
        this.attachEventListeners();
        this.currentFile = null;
    }

    initializeElements() {
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.processingSection = document.getElementById('processingSection');
        this.originalImage = document.getElementById('originalImage');
        this.processedCanvas = document.getElementById('processedCanvas');
        this.originalInfo = document.getElementById('originalInfo');
        this.processedInfo = document.getElementById('processedInfo');
        this.processBtn = document.getElementById('processBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.borderWidthInput = document.getElementById('borderWidth');
    }

    attachEventListeners() {
        // Upload area click
        this.uploadArea.addEventListener('click', () => {
            this.fileInput.click();
        });

        // File input change
        this.fileInput.addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files[0]);
        });

        // Drag and drop
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('dragover');
        });

        this.uploadArea.addEventListener('dragleave', () => {
            this.uploadArea.classList.remove('dragover');
        });

        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) {
                const isHeic = file.type === 'image/heic' || file.type === 'image/heif' || 
                               file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
                
                if (file.type.startsWith('image/') || isHeic) {
                    this.handleFileSelect(file);
                }
            }
        });

        // Button clicks
        this.processBtn.addEventListener('click', () => {
            this.processImage();
        });

        this.downloadBtn.addEventListener('click', () => {
            this.downloadProcessedImage();
        });

        this.resetBtn.addEventListener('click', () => {
            this.resetApp();
        });

        // Border width input change - auto-process if image is loaded
        this.borderWidthInput.addEventListener('input', () => {
            if (this.originalImage.src && this.downloadBtn.style.display !== 'none') {
                this.processImage();
            }
        });
    }

    handleFileSelect(file) {
        if (!file) {
            alert('Please select a valid file');
            return;
        }

        // Check if it's a HEIC file or regular image
        const isHeic = file.type === 'image/heic' || file.type === 'image/heif' || 
                       file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
        
        if (!isHeic && !file.type.startsWith('image/')) {
            alert('Please select a valid image file (JPEG, PNG, WebP, HEIC)');
            return;
        }

        this.currentFile = file;
        
        if (isHeic) {
            this.convertAndDisplayHeic(file);
        } else {
            this.displayOriginalImage(file);
        }
    }

    async convertAndDisplayHeic(file) {
        try {
            // Show loading state
            this.showProcessingSection();
            this.originalInfo.innerHTML = '<strong>Converting HEIC file...</strong><br><small>Trying multiple conversion methods</small>';
            
            console.log('Starting HEIC conversion for file:', file.name, 'Size:', file.size);
            
            // Check file size first (very large files often fail)
            if (file.size > 15 * 1024 * 1024) { // 15MB
                throw new Error('File too large. HEIC files larger than 15MB are not supported. Please use a smaller image or convert manually.');
            }
            
            let convertedBlob;
            let conversionMethod = '';
            
            // Method 1: Try the newer @alexcorvi/heic2any library first
            try {
                if (typeof window.heic2any !== 'undefined') {
                    console.log('Attempting conversion with @alexcorvi/heic2any...');
                    convertedBlob = await window.heic2any({
                        blob: file,
                        toType: 'image/jpeg',
                        quality: 0.9
                    });
                    conversionMethod = 'alexcorvi';
                    console.log('HEIC conversion successful with @alexcorvi/heic2any');
                } else {
                    throw new Error('Library not available');
                }
            } catch (alexcorviError) {
                console.log('@alexcorvi/heic2any failed:', alexcorviError.message);
                
                // Method 2: Try the original heic2any library
                try {
                    if (typeof heic2any !== 'undefined') {
                        console.log('Attempting conversion with original heic2any...');
                        convertedBlob = await heic2any({
                            blob: file,
                            toType: 'image/jpeg',
                            quality: 0.8
                        });
                        conversionMethod = 'original';
                        console.log('HEIC conversion successful with original heic2any');
                    } else {
                        throw new Error('Library not available');
                    }
                } catch (originalError) {
                    console.log('Original heic2any failed:', originalError.message);
                    
                    // Method 3: Try using Canvas API with FileReader (for some HEIC files that browsers can decode)
                    try {
                        console.log('Attempting direct browser decoding...');
                        convertedBlob = await this.tryBrowserHeicDecoding(file);
                        conversionMethod = 'browser';
                        console.log('HEIC conversion successful with browser decoding');
                    } catch (browserError) {
                        console.log('Browser decoding failed:', browserError.message);
                        
                        // If all methods fail, check if it's the format not supported error
                        if (originalError.message && originalError.message.includes('format not supported')) {
                            throw new Error('HEIC_FORMAT_NOT_SUPPORTED');
                        } else {
                            throw originalError;
                        }
                    }
                }
            }
            
            // Handle array of blobs (in case multiple is true)
            if (Array.isArray(convertedBlob)) {
                convertedBlob = convertedBlob[0];
            }
            
            // Create a new File object from the converted blob
            const fileExtension = convertedBlob.type === 'image/png' ? '.png' : '.jpg';
            const convertedFile = new File([convertedBlob], 
                file.name.replace(/\.(heic|heif)$/i, fileExtension), 
                { type: convertedBlob.type });
            
            console.log(`Converted file created using ${conversionMethod}:`, convertedFile.name, 'Type:', convertedFile.type, 'Size:', convertedFile.size);
            
            this.currentFile = convertedFile;
            this.displayOriginalImage(convertedFile);
            
        } catch (error) {
            console.error('HEIC conversion failed:', error);
            console.error('Error details:', {
                message: error.message,
                name: error.name,
                stack: error.stack
            });
            
            if (error.message === 'HEIC_FORMAT_NOT_SUPPORTED') {
                this.showHeicFormatNotSupportedMessage();
            } else if (error.message.includes('not loaded')) {
                alert('HEIC conversion library failed to load. Please check your internet connection and reload the page.');
            } else if (error.message.includes('fetch')) {
                alert('Network error while loading HEIC conversion resources. Please check your internet connection and try again.');
            } else if (error.message.includes('too large')) {
                alert(error.message);
            } else {
                alert(`Failed to convert HEIC file: ${error.message}\n\nThis could be due to:\n• Unsupported HEIC variant\n• Corrupted file\n• Very large file size\n\nTry:\n• Converting to JPEG manually\n• Using a different HEIC file\n• Reducing file size`);
            }
            this.resetApp();
        }
    }

    async tryBrowserHeicDecoding(file) {
        return new Promise((resolve, reject) => {
            // Create an image element to test if browser can decode HEIC
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            img.onload = () => {
                try {
                    // Set canvas size to image size
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    
                    // Draw image to canvas
                    ctx.drawImage(img, 0, 0);
                    
                    // Convert canvas to blob
                    canvas.toBlob((blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Failed to create blob from canvas'));
                        }
                    }, 'image/jpeg', 0.9);
                } catch (err) {
                    reject(err);
                }
            };
            
            img.onerror = () => {
                reject(new Error('Browser cannot decode this HEIC file'));
            };
            
            // Try to load the HEIC file directly
            const url = URL.createObjectURL(file);
            img.src = url;
            
            // Clean up after 10 seconds
            setTimeout(() => {
                URL.revokeObjectURL(url);
                reject(new Error('Timeout: Browser decoding took too long'));
            }, 10000);
        });
    }

    showHeicFormatNotSupportedMessage() {
        const message = `This HEIC file format variant is not supported by the current conversion library.

This often happens with:
• Photos from newer iPhone models (iPhone 13+)
• Photos with special encoding or Live Photos
• HEIC files with advanced compression

Solutions:
1. Convert to JPEG on your iPhone:
   • Open the photo in Photos app
   • Tap Share → Save to Files → change format to JPEG

2. Change iPhone camera settings:
   • Settings → Camera → Formats
   • Select "Most Compatible" (saves as JPEG)

3. Use online conversion tools:
   • CloudConvert, Convertio, or similar services

4. Use desktop software:
   • Preview (Mac), Photos app, or image editing software

Would you like to try with a different image?`;

        alert(message);
    }

    displayOriginalImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.originalImage.src = e.target.result;
            this.originalImage.onload = () => {
                this.showProcessingSection();
                this.updateOriginalInfo();
            };
        };
        reader.readAsDataURL(file);
    }

    showProcessingSection() {
        this.processingSection.style.display = 'block';
        this.processingSection.scrollIntoView({ behavior: 'smooth' });
    }

    updateOriginalInfo() {
        const img = this.originalImage;
        const fileSize = (this.currentFile.size / 1024 / 1024).toFixed(2);
        
        // Check if this was originally a HEIC file (more robust detection)
        const originalFileName = this.currentFile.name;
        const wasHeic = originalFileName.toLowerCase().includes('heic') || 
                       originalFileName.toLowerCase().includes('heif') ||
                       (originalFileName.includes('.jpg') && originalFileName.includes('heic')) ||
                       (originalFileName.includes('.png') && originalFileName.includes('heic'));
        const formatNote = wasHeic ? ' (converted from HEIC)' : '';
        
        this.originalInfo.innerHTML = `
            <strong>Dimensions:</strong> ${img.naturalWidth} × ${img.naturalHeight}px<br>
            <strong>File Size:</strong> ${fileSize} MB<br>
            <strong>Format:</strong> ${this.currentFile.type}${formatNote}
        `;
    }

    processImage() {
        if (!this.originalImage.src) return;

        // Show loading state
        this.processBtn.classList.add('loading');
        this.processBtn.disabled = true;
        this.processBtn.textContent = 'Processing...';

        // Use setTimeout to allow UI to update
        setTimeout(() => {
            this.performImageProcessing();
        }, 100);
    }

    performImageProcessing() {
        const img = this.originalImage;
        const originalWidth = img.naturalWidth;
        const originalHeight = img.naturalHeight;

        // Get border width percentage from input (default 2.5%)
        const borderPercentage = parseFloat(this.borderWidthInput.value) || 2.5;
        
        // Calculate border size (percentage of the maximum dimension)
        const maxDimension = Math.max(originalWidth, originalHeight);
        const borderSize = Math.round(maxDimension * (borderPercentage / 100));

        // Calculate dimensions with border
        const widthWithBorder = originalWidth + (2 * borderSize);
        const heightWithBorder = originalHeight + (2 * borderSize);

        // Calculate final square dimension
        const squareDimension = Math.max(widthWithBorder, heightWithBorder);

        // Set canvas size to the final square dimension
        this.processedCanvas.width = squareDimension;
        this.processedCanvas.height = squareDimension;

        const ctx = this.processedCanvas.getContext('2d');

        // Fill the entire canvas with white
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, squareDimension, squareDimension);

        // Calculate position to center the image with border in the square
        const xOffset = (squareDimension - widthWithBorder) / 2;
        const yOffset = (squareDimension - heightWithBorder) / 2;

        // Draw the original image centered with border
        const imageX = xOffset + borderSize;
        const imageY = yOffset + borderSize;

        ctx.drawImage(img, imageX, imageY, originalWidth, originalHeight);

        // Update processed image info
        this.updateProcessedInfo(squareDimension, borderSize);

        // Show download button and reset button states
        this.downloadBtn.style.display = 'inline-flex';
        this.processBtn.classList.remove('loading');
        this.processBtn.disabled = false;
        this.processBtn.textContent = 'Process Image';
    }

    updateProcessedInfo(dimension, borderSize) {
        const canvas = this.processedCanvas;
        const borderPercentage = parseFloat(this.borderWidthInput.value) || 2.5;
        
        // Determine output format based on original file
        const outputFormat = this.getOutputFormat();
        const quality = outputFormat === 'image/jpeg' ? 0.9 : 1.0;
        
        // Calculate approximate file size
        canvas.toBlob((blob) => {
            const fileSize = (blob.size / 1024 / 1024).toFixed(2);
            const formatName = outputFormat === 'image/jpeg' ? 'JPEG' : 'PNG';
            this.processedInfo.innerHTML = `
                <strong>Dimensions:</strong> ${dimension} × ${dimension}px (Square)<br>
                <strong>Border Size:</strong> ${borderSize}px (${borderPercentage}%)<br>
                <strong>Estimated Size:</strong> ${fileSize} MB<br>
                <strong>Format:</strong> ${formatName}
            `;
        }, outputFormat, quality);
    }

    getOutputFormat() {
        // Match the original file format, default to JPEG for HEIC conversions
        if (this.currentFile.type === 'image/png') {
            return 'image/png';
        } else if (this.currentFile.type === 'image/jpeg') {
            return 'image/jpeg';
        } else {
            // For HEIC conversions and other formats, default to JPEG
            return 'image/jpeg';
        }
    }

    getOutputExtension() {
        const format = this.getOutputFormat();
        return format === 'image/png' ? '.png' : '.jpg';
    }

    downloadProcessedImage() {
        const canvas = this.processedCanvas;
        const link = document.createElement('a');
        
        // Generate filename with appropriate extension
        const originalName = this.currentFile.name.split('.')[0];
        const extension = this.getOutputExtension();
        const filename = `${originalName}_square_framed${extension}`;
        
        // Use matching format and quality
        const outputFormat = this.getOutputFormat();
        const quality = outputFormat === 'image/jpeg' ? 0.9 : 1.0;
        
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            link.href = url;
            link.download = filename;
            link.click();
            URL.revokeObjectURL(url);
        }, outputFormat, quality);
    }

    resetApp() {
        // Reset file input
        this.fileInput.value = '';
        this.currentFile = null;
        
        // Hide processing section
        this.processingSection.style.display = 'none';
        
        // Reset button states
        this.downloadBtn.style.display = 'none';
        this.processBtn.disabled = false;
        this.processBtn.classList.remove('loading');
        this.processBtn.textContent = 'Process Image';
        
        // Clear images
        this.originalImage.src = '';
        const ctx = this.processedCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.processedCanvas.width, this.processedCanvas.height);
        
        // Clear info
        this.originalInfo.innerHTML = '';
        this.processedInfo.innerHTML = '';
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if HEIC libraries are available
    setTimeout(() => {
        const libraries = [];
        if (typeof heic2any !== 'undefined') {
            libraries.push('heic2any (original)');
        }
        if (typeof window.heic2any !== 'undefined') {
            libraries.push('@alexcorvi/heic2any');
        }
        
        if (libraries.length > 0) {
            console.log('HEIC conversion libraries loaded:', libraries.join(', '));
        } else {
            console.warn('No HEIC conversion libraries available');
        }
    }, 2000);
    
    new SquareFrameProcessor();
});

// Prevent default drag behaviors on the document
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());
