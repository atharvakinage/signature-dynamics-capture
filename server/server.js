const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

const OUTPUT_DIR = path.join(__dirname, 'signatures');
const IMAGES_DIR = path.join(OUTPUT_DIR, 'images');
const METRICS_DIR = path.join(OUTPUT_DIR, 'metrics');

[OUTPUT_DIR, IMAGES_DIR, METRICS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

app.use(express.json({ limit: '50mb' }));

app.post('/save-signature', (req, res) => {
    try {
      const { image, metrics, timestamp } = req.body;
  
      if (!image) {
        throw new Error('No image data received');
      }
  
      // Check if the image is in a valid base64 format
      const imageData = image.split(',')[1]; // Split out the base64 part of the image
      if (!imageData) {
        throw new Error('Invalid image format');
      }
  
      // Save signature image
      const imageBuffer = Buffer.from(imageData, 'base64');
      const imagePath = path.join(IMAGES_DIR, `signature_${timestamp}.png`);
      fs.writeFileSync(imagePath, imageBuffer);
  
      // Save metrics CSV
      if (!metrics) {
        throw new Error('No metrics data received');
      }
      const metricsPath = path.join(METRICS_DIR, `signature_metrics_${timestamp}.csv`);
      fs.writeFileSync(metricsPath, metrics);
  
      console.log('Files saved successfully:');
      console.log('Image:', imagePath);
      console.log('Metrics:', metricsPath);
  
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving files:', error);
      res.status(500).json({ error: error.message });
    }
  });
  

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});