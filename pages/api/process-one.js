// pages/api/process-one.js
import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = "gemini-2.5-flash";

if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// แก้ไข: ใช้ Template Literal (Backticks) ตามที่เราแนะนำ
const SYSTEM_PROMPT = `
คุณคือผู้เชี่ยวชาญด้านการคัดกรองข้อความ SMS ที่เข้มงวด
วิเคราะห์ข้อความที่ให้มาแล้วจำแนกเป็น 3 ผลลัพธ์: 'case' ('pass'/'not pass'), 'category', และ 'note'
Category ที่เป็นไปได้: 'OTP/Transactional', 'Marketing/Promo', 'Financial Scam', 'Gambling/Illegal', 'Phishing', หรือ 'Others'
ตอบกลับด้วย JSON Format เท่านั้น: {'case': 'pass'/'not pass', 'category': 'ประเภทข้อความ', 'note': 'เหตุผล'}
`;

async function processTextWithGemini(sender, textToAnalyze) {
    const lowCostCheck = textToAnalyze.toLowerCase();
    if (lowCostCheck.includes('พนัน') || lowCostCheck.includes('บาคาร่า') || lowCostCheck.includes('เงินด่วน')) {
        return { sender, text: textToAnalyze, case: "not pass", category: "Gambling/Loan Scam", note: "มีคำต้องห้ามชัดเจน: พนัน/เงินด่วน" };
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

        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);

        return {
            sender, 
            text: textToAnalyze,
            case: result.case || 'error',
            category: result.category || 'Unknown',
            note: result.note || 'JSON Missing Field'
        };

    } catch (e) {
        console.error("Gemini API Error or JSON Parsing Failed:", e);
        return { sender, text: textToAnalyze, case: "error", category: "API Failure", note: `API Error or Format Error: ${e.message}` };
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }
    
    // Ensure body is parsed as JSON
    const { sender, text } = req.body;

    if (!text || !sender) {
        return res.status(400).json({ message: 'Missing sender or text in request body.' });
    }

    try {
        const result = await processTextWithGemini(sender, text);
        return res.status(200).json({
            message: 'Processing complete for one row',
            data: result,
        });
    } catch (error) {
        console.error("Handler error:", error);
        return res.status(500).json({ message: 'Internal Server Error during processing.', error: error.message });
    }
}