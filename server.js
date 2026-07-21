require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

// ১. ফায়ারবেস এডমিন ইনিশিয়ালিজেশন (আপনার ফায়ারবেস ক্রেডেনশিয়াল ব্যবহার করুন)
// লোকাল টেস্টের জন্য ডিফল্ট ইনিশিয়ালিজেশন বা সার্ভিস একাউন্ট কি ব্যবহার করতে পারেন
admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
});
const db = admin.firestore();

// ২. জেমিনি এআই ইনিশিয়ালিজেশন
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ৩. Function Calling-এর জন্য টুল (Tool) ডিফাইন করা
// এআই-কে বলে দেওয়া হচ্ছে এই ফাংশনটি কী কাজ করে এবং কী কী প্যারামিটার লাগে
const searchDonorsTool = {
    functionDeclarations: [
        {
            name: "searchDonors",
            description: "Search for blood donors in the Firebase database based on blood group and location/area.",
            parameters: {
                type: "OBJECT",
                properties: {
                    bloodGroup: {
                        type: "STRING",
                        description: "The blood group needed, e.g., 'A+', 'B-', 'O+', 'AB+'",
                    },
                    location: {
                        type: "STRING",
                        description: "The area, city, or location in Bangladesh, e.g., 'Mirpur', 'Dhanmondi', 'Dhaka', 'Chattogram'",
                    }
                },
                required: ["bloodGroup"],
            },
        },
    ],
};

// ৪. ফায়ারবেস থেকে ডোনার খোঁজার আসল ফাংশন
async function searchDonorsFromFirestore(bloodGroup, location) {
    try {
        console.log(`Searching donors: Blood Group = ${bloodGroup}, Location = ${location}`);
        let query = db.collection('donors').where('bloodGroup', '==', bloodGroup);
        
        // যদি ইউজার লোকেশন বলে দেয়, তবে লোকেশন দিয়েও ফিল্টার করা হবে
        if (location) {
            // ছোট-বড় হাতের অক্ষরের সমস্যা এড়াতে lowercase বা নির্দিষ্ট ফরম্যাট ব্যবহার করতে পারেন
            query = query.where('area', '==', location);
        }

        const snapshot = await query.limit(5).get();
        
        if (snapshot.empty) {
            return { message: "এই মুহূর্তে উক্ত গ্রুপের বা এলাকার কোনো ডোনার ডাটাবেসে পাওয়া যায়নি।" };
        }

        const donors = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            donors.push({
                name: data.name || "অজ্ঞাত ডোনার",
                bloodGroup: data.bloodGroup,
                area: data.area || "নির্দিষ্ট নয়",
                phone: data.phone || "নম্বর দেওয়া নেই",
                lastDonationDate: data.lastDonationDate || "তথ্য নেই"
            });
        });

        return { donors };
    } catch (error) {
        console.error("Database Error:", error);
        return { error: "ডাটাবেস থেকে তথ্য সংগ্রহ করার সময় একটি সমস্যা হয়েছে।" };
    }
}

// ৫. চ্যাট এপিআই রুট (Frontend থেকে মেসেজ এখানে আসবে)
app.post('/api/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;
        if (!userMessage) {
            return res.status(400).json({ error: "মেসেজ খালি হতে পারবে না!" });
        }

        // মডেল সিলেক্ট করা এবং টুলস যুক্ত করা
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            tools: [searchDonorsTool],
            systemInstruction: "তুমি 'Blood Donor BD' ওয়েবসাইটের একজন ভার্চুয়াল সহকারী। তুমি সবসময় খুব বিনয়ী, সাহায্যকারী এবং সুন্দর সহজ বাংলা ভাষায় কথা বলবে। কেউ ডোনার চাইলে searchDonors টুল ব্যবহার করে ডাটাবেস থেকে তথ্য নিয়ে সুন্দর করে গুছিয়ে উত্তর দেবে। কোনো সংবেদনশীল তথ্য শেয়ার করবে না।"
        });

        const chat = model.startChat();
        let result = await chat.sendMessage(userMessage);
        let response = result.response;

        // এআই যদি মনে করে ডাটাবেসে কুয়েরি করা দরকার (Function Call ট্রিগার হলে)
        const functionCalls = response.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0];
            if (call.name === "searchDonors") {
                const { bloodGroup, location } = call.args;
                
                // আমাদের কাস্টম ফায়ারবেস ফাংশনটি কল করা হচ্ছে
                const dbResults = await searchDonorsFromFirestore(bloodGroup, location);

                // ডাটাবেসের ফলাফল আবার জেমিনি এআই-এর কাছে পাঠানো হচ্ছে সুন্দর বাংলায় সাজানোর জন্য
                result = await chat.sendMessage([
                    {
                        functionResponse: {
                            name: "searchDonors",
                            response: dbResults,
                        }
                    }
                ]);
                response = result.response;
            }
        }

        // চূড়ান্ত উত্তর ফ্রন্টএন্ডে পাঠানো
        res.json({ reply: response.text() });

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: "দুঃখিত, এই মুহূর্তে উত্তর দিতে সমস্যা হচ্ছে।" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Blood Donor BD AI Server running on port ${PORT}`);
});
