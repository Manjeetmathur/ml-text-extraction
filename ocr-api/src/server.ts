import express, { Request, Response } from 'express';
import multer from 'multer';
import Tesseract from 'tesseract.js';
import path from 'path';
import { Jimp } from 'jimp';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Set up multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`OCR Node.js API listening at http://localhost:${port}`);
});


// POST endpoint for OCR
app.post('/api/ocr', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const imageFile = req.file;
    const searchText = req.body.text as string | undefined;
    const regexPattern = req.body.regex as string | undefined;
    const fieldsToExtract = req.body.fields as string | undefined;

    if (!imageFile) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Pre-processing with Jimp
    const jimpImage = await Jimp.read(imageFile.buffer);
    const processedBuffer = await jimpImage
      .greyscale()
      .contrast(0.7)
      .normalize()
      .resize({ w: jimpImage.width * 2, h: jimpImage.height * 2 })
      .getBuffer("image/png");

    // Initialize Tesseract worker with both English and Hindi to detect script accurately
    // This prevents Hindi text from being forced into gibberish English characters
    const worker = await Tesseract.createWorker(['eng', 'hin'], 1, {
      langPath: process.cwd(),
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${(m.progress * 100).toFixed(2)}%`);
        }
      },
    });

    await worker.setParameters({
      tessedit_pageseg_mode: '3' as any,
    });

    const { data: { text: rawExtract } } = await worker.recognize(processedBuffer);
    await worker.terminate();

    // Clean text: Remove Hindi (Devanagari) characters but keep English/symbols
    const text = rawExtract.replace(/[\u0900-\u097F]/g, '').trim();
    console.log("Extracted text (Hindi filtered):", text);
    // Results logic
    let textFound = false;
    let matchedText: string | null = null;
    let regexFound = false;
    let matchedRegex: string | null = null;
    let extractedData: Record<string, string> = {};

    // 1. Literal Search
    if (searchText && searchText.trim().length > 0) {
      matchedText = searchValueInText(searchText, text);
      textFound = matchedText !== null;
    }

    // 2. Regex Search
    if (regexPattern && regexPattern.trim().length > 0) {
      const regexMatch = regexPattern.match(/^\/(.+)\/([a-z]*)$/);
      const regex = regexMatch 
        ? new RegExp(regexMatch[1], regexMatch[2]) 
        : new RegExp(regexPattern, 'i');

      const match = text.match(regex);
      if (match) {
        regexFound = true;
        matchedRegex = match[0];
      }
    }

    // 3. Multi-Field Extraction
    if (fieldsToExtract) {
      const fields = fieldsToExtract.split(',').map(f => f.trim());
      const extraction = extractFieldsManually(text, fields, searchText);
      extractedData = extraction.extractedData;
    }

    return res.json({ 
      found: textFound || regexFound || Object.values(extractedData).some(v => v.length > 0),
      textFound,
      regexFound,
      matchedText,
      matchedRegex,
      extractedData,
      rawText: text 
    });

  } catch (error) {
    console.error('OCR Processing Error:', error);
    return res.status(500).json({
      error: 'Failed to process image',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});




/**
 * Normalizes a string for comparison by removing all non-alphanumeric characters 
 * and converting to lowercase.
 */
function normalizeValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '') // Remove all spaces
    .replace(/[^\w]/g, ''); // Remove special characters, keep only alphanumeric
}


/**
 * Searches for a value in text using normalized comparison but returns
 * the ORIGINAL substring from the raw text for alignment.
 */

function searchValueInText(searchValue: string, text: string): string | null {
  if (!searchValue || !text) return null;
  
  const trimmedValue = searchValue.trim();
  if (trimmedValue.length === 0) return null;

  const normalizedSearch = normalizeValue(trimmedValue);
  const normalizedText = normalizeValue(text);
  
  if (normalizedText.includes(normalizedSearch)) {
    const index = normalizedText.indexOf(normalizedSearch);
    const endIndex = index + normalizedSearch.length;
    
    let originalStart = -1;
    let originalEnd = -1;
    let normalizedIndex = 0;
    
    // Map normalized index back to original text positions
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const normalizedChar = normalizeValue(char);
      if (normalizedChar.length > 0) {
        if (normalizedIndex === index && originalStart === -1) {
          originalStart = i;
        }
        if (normalizedIndex === endIndex - 1 && originalEnd === -1) {
          originalEnd = i + 1;
          break;
        }
        normalizedIndex++;
      } else if (normalizedIndex === index && originalStart === -1) {
        originalStart = i;
      }
    }
    
    if (originalStart !== -1 && originalEnd !== -1) {
      const candidate = text.substring(originalStart, originalEnd).trim();
      const normalizedCandidate = normalizeValue(candidate);
      
      if (normalizedCandidate === normalizedSearch) {
        return candidate;
      }
    }
  }

  return null;
}

/**
 * Extracts field values from OCR text using multiple pattern matching strategies.
 */
function extractFieldsManually(
  text: string,
  fields: string[],
  searchText?: string
): { extractedData: Record<string, string>; missingFields: string[] } {
  const extractedData: Record<string, string> = {};
  const missingFields: string[] = [];

  fields.forEach((fieldName) => {
    const normalizedFieldName = fieldName.toLowerCase().trim();
    let found = false;
    let extractedValue = "";

    // PRIORITY 1: Search for entered search text directly if it matches the field's intent
    if (searchText && searchText.trim().length > 0) {
      const foundValue = searchValueInText(searchText, text);
      if (foundValue) {
        extractedValue = foundValue;
        found = true;
      }
    }

    // PRIORITY 2: Try to extract by field name patterns (colon, space, nearby text)
    if (!found) {
      // Pattern 1: "FieldName: value"
      const colonPattern = new RegExp(
        `(?:^|\\s)${normalizedFieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:：]\\s*(.+?)(?:\\n|$)`,
        'i'
      );
      const colonMatch = text.match(colonPattern);
      if (colonMatch && colonMatch[1]) {
        extractedValue = colonMatch[1].trim();
        found = true;
      }

      // Pattern 2: "FieldName value"
      if (!found) {
        const spacePattern = new RegExp(
          `(?:^|\\s)${normalizedFieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(.+?)(?:\\n|$)`,
          'i'
        );
        const spaceMatch = text.match(spacePattern);
        if (spaceMatch && spaceMatch[1] && spaceMatch[1].trim().length > 0) {
          extractedValue = spaceMatch[1].trim();
          found = true;
        }
      }

      // Pattern 3: Proximity search
      if (!found) {
        const normalizedText = text.toLowerCase();
        const fieldNameIndex = normalizedText.indexOf(normalizedFieldName);
        if (fieldNameIndex !== -1) {
          const afterFieldName = text.substring(fieldNameIndex + normalizedFieldName.length);
          const valueMatch = afterFieldName.match(/^\s*[:：]?\s*([^\n]+)/);
          if (valueMatch && valueMatch[1]) {
            extractedValue = valueMatch[1].trim();
            if (extractedValue.length > 0) {
              found = true;
            }
          }
        }
      }
    }

    if (found && extractedValue.length > 0) {
      extractedData[fieldName] = extractedValue;
    } else {
      missingFields.push(fieldName);
      extractedData[fieldName] = "";
    }
  });

  return { extractedData, missingFields };
}