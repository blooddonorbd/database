const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Gemini AI (VERCEL-এর এনভায়রনমেন্ট ভেরিয়েবল অনুযায়ী)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GeminiApi);

app.post('/api/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;
        if (!userMessage) {
            return res.status(400).json({ error: 'মেসেজ খালি থাকতে পারে না।' });
        }

        // Using Gemini 1.5 Flash model
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-1.5-flash',
            systemInstruction: "আপনি Blood Donor BD-এর অফিশিয়াল এআই সহকারী। আপনার কাজ হলো রক্তদান, রক্তের গ্রুপ, রক্তদানের নিয়ম, স্বাস্থ্যবিধি এবং সাধারণ জ্ঞানমূলক প্রশ্নের খুব সুন্দর ও সাহায্যকারী উত্তর বাংলায় প্রদান করা। কোনো ডাটাবেজ এক্সেস না থাকলেও সাধারণ চ্যাটবটের মতো সব স্বাস্থ্য ও রক্তদান সম্পর্কিত প্রশ্নের সঠিক উত্তর দেবেন।"
        });

        const result = await model.generateContent(userMessage);
        const response = await result.response;
        const text = response.text();

        res.json({ reply: text });
    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: 'সার্ভারে এআই প্রসেস করতে সমস্যা হচ্ছে।' });
    }
});

// Root route to check if server is working
app.get('/', (req, res) => {
    res.send('Blood Donor BD AI Server is running successfully on Vercel!');
});

module.exports = app;
