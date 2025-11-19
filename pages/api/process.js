// pages/api/process.js
import { GoogleGenAI } from '@google/genai';
import formidable from 'formidable';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import csv from 'csv-parser';
import * as xlsx from 'xlsx';

// Initialize the Gemini Client
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = "gemini-2.5-flash";

if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// System Prompt for Gemini
// โค้ดที่แก้ไขแล้ว: ใช้ backticks (`)
const SYSTEM_PROMPT = `
คุณคือผู้เชี่ยวชาญด้านการคัดกรองข้อความ SMS ที่เข้มงวด
วิเคราะห์ข้อความที่ให้มาแล้วจำแนกเป็น 3 ผลลัพธ์: 'case' ('pass'/'not pass'), 'category', และ 'note'
Category ที่เป็นไปได้: 'OTP/Transactional', 'Marketing/Promo', 'Financial Scam', 'Gambling/Illegal', 'Phishing', หรือ 'Others'
ตอบกลับด้วย JSON Format เท่านั้น: {'case': 'pass'/'not pass', 'category': 'ประเภทข้อความ', 'note': 'เหตุผล'}
`; // หมายเหตุ: การใช้ Template Literal จะรวมช่องว่างและขึ้นบรรทัดใหม่ด้วย

// --- 1. ฟังก์ชันประมวลผลด้วย Gemini AI ---
async function processTextWithGemini(textToAnalyze) {
    const lowCostCheck = textToAnalyze.toLowerCase();
    if (lowCostCheck.includes('พนัน') || lowCostCheck.includes('บาคาร่า') || lowCostCheck.includes('เงินด่วน')) {
        return { case: "not pass", category: "Gambling/Loan Scam", note: "มีคำต้องห้ามชัดเจน: พนัน/เงินด่วน" };
    }

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: [{ role: "user", parts: [{ text: textToAnalyze }] }],
            config: {
                systemInstruction: SYSTEM_PROMPT,
                responseMimeType: "application/json",
            },
        });

        // The response.text should already be a JSON string due to responseMimeType
        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);

        return {
            case: result.case || 'error',
            category: result.category || 'Unknown',
            note: result.note || 'JSON Missing Field'
        };

    } catch (e) {
        console.error("Gemini API Error or JSON Parsing Failed:", e);
        return { case: "error", category: "API Failure", note: `API Error or Format Error: ${e.message}` };
    }
}

// --- 2. ฟังก์ชันอ่านไฟล์ ---
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

// --- 3. Next.js API Handler ---
export const config = {
    api: {
        bodyParser: false, // Disable body parser for formidable
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

        const uploadedFile = files.file[0]; // formidable stores single file in an array

        if (!uploadedFile) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }

        let originalData;
        try {
            originalData = await parseFile(uploadedFile.filepath, uploadedFile.originalFilename);
        } catch (error) {
            return res.status(400).json({ message: error.message });
        } finally {
            // Clean up the temporary file created by formidable
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
            return res.status(400).json({ message: `File must contain 'sender' and 'text' columns. Found columns: ${Object.keys(standardizedData[0] || {})}` });
        }

        // Process data with Gemini (Sequential processing for simplicity)
        const processedData = [];
        for (const row of standardizedData) {
            const textToAnalyze = String(row.text);
            const { case: geminiCase, category, note } = await processTextWithGemini(textToAnalyze);

            processedData.push({
                sender: String(row.sender),
                text: textToAnalyze,
                case: geminiCase,
                category: category,
                note: note
            });
        }

        return res.status(200).json({
            message: 'Processing complete',
            data: processedData,
        });
    });
}