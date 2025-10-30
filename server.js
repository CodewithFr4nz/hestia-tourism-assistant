// Enhanced Tourism Chatbot with Gemini AI Integration
// Features: Quick Replies, Multi-language Support, AI-powered responses
// 
// Required Environment Variables:
// - VERIFY_TOKEN: Your webhook verification token
// - PAGE_ACCESS_TOKEN: Your Facebook Page access token  
// - GEMINI_API_KEY: Your Google Gemini API key (get from https://makersuite.google.com/app/apikey)

import express from "express";
import bodyParser from "body-parser";
import request from "request";

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "sjcverify123";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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
    // Loop through all messaging events instead of only [0]
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
  const bisayaKeywords = ['kumusta', 'musta', 'unsa', 'asa', 'kanus-a', 'ngano', 'kinsa', 'unsaon', 'pila'];
  const tagalogKeywords = ['kumusta', 'kamusta', 'ano', 'saan', 'kailan', 'bakit', 'sino', 'paano', 'ilan', 'mga', 'ang', 'ng', 'sa'];
  
  const textLower = text.toLowerCase();
  const isBisaya = bisayaKeywords.some(k => textLower.includes(k));
  const isTagalog = !isBisaya && tagalogKeywords.some(k => textLower.includes(k));
  
  return isBisaya ? 'bisaya' : isTagalog ? 'tagalog' : 'english';
}

// Get quick replies based on language (10 buttons total)
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

// Call Gemini AI
async function callGeminiAI(userMessage, language) {
  if (!GEMINI_API_KEY) {
    console.error("❌ Gemini API key not set");
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
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 200,
          }
        })
      }
    );

    const data = await response.json();
    
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text.trim();
    }
    
    return null;
  } catch (error) {
    console.error("❌ Gemini API error:", error);
    return null;
  }
}

// Handle postback (quick reply clicks)
function handlePostback(sender_psid, payload) {
  const responses = {
    PROGRAMS: {
      english: "We offer two programs:\n\nBSTM - Bachelor of Science in Tourism Management\nFocuses on airlines, travel agencies, tour guiding, events, and destinations.\n\nBSHM - Bachelor of Science in Hospitality Management\nFocuses on hotels, restaurants, cooking, events, and customer service.",
      bisaya: "Adunay duha ka programa:\n\nBSTM - Bachelor of Science in Tourism Management\nNakafocus sa airlines, travel agencies, tour guiding, events, ug destinations.\n\nBSHM - Bachelor of Science in Hospitality Management\nNakafocus sa hotels, restaurants, cooking, events, ug customer service.",
      tagalog: "May dalawang programa:\n\nBSTM - Bachelor of Science in Tourism Management\nNakatuon sa airlines, travel agencies, tour guiding, events, at destinations.\n\nBSHM - Bachelor of Science in Hospitality Management\nNakatuon sa hotels, restaurants, cooking, events, at customer service."
    },
    PARTNERSHIPS: {
      english: "We have partnerships with Air Asia and many industry leaders:\n\nBayfront Cebu, Bohol Bee Farm, Discovery Prime Makati, Department of Tourism Manila, Ecoscape Travel & Tours, Fuente Pension House, Fuente Hotel de Cebu, Hotel Celeste Makati, Jeju Air, Nustar Resort and Casino, Tambuli Seaside Resort and Spa, The Mark Resort Cebu, Waterfront Mactan/Lahug, and more.",
      bisaya: "Adunay partnerships sa Air Asia ug daghan pang industry leaders:\n\nBayfront Cebu, Bohol Bee Farm, Discovery Prime Makati, Department of Tourism Manila, Ecoscape Travel & Tours, Fuente Pension House, Fuente Hotel de Cebu, Hotel Celeste Makati, Jeju Air, Nustar Resort and Casino, Tambuli Seaside Resort and Spa, The Mark Resort Cebu, Waterfront Mactan/Lahug, ug uban pa.",
      tagalog: "May partnerships sa Air Asia at marami pang industry leaders:\n\nBayfront Cebu, Bohol Bee Farm, Discovery Prime Makati, Department of Tourism Manila, Ecoscape Travel & Tours, Fuente Pension House, Fuente Hotel de Cebu, Hotel Celeste Makati, Jeju Air, Nustar Resort and Casino, Tambuli Seaside Resort and Spa, The Mark Resort Cebu, Waterfront Mactan/Lahug, at iba pa."
    },
    EVENTS: {
      english: "The department organizes multi-day events featuring competitions like bartending, market basket, tray relay, housekeeping, airline voice over, tour guiding/vlogging, and hair & makeup.",
      bisaya: "Ang department nag-organize og multi-day event nga adunay competitions sama sa bartending, market basket, tray relay, housekeeping, airline voice over, tour guiding/vlogging, ug hair & makeup.",
      tagalog: "Ang department ay nag-organize ng multi-day event na may competitions tulad ng bartending, market basket, tray relay, housekeeping, airline voice over, tour guiding/vlogging, at hair & makeup."
    },
    TRAINING: {
      english: "Labs and simulations in both programs, plus internships via industry partners to give you real-world experience in professional environments.",
      bisaya: "Labs ug simulations sa duha ka programa, plus internships pinaagi sa industry partners aron makakuha mo og real-world experience sa professional environments.",
      tagalog: "Labs at simulations sa dalawang programa, plus internships sa pamamagitan ng industry partners upang makakuha kayo ng real-world experience sa professional environments."
    },
    COSTS: {
      english: "Additional expenses for Lab Uniform, culinary ingredients, Event participation fees (MICE), and OJT requirements.",
      bisaya: "Additional expenses para sa Lab Uniform, culinary ingredients, Event participation fees (MICE), ug OJT requirements.",
      tagalog: "Karagdagang gastos para sa Lab Uniform, culinary ingredients, Event participation fees (MICE), at OJT requirements."
    },
    CAREERS: {
      english: "BSTM graduates can become:\nTravel or tour agents, flight attendants, tourism officers, event organizers\n\nBSHM graduates can become:\nHotel or resort managers, chefs or kitchen supervisors, front desk managers, F&B supervisors",
      bisaya: "BSTM graduates makahimong:\nTravel o tour agents, flight attendants, tourism officers, event organizers\n\nBSHM graduates makahimong:\nHotel o resort managers, chefs o kitchen supervisors, front desk managers, F&B supervisors",
      tagalog: "BSTM graduates ay maaaring maging:\nTravel o tour agents, flight attendants, tourism officers, event organizers\n\nBSHM graduates ay maaaring maging:\nHotel o resort managers, chefs o kitchen supervisors, front desk managers, F&B supervisors"
    },
    INSTRUCTORS: {
      english: "Full-time instructors:\nXaviera Colleen De Paz, Jazfer Jadd Sala, Angeline Manliguez, Euzarn Cuaton, Wayne Clerigo, Perlita Gerona, Eva Palero, Rachel Mamado, Trisha Louraine De La Torre\n\nPart-time instructors:\nJovanni Christian Plateros, Ruby De la Torre, Paz Belen Mariño, Rafael Bachanicha, Fr. Allan Igbalic, Fr. Emerson Nazareth, Fr. Mark Ortega",
      bisaya: "Full-time instructors:\nXaviera Colleen De Paz, Jazfer Jadd Sala, Angeline Manliguez, Euzarn Cuaton, Wayne Clerigo, Perlita Gerona, Eva Palero, Rachel Mamado, Trisha Louraine De La Torre\n\nPart-time instructors:\nJovanni Christian Plateros, Ruby De la Torre, Paz Belen Mariño, Rafael Bachanicha, Fr. Allan Igbalic, Fr. Emerson Nazareth, Fr. Mark Ortega",
      tagalog: "Full-time instructors:\nXaviera Colleen De Paz, Jazfer Jadd Sala, Angeline Manliguez, Euzarn Cuaton, Wayne Clerigo, Perlita Gerona, Eva Palero, Rachel Mamado, Trisha Louraine De La Torre\n\nPart-time instructors:\nJovanni Christian Plateros, Ruby De la Torre, Paz Belen Mariño, Rafael Bachanicha, Fr. Allan Igbalic, Fr. Emerson Nazareth, Fr. Mark Ortega"
    },
    LOCATION: {
      english: "We're located at Saint Joseph College\nTunga-Tunga, Maasin City, Southern Leyte",
      bisaya: "Naa mi sa Saint Joseph College\nTunga-Tunga, Maasin City, Southern Leyte",
      tagalog: "Nandito kami sa Saint Joseph College\nTunga-Tunga, Maasin City, Southern Leyte"
    }
  };

  // Get user's last detected language from memory (default to English)
  const language = 'english'; // You can implement language memory per user
  const response = responses[payload]?.[language] || responses[payload]?.english;

  if (response) {
    sendMessage(sender_psid, response, language);
  }
}

// Handle incoming messages
async function handleMessage(sender_psid, text) {
  const textLower = text.toLowerCase();
  const language = detectLanguage(text);

  // Welcome message
  if (textLower.includes("hello") || textLower.includes("hi") || textLower.includes("hey") || 
      textLower.includes("start") || textLower.includes("kumusta") || textLower.includes("musta") ||
      textLower.includes("kamusta")) {
    
    const welcomeMessages = {
      english: "Hello! I'm Hestia, your Tourism & Hospitality Department assistant at Saint Joseph College.\n\nHow can I help you today?",
      bisaya: "Kumusta! Ako si Hestia, ang inyong Tourism & Hospitality Department assistant sa Saint Joseph College.\n\nUnsa ang akong matabang ninyo karon?",
      tagalog: "Kumusta! Ako si Hestia, ang inyong Tourism & Hospitality Department assistant sa Saint Joseph College.\n\nPaano ko kayo matutulungan ngayon?"
    };
    
    sendMessage(sender_psid, welcomeMessages[language], language);
    return;
  }

  // Try to get response from Gemini AI first
  const geminiResponse = await callGeminiAI(text, language);
  
  if (geminiResponse) {
    sendMessage(sender_psid, geminiResponse, language);
  } else {
    // Fallback to default response if Gemini fails
    const fallbackMessages = {
      english: "Thank you for your question! I'm here to help you learn more about our Tourism & Hospitality programs at Saint Joseph College.\n\nPlease use the quick reply buttons below to explore specific topics.",
      bisaya: "Salamat sa inyong pangutana! Naa ko dinhi aron matabangan mo sa pagkat-on bahin sa among Tourism & Hospitality programs sa Saint Joseph College.\n\nPalihug gamita ang mga quick reply buttons sa ubos para sa specific topics.",
      tagalog: "Salamat sa inyong tanong! Nandito ako upang matulungan kayo sa pag-aaral tungkol sa aming Tourism & Hospitality programs sa Saint Joseph College.\n\nPakiusap gamitin ang mga quick reply buttons sa ibaba para sa specific topics."
    };
    
    sendMessage(sender_psid, fallbackMessages[language], language);
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

// Send API call
function callSendAPI(sender_psid, response) {
  const request_body = {
    recipient: { id: sender_psid },
    message: response,
  };

  request(
    {
      uri: "https://graph.facebook.com/v19.0/me/messages",
      qs: { access_token: PAGE_ACCESS_TOKEN },
      method: "POST",
      json: request_body,
    },
    (err, res, body) => {
      if (err) {
        console.error("❌ Unable to send message:", err);
      } else if (body.error) {
        console.error("❌ Facebook API error:", body.error);
      }
    }
  );
}

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 Bot server running on port ${PORT}`);
  console.log(`✅ Webhook ready at /webhook`);
  if (GEMINI_API_KEY) {
    console.log(`🤖 Gemini AI integration active`);
  } else {
    console.log(`⚠️  Gemini AI key not set - using fallback responses`);
  }

});
