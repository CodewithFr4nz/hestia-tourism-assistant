// Enhanced Tourism Chatbot with Gemini AI Integration - FIXED VERSION
// Features: Quick Replies, Multi-language Support, AI-powered responses

import express from "express";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "sjcverify123";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Store user language preferences
const userLanguages = new Map();

// Knowledge base for Gemini AI context
const KNOWLEDGE_BASE = `
You are Hestia, the Tourism & Hospitality Department assistant at Saint Joseph College in Maasin City, Southern Leyte.

PROGRAMS OFFERED:
1. BSTM (Bachelor of Science in Tourism Management)
   - Focus: Airlines, travel agencies, tour guiding, events, destinations
   
2. BSHM (Bachelor of Science in Hospitality Management)
   - Focus: Hotels, restaurants, cooking, events, customer service

INDUSTRY PARTNERSHIPS:
Air Asia, Bayfront Cebu, Bohol Bee Farm, Discovery Prime Makati, Department of Tourism Manila Philippines, Ecoscape Travel & Tours, Fuente Pension House, Fuente Hotel de Cebu, Hotel Celeste Makati, Jeju Air, Kinglyahan Forest Park, Kyle's Restaurant, La Carmela de Boracay, Marina Sea View, Marzon Beach Resort Boracay, Nustar Resort and Casino, Rio Verde Floating Restaurant, Tambuli Seaside Resort and Spa, The Mark Resort Cebu, Waterfront Mactan/Lahug

EVENTS & COMPETITIONS:
Multi-day events with competitions: bartending, market basket, tray relay, housekeeping, airline voice over, tour guiding/vlogging, hair & makeup

PRACTICAL TRAINING:
Labs and simulations in both programs, plus internships via industry partners for real-world experience

ADDITIONAL COSTS:
Lab Uniform, culinary ingredients, Event participation fees (MICE), OJT requirements

ACADEMIC CONTENT:
Heavy on memorization (maps, cultures), system use (Amadeus, Property Management System), event planning (MICE)

CAREER OPPORTUNITIES:
BSTM: Travel/tour agents, flight attendants, tourism officers, event organizers
BSHM: Hotel/resort managers, chefs/kitchen supervisors, front desk managers, F&B supervisors

THESIS REQUIREMENT:
Yes, usually in 3rd or 4th year as part of degree requirements

DEAN:
Rosalinda C. Jomoc, DDM-ET

FULL-TIME INSTRUCTORS:
Xaviera Colleen De Paz, Jazfer Jadd Sala, Angeline Manliguez, Euzarn Cuaton, Wayne Clerigo, Perlita Gerona, Eva Palero, Rachel Mamado, Trisha Louraine De La Torre

PART-TIME INSTRUCTORS:
Jovanni Christian Plateros, Ruby De la Torre, Paz Belen Mariño, Rafael Bachanicha, Fr. Allan Igbalic, Fr. Emerson Nazareth, Fr. Mark Ortega

LOCATION:
Saint Joseph College, Tunga-Tunga, Maasin City, Southern Leyte

Always be helpful, professional, and concise. Support English, Bisaya, and Tagalog languages.
`;

// Verify webhook
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ WEBHOOK_VERIFIED");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Handle messages
app.post("/webhook", (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    body.entry.forEach((entry) => {
      entry.messaging.forEach((event) => {
        const sender = event.sender.id;

        if (event.message && event.message.text) {
          handleMessage(sender, event.message.text);
        } else if (event.postback) {
          handlePostback(sender, event.postback.payload);
        }
      });
    });
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

// Language detection
function detectLanguage(text) {
  const bisayaKeywords = ['kumusta', 'musta', 'unsa', 'asa', 'kanus-a', 'ngano', 'kinsa', 'unsaon', 'pila', 'naa', 'wala', 'adunay'];
  const tagalogKeywords = ['kumusta', 'kamusta', 'ano', 'saan', 'kailan', 'bakit', 'sino', 'paano', 'ilan', 'mga', 'ang', 'ng', 'sa', 'may', 'wala'];
  
  const textLower = text.toLowerCase();
  const isBisaya = bisayaKeywords.some(k => textLower.includes(k));
  const isTagalog = !isBisaya && tagalogKeywords.some(k => textLower.includes(k));
  
  return isBisaya ? 'bisaya' : isTagalog ? 'tagalog' : 'english';
}

// Get quick replies based on language
function getQuickReplies(language) {
  const replies = {
    english: [
      { title: "Programs", payload: "PROGRAMS" },
      { title: "Partnerships", payload: "PARTNERSHIPS" },
      { title: "Events", payload: "EVENTS" },
      { title: "Training", payload: "TRAINING" },
      { title: "Costs", payload: "COSTS" },
      { title: "Academic Content", payload: "ACADEMIC" },
      { title: "Careers", payload: "CAREERS" },
      { title: "Thesis", payload: "THESIS" },
      { title: "Instructors", payload: "INSTRUCTORS" },
      { title: "Location", payload: "LOCATION" }
    ],
    bisaya: [
      { title: "Mga Programa", payload: "PROGRAMS" },
      { title: "Partnerships", payload: "PARTNERSHIPS" },
      { title: "Mga Event", payload: "EVENTS" },
      { title: "Training", payload: "TRAINING" },
      { title: "Mga Gasto", payload: "COSTS" },
      { title: "Academic", payload: "ACADEMIC" },
      { title: "Trabaho", payload: "CAREERS" },
      { title: "Thesis", payload: "THESIS" },
      { title: "Instructors", payload: "INSTRUCTORS" },
      { title: "Lokasyon", payload: "LOCATION" }
    ],
    tagalog: [
      { title: "Mga Programa", payload: "PROGRAMS" },
      { title: "Partnerships", payload: "PARTNERSHIPS" },
      { title: "Mga Event", payload: "EVENTS" },
      { title: "Training", payload: "TRAINING" },
      { title: "Mga Gastos", payload: "COSTS" },
      { title: "Academic", payload: "ACADEMIC" },
      { title: "Trabaho", payload: "CAREERS" },
      { title: "Thesis", payload: "THESIS" },
      { title: "Instructors", payload: "INSTRUCTORS" },
      { title: "Lokasyon", payload: "LOCATION" }
    ]
  };
  
  return replies[language] || replies.english;
}

// Call Gemini AI - FIXED VERSION with correct endpoint
async function callGeminiAI(userMessage, language) {
  if (!GEMINI_API_KEY) {
    console.log("⚠️ Gemini API key not set, using fallback");
    return null;
  }

  const languageInstruction = {
    english: "Respond in English",
    bisaya: "Respond in Bisaya/Cebuano",
    tagalog: "Respond in Tagalog"
  }[language] || "Respond in English";

  const prompt = `${KNOWLEDGE_BASE}

${languageInstruction}. Keep responses concise (2-3 sentences max) and professional.

User question: ${userMessage}

Response:`;

  try {
    // Updated to use gemini-1.5-flash (latest stable model)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 200,
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Gemini API HTTP error: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      const aiResponse = data.candidates[0].content.parts[0].text.trim();
      console.log(`✅ Gemini response: ${aiResponse.substring(0, 50)}...`);
      return aiResponse;
    } else {
      console.error("❌ Unexpected Gemini response format:", JSON.stringify(data));
      return null;
    }
  } catch (error) {
    console.error("❌ Gemini API error:", error.message);
    return null;
  }
}

// Handle postback (quick reply clicks) - FIXED VERSION
function handlePostback(sender_psid, payload) {
  // Get stored language or default to English
  const language = userLanguages.get(sender_psid) || 'english';
  
  const responses = {
    PROGRAMS: {
      english: "We offer two programs:\n\nBSTM - Bachelor of Science in Tourism Management\nFocuses on airlines, travel agencies, tour guiding, events, and destinations.\n\nBSHM - Bachelor of Science in Hospitality Management\nFocuses on hotels, restaurants, cooking, events, and customer service.",
      bisaya: "Adunay duha ka programa:\n\nBSTM - Bachelor of Science in Tourism Management\nNakafocus sa airlines, travel agencies, tour guiding, events, ug destinations.\n\nBSHM - Bachelor of Science in Hospitality Management\nNakafocus sa hotels, restaurants, cooking, events, ug customer service.",
      tagalog: "May dalawang programa:\n\nBSTM - Bachelor of Science in Tourism Management\nNakatuon sa airlines, travel agencies, tour guiding, events, at destinations.\n\nBSHM - Bachelor of Science in Hospitality Management\nNakatuon sa hotels, restaurants, cooking, events, at customer service."
    },
    PARTNERSHIPS: {
      english: "We have partnerships with Air Asia and many industry leaders:\n\nBayfront Cebu, Bohol Bee Farm, Discovery Prime Makati, Department of Tourism Manila, Ecoscape Travel & Tours, Fuente Pension House, Hotel Celeste Makati, Jeju Air, Nustar Resort, Tambuli Seaside Resort, The Mark Resort Cebu, Waterfront Mactan/Lahug, and more.",
      bisaya: "Adunay partnerships sa Air Asia ug daghan pang industry leaders:\n\nBayfront Cebu, Bohol Bee Farm, Discovery Prime Makati, Department of Tourism Manila, Ecoscape Travel & Tours, Fuente Pension House, Hotel Celeste Makati, Jeju Air, Nustar Resort, Tambuli Seaside Resort, The Mark Resort Cebu, Waterfront Mactan/Lahug, ug uban pa.",
      tagalog: "May partnerships sa Air Asia at marami pang industry leaders:\n\nBayfront Cebu, Bohol Bee Farm, Discovery Prime Makati, Department of Tourism Manila, Ecoscape Travel & Tours, Fuente Pension House, Hotel Celeste Makati, Jeju Air, Nustar Resort, Tambuli Seaside Resort, The Mark Resort Cebu, Waterfront Mactan/Lahug, at iba pa."
    },
    EVENTS: {
      english: "The department organizes multi-day events featuring competitions like bartending, market basket, tray relay, housekeeping, airline voice over, tour guiding/vlogging, and hair & makeup.",
      bisaya: "Ang department nag-organize og multi-day events nga adunay competitions sama sa bartending, market basket, tray relay, housekeeping, airline voice over, tour guiding/vlogging, ug hair & makeup.",
      tagalog: "Ang department ay nag-organize ng multi-day events na may competitions tulad ng bartending, market basket, tray relay, housekeeping, airline voice over, tour guiding/vlogging, at hair & makeup."
    },
    TRAINING: {
      english: "Labs and simulations in both programs, plus internships via industry partners to give you real-world experience in professional environments.",
      bisaya: "Labs ug simulations sa duha ka programa, plus internships pinaagi sa industry partners aron makakuha ka og real-world experience sa professional environments.",
      tagalog: "Labs at simulations sa dalawang programa, plus internships sa pamamagitan ng industry partners upang makakuha kayo ng real-world experience sa professional environments."
    },
    COSTS: {
      english: "Additional expenses include:\n• Lab Uniform\n• Culinary ingredients\n• Event participation fees (MICE)\n• OJT requirements",
      bisaya: "Additional expenses naglakip sa:\n• Lab Uniform\n• Culinary ingredients\n• Event participation fees (MICE)\n• OJT requirements",
      tagalog: "Karagdagang gastos ay kinabibilangan ng:\n• Lab Uniform\n• Culinary ingredients\n• Event participation fees (MICE)\n• OJT requirements"
    },
    ACADEMIC: {
      english: "Academic content includes:\n• Heavy memorization (maps, cultures)\n• System training (Amadeus, Property Management System)\n• Event planning (MICE)\n• Practical labs and simulations",
      bisaya: "Academic content naglakip sa:\n• Heavy memorization (maps, cultures)\n• System training (Amadeus, Property Management System)\n• Event planning (MICE)\n• Practical labs ug simulations",
      tagalog: "Academic content ay kinabibilangan ng:\n• Heavy memorization (maps, cultures)\n• System training (Amadeus, Property Management System)\n• Event planning (MICE)\n• Practical labs at simulations"
    },
    CAREERS: {
      english: "BSTM graduates can become:\n• Travel or tour agents\n• Flight attendants\n• Tourism officers\n• Event organizers\n\nBSHM graduates can become:\n• Hotel or resort managers\n• Chefs or kitchen supervisors\n• Front desk managers\n• F&B supervisors",
      bisaya: "BSTM graduates makahimong:\n• Travel o tour agents\n• Flight attendants\n• Tourism officers\n• Event organizers\n\nBSHM graduates makahimong:\n• Hotel o resort managers\n• Chefs o kitchen supervisors\n• Front desk managers\n• F&B supervisors",
      tagalog: "BSTM graduates ay maaaring maging:\n• Travel o tour agents\n• Flight attendants\n• Tourism officers\n• Event organizers\n\nBSHM graduates ay maaaring maging:\n• Hotel o resort managers\n• Chefs o kitchen supervisors\n• Front desk managers\n• F&B supervisors"
    },
    THESIS: {
      english: "Yes, thesis is required! It's usually completed in your 3rd or 4th year as part of the degree requirements.",
      bisaya: "Oo, kinahanglan ang thesis! Kini usually makompleto sa inyong 3rd o 4th year isip parte sa degree requirements.",
      tagalog: "Oo, kailangan ang thesis! Ito ay karaniwang nakukumpleto sa inyong 3rd o 4th year bilang bahagi ng degree requirements."
    },
    INSTRUCTORS: {
      english: "Our Dean: Rosalinda C. Jomoc, DDM-ET\n\nFull-time instructors:\nXaviera Colleen De Paz, Jazfer Jadd Sala, Angeline Manliguez, Euzarn Cuaton, Wayne Clerigo, Perlita Gerona, Eva Palero, Rachel Mamado, Trisha Louraine De La Torre\n\nPart-time instructors:\nJovanni Christian Plateros, Ruby De la Torre, Paz Belen Mariño, Rafael Bachanicha, Fr. Allan Igbalic, Fr. Emerson Nazareth, Fr. Mark Ortega",
      bisaya: "Ang among Dean: Rosalinda C. Jomoc, DDM-ET\n\nFull-time instructors:\nXaviera Colleen De Paz, Jazfer Jadd Sala, Angeline Manliguez, Euzarn Cuaton, Wayne Clerigo, Perlita Gerona, Eva Palero, Rachel Mamado, Trisha Louraine De La Torre\n\nPart-time instructors:\nJovanni Christian Plateros, Ruby De la Torre, Paz Belen Mariño, Rafael Bachanicha, Fr. Allan Igbalic, Fr. Emerson Nazareth, Fr. Mark Ortega",
      tagalog: "Ang aming Dean: Rosalinda C. Jomoc, DDM-ET\n\nFull-time instructors:\nXaviera Colleen De Paz, Jazfer Jadd Sala, Angeline Manliguez, Euzarn Cuaton, Wayne Clerigo, Perlita Gerona, Eva Palero, Rachel Mamado, Trisha Louraine De La Torre\n\nPart-time instructors:\nJovanni Christian Plateros, Ruby De la Torre, Paz Belen Mariño, Rafael Bachanicha, Fr. Allan Igbalic, Fr. Emerson Nazareth, Fr. Mark Ortega"
    },
    LOCATION: {
      english: "📍 We're located at:\nSaint Joseph College\nTunga-Tunga, Maasin City\nSouthern Leyte",
      bisaya: "📍 Naa mi sa:\nSaint Joseph College\nTunga-Tunga, Maasin City\nSouthern Leyte",
      tagalog: "📍 Nandito kami sa:\nSaint Joseph College\nTunga-Tunga, Maasin City\nSouthern Leyte"
    }
  };

  const response = responses[payload]?.[language] || responses[payload]?.english;

  if (response) {
    console.log(`✅ Postback handled: ${payload} in ${language}`);
    sendMessage(sender_psid, response, language);
  } else {
    console.error(`❌ Unknown payload: ${payload}`);
  }
}

// Handle incoming messages - FIXED VERSION
async function handleMessage(sender_psid, text) {
  const textLower = text.toLowerCase();
  const language = detectLanguage(text);
  
  // Store user's language preference
  userLanguages.set(sender_psid, language);
  
  console.log(`📨 Message from ${sender_psid}: "${text}" (detected: ${language})`);

  // Welcome message
  if (textLower.includes("hello") || textLower.includes("hi") || textLower.includes("hey") || 
      textLower.includes("start") || textLower.includes("kumusta") || textLower.includes("musta") ||
      textLower.includes("kamusta") || textLower === "get started") {
    
    const welcomeMessages = {
      english: "Hello! I'm Hestia, your Tourism & Hospitality Department assistant at Saint Joseph College.\n\nHow can I help you today?",
      bisaya: "Kumusta! Ako si Hestia, ang inyong Tourism & Hospitality Department assistant sa Saint Joseph College.\n\nUnsa ang akong matabang ninyo karon?",
      tagalog: "Kumusta! Ako si Hestia, ang inyong Tourism & Hospitality Department assistant sa Saint Joseph College.\n\nPaano ko kayo matutulungan ngayon?"
    };
    
    sendMessage(sender_psid, welcomeMessages[language], language);
    return;
  }

  // Try to get response from Gemini AI first
  console.log("🤖 Calling Gemini AI...");
  const geminiResponse = await callGeminiAI(text, language);
  
  if (geminiResponse) {
    console.log("✅ Using Gemini AI response");
    sendMessage(sender_psid, geminiResponse, language);
  } else {
    // Fallback to keyword-based responses
    console.log("⚠️ Gemini failed, using keyword matching");
    
    const keywordResponses = {
      english: {
        programs: "We offer BSTM (Tourism Management) and BSHM (Hospitality Management). Click 'Programs' below for details!",
        cost: "Additional costs include lab uniforms, culinary ingredients, event fees, and OJT requirements. Click 'Costs' for more info!",
        location: "We're at Saint Joseph College, Tunga-Tunga, Maasin City, Southern Leyte. Click 'Location' below!",
        instructor: "We have excellent full-time and part-time instructors. Click 'Instructors' to see the list!",
        thesis: "Yes, thesis is required in 3rd or 4th year. Click 'Thesis' for details!",
        career: "Great career opportunities in tourism and hospitality! Click 'Careers' to learn more!",
        default: "I'm here to help! Please use the quick reply buttons below to explore specific topics about our Tourism & Hospitality programs."
      },
      bisaya: {
        programs: "Nag-offer mi og BSTM (Tourism Management) ug BSHM (Hospitality Management). Click 'Mga Programa' sa ubos para sa detalye!",
        cost: "Additional costs naglakip sa lab uniforms, culinary ingredients, event fees, ug OJT requirements. Click 'Mga Gasto'!",
        location: "Naa mi sa Saint Joseph College, Tunga-Tunga, Maasin City, Southern Leyte. Click 'Lokasyon'!",
        instructor: "Adunay mi maayo nga instructors. Click 'Instructors' para makita ang lista!",
        thesis: "Oo, kinahanglan ang thesis sa 3rd o 4th year. Click 'Thesis' para sa detalye!",
        career: "Daghan og career opportunities sa tourism ug hospitality! Click 'Trabaho'!",
        default: "Naa ko dinhi aron matabangan ka! Palihug gamita ang mga quick reply buttons sa ubos."
      },
      tagalog: {
        programs: "Nag-aalok kami ng BSTM (Tourism Management) at BSHM (Hospitality Management). Click 'Mga Programa' para sa detalye!",
        cost: "Karagdagang gastos ay kinabibilangan ng lab uniforms, culinary ingredients, event fees, at OJT requirements. Click 'Mga Gastos'!",
        location: "Nandito kami sa Saint Joseph College, Tunga-Tunga, Maasin City, Southern Leyte. Click 'Lokasyon'!",
        instructor: "Mayroon kaming mahusay na instructors. Click 'Instructors' para makita ang lista!",
        thesis: "Oo, kailangan ang thesis sa 3rd o 4th year. Click 'Thesis' para sa detalye!",
        career: "Maraming career opportunities sa tourism at hospitality! Click 'Trabaho'!",
        default: "Nandito ako para tumulong! Pakiusap gamitin ang mga quick reply buttons sa ibaba."
      }
    };
    
    // Simple keyword matching
    let response = keywordResponses[language].default;
    if (textLower.includes("program") || textLower.includes("course") || textLower.includes("bstm") || textLower.includes("bshm")) {
      response = keywordResponses[language].programs;
    } else if (textLower.includes("cost") || textLower.includes("gasto") || textLower.includes("bayad") || textLower.includes("gastos")) {
      response = keywordResponses[language].cost;
    } else if (textLower.includes("location") || textLower.includes("lokasyon") || textLower.includes("asa") || textLower.includes("saan")) {
      response = keywordResponses[language].location;
    } else if (textLower.includes("instructor") || textLower.includes("teacher") || textLower.includes("professor")) {
      response = keywordResponses[language].instructor;
    } else if (textLower.includes("thesis")) {
      response = keywordResponses[language].thesis;
    } else if (textLower.includes("career") || textLower.includes("job") || textLower.includes("work") || textLower.includes("trabaho")) {
      response = keywordResponses[language].career;
    }
    
    sendMessage(sender_psid, response, language);
  }
}

// Send message with quick replies
function sendMessage(sender_psid, text, language) {
  const quickReplies = getQuickReplies(language);
  
  const response = {
    text: text,
    quick_replies: quickReplies.map(qr => ({
      content_type: "text",
      title: qr.title,
      payload: qr.payload
    }))
  };

  callSendAPI(sender_psid, response);
}

// Send API call - FIXED VERSION using fetch instead of request
async function callSendAPI(sender_psid, response) {
  const request_body = {
    recipient: { id: sender_psid },
    message: response,
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request_body)
      }
    );

    const data = await res.json();
    
    if (data.error) {
      console.error("❌ Facebook API error:", data.error);
    } else {
      console.log("✅ Message sent successfully");
    }
  } catch (err) {
    console.error("❌ Unable to send message:", err);
  }
}

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 Bot server running on port ${PORT}`);
  console.log(`✅ Webhook ready at /webhook`);
  if (GEMINI_API_KEY) {
    console.log(`🤖 Gemini AI integration active`);
  } else {
    console.log(`⚠️  Gemini AI key not set - using keyword-based responses`);
  }
  if (!PAGE_ACCESS_TOKEN) {
    console.error(`❌ PAGE_ACCESS_TOKEN not set! Bot will not work.`);
  }
});
