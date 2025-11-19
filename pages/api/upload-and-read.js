// pages/api/upload-and-read.js
import { IncomingForm } from 'formidable';
import fs from 'fs';
import csv from 'csv-parser';
import * as xlsx from 'xlsx';

// Function to parse the file (reused from the old process.js)
function parseFile(filePath, fileName) {
    return new Promise((resolve, reject) => {
        const results = [];
        if (fileName.endsWith('.csv')) {
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', () => {
                    resolve(results);
                })
                .on('error', (error) => reject(new Error(`CSV Parsing Error: ${error.message}`)));
        } else if (fileName.endsWith('.xlsx')) {
            try {
                const workbook = xlsx.readFile(filePath);
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json_data = xlsx.utils.sheet_to_json(worksheet);
                resolve(json_data);
            } catch (error) {
                reject(new Error(`Excel Parsing Error: ${error.message}`));
            }
        } else {
            reject(new Error('Unsupported file type. Please upload CSV or XLSX.'));
        }
    });
}

export const config = {
    api: {
        bodyParser: false, 
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const form = new IncomingForm();

    form.parse(req, async (err, fields, files) => {
        if (err) {
            return res.status(500).json({ message: 'Error parsing form data', error: err.message });
        }

        const uploadedFile = files.file[0];

        if (!uploadedFile) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }

        let originalData;
        try {
            originalData = await parseFile(uploadedFile.filepath, uploadedFile.originalFilename);
        } catch (error) {
            return res.status(400).json({ message: error.message });
        } finally {
            // Clean up the temporary file
            fs.unlink(uploadedFile.filepath, (unlinkErr) => {
                if (unlinkErr) console.error("Error deleting temp file:", unlinkErr);
            });
        }

        // Standardize column names and check requirements
        const standardizedData = originalData.map(row => {
            const newRow = {};
            for (const key in row) {
                newRow[key.toLowerCase().trim()] = row[key];
            }
            return newRow;
        });

        const requiredColumns = ['sender', 'text'];
        if (!standardizedData.every(row => requiredColumns.every(col => col in row))) {
            return res.status(400).json({ message: `File must contain 'sender' and 'text' columns.` });
        }

        // Return only the raw data (sender, text)
        return res.status(200).json({
            message: 'File read successfully',
            data: standardizedData.map(row => ({ sender: String(row.sender), text: String(row.text) })),
        });
    });
}