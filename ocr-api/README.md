# OCR Node.js API

This is a standalone Node.js API for OCR processing, ported from the Next.js implementation.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   npm start
   ```

## API Endpoints

### POST `/api/ocr`

Accepts `multipart/form-data`:
- `image`: The image file to process (Required)
- `text`: Literal text to search for (Optional)
- `regex`: Regex pattern to match (Optional)
- `fields`: Comma-separated list of field names to extract (Optional)

#### Example Request (cURL):
```bash
curl -X POST http://localhost:3001/api/ocr \
  -F "image=@document.jpg" \
  -F "fields=Name,Date,Amount"
```

## Features
- Image pre-processing using Jimp (Greyscale, Contrast, Normalize, Resize).
- OCR using Tesseract.js.
- Literal and Regex matching.
- Multi-field extraction logic.
