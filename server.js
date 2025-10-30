// Enhanced Tourism Chatbot with Gemini AI Integration - MERGED VERSION
// Features: Quick Replies, Multi-language Support, AI-powered responses with Gemini 1.5 Pro

import express from "express";
import bodyParser from "body-parser";
import axios from "axios";

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "sjcverify123";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Validate required environment variables
if (!PAGE_ACCESS_TOKEN) {
  console.error("❌ CRITICAL: PAGE_ACCESS_TOKEN is not set!");
  console.error("Bot will not be able to send messages.");
}

if (!GEMINI_API_KEY) {
  console.error("⚠️ WARNING: GEMINI_API_KEY is not set!");
  console.error("Bot will use fallback keyword matching.");
}

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
    console.log("❌ Webhook verification failed");
    res.sendStatus(403);
  }
});

// Handle messages
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    // Respond immediately to Facebook
    res.status(200).send("EVENT_RECEIVED");

    // Process messages asynchronously
    for (const entry of body.entry) {
      for (const event of entry.messaging) {
        const sender = event.sender.id;

        try {
          if (event.message && event.message.text) {
            await handleMessage(sender, event.message.text);
          } else if (event.postback) {
            await handlePostback(sender, event.postback.payload);
          }
        } catch (error) {
          console.error(`❌ Error processing event for ${sender}:`, error);
          // Send error message to user
          await sendTextMessage(sender, "Sorry, I encountered an error. Please try again.");
        }
      }
    }
  } else {
    res.sendStatus(404);
  }
});

// Language detection
function detectLanguage(text) {
  const bisayaKeywords = ['kumusta', 'musta', 'unsa', 'asa', 'kanus-a', 'ngano', 'kinsa', 'unsaon', 'pila', 'naa', 'wala', 'adunay', 'karon'];
  const tagalogKeywords = ['kamusta', 'ano', 'saan', 'kailan', 'bakit', 'sino', 'paano', 'ilan', 'mga', 'ang', 'ng', 'sa', 'may', 'ngayon'];
  
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

// Call Gemini AI using Gemini 1.5 Pro
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
    // Use v1 endpoint with gemini-pro for free API
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
    
    console.log(`🤖 Calling Gemini Pro for: "${userMessage}"`);
    
    const response = await axios.post(url, {
      contents: [{
        role: "user",
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 200,
        topP: 0.8,
        topK: 10
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    });

    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      const aiResponse = response.data.candidates[0].content.parts[0].text.trim();
      console.log(`✅ Gemini response: ${aiResponse.substring(0, 80)}...`);
      return aiResponse;
    } else {
      console.error("❌ Unexpected Gemini response structure:", JSON.stringify(response.data).substring(0, 200));
      return null;
    }
  } catch (error) {
    console.error("❌ Gemini API error:", error.response?.data || error.message);
    return null;
  }
}

// Handle postback (quick reply clicks)
async function handlePostback(sender_psid, payload) {
  const language = userLanguages.get(sender_psid) || 'english';
  
  console.log(`🔘 Postback received: ${payload} from ${sender_psid} (lang: ${language})`);
  
  const responses = {
    PROGRAMS: {
      english: "We offer two programs:\n\n🎓 BSTM - Bachelor of Science in Tourism Management\nFocuses on airlines, travel agencies, tour guiding, events, and destinations.\n\n🍽️ BSHM - Bachelor of Science in Hospitality Management\nFocuses on hotels, restaurants, cooking, events, and customer service.",
      bisaya: "Adunay duha ka programa:\n\n🎓 BSTM - Bachelor of Science in Tourism Management\nNakafocus sa airlines, travel agencies, tour guiding, events, ug destinations.\n\n🍽️ BSHM - Bachelor of Science in Hospitality Management\nNakafocus sa hotels, restaurants, cooking, events, ug customer service.",
      tagalog: "May dalawang programa:\n\n🎓 BSTM - Bachelor of Science in Tourism Management\nNakatuon sa airlines, travel agencies, tour guiding, events, at destinations.\n\n🍽️ BSHM - Bachelor of Science in Hospitality Management\nNakatuon sa hotels, restaurants, cooking, events, at customer service."
    },
    PARTNERSHIPS: {
      english: "We have partnerships with major industry leaders:\n\n✈️ Airlines: Air Asia, Jeju Air\n🏨 Hotels & Resorts: Bayfront Cebu, Discovery Prime Makati, Hotel Celeste Makati, Nustar Resort, Tambuli Seaside Resort, The Mark Resort Cebu, Waterfront Mactan/Lahug\n🍴 Dining: Bohol Bee Farm, Kyle's Restaurant, Rio Verde Floating Restaurant\n🏖️ Tourism: Department of Tourism Manila, Ecoscape Travel & Tours, Kinglyahan Forest Park, La Carmela de Boracay\n\nAnd many more!",
      bisaya: "Adunay partnerships sa daghan nga industry leaders:\n\n✈️ Airlines: Air Asia, Jeju Air\n🏨 Hotels & Resorts: Bayfront Cebu, Discovery Prime Makati, Hotel Celeste Makati, Nustar Resort, Tambuli Seaside Resort, The Mark Resort Cebu, Waterfront Mactan/Lahug\n🍴 Dining: Bohol Bee Farm, Kyle's Restaurant, Rio Verde Floating Restaurant\n🏖️ Tourism: Department of Tourism Manila, Ecoscape Travel & Tours, Kinglyahan Forest Park, La Carmela de Boracay\n\nUg daghan pa!",
      tagalog: "May partnerships sa maraming industry leaders:\n\n✈️ Airlines: Air Asia, Jeju Air\n🏨 Hotels & Resorts: Bayfront Cebu, Discovery Prime Makati, Hotel Celeste Makati, Nustar Resort, Tambuli Seaside Resort, The Mark Resort Cebu, Waterfront Mactan/Lahug\n🍴 Dining: Bohol Bee Farm, Kyle's Restaurant, Rio Verde Floating Restaurant\n🏖️ Tourism: Department of Tourism Manila, Ecoscape Travel & Tours, Kinglyahan Forest Park, La Carmela de Boracay\n\nAt marami pang iba!"
    },
    EVENTS: {
      english: "The department organizes exciting multi-day events with various competitions:\n\n🍹 Bartending\n🛒 Market Basket\n🍽️ Tray Relay\n🛏️ Housekeeping\n📢 Airline Voice Over\n📹 Tour Guiding/Vlogging\n💄 Hair & Makeup\n\nThese events help develop practical skills!",
      bisaya: "Ang department nag-organize og exciting multi-day events nga adunay lainlaing competitions:\n\n🍹 Bartending\n🛒 Market Basket\n🍽️ Tray Relay\n🛏️ Housekeeping\n📢 Airline Voice Over\n📹 Tour Guiding/Vlogging\n💄 Hair & Makeup\n\nKini nga events makatabang sa pag-develop og practical skills!",
      tagalog: "Ang department ay nag-organize ng exciting multi-day events na may iba't ibang competitions:\n\n🍹 Bartending\n🛒 Market Basket\n🍽️ Tray Relay\n🛏️ Housekeeping\n📢 Airline Voice Over\n📹 Tour Guiding/Vlogging\n💄 Hair & Makeup\n\nAng mga events na ito ay tumutulong sa pag-develop ng practical skills!"
    },
    TRAINING: {
      english: "We provide comprehensive practical training:\n\n🔬 Labs and simulations in both BSTM and BSHM programs\n💼 Internships through our industry partners\n🌍 Real-world experience in professional environments\n\nYou'll gain hands-on skills that employers value!",
      bisaya: "Naghatag mi og comprehensive practical training:\n\n🔬 Labs ug simulations sa BSTM ug BSHM programs\n💼 Internships pinaagi sa among industry partners\n🌍 Real-world experience sa professional environments\n\nMakakuha ka og hands-on skills nga gipabili sa employers!",
      tagalog: "Nagbibigay kami ng comprehensive practical training:\n\n🔬 Labs at simulations sa BSTM at BSHM programs\n💼 Internships sa pamamagitan ng aming industry partners\n🌍 Real-world experience sa professional environments\n\nMakakakuha ka ng hands-on skills na hinahanap ng employers!"
    },
    COSTS: {
      english: "Additional expenses to consider:\n\n👕 Lab Uniform\n🥘 Culinary ingredients\n🎪 Event participation fees (MICE)\n💼 OJT requirements\n\nThese costs vary depending on your program and activities.",
      bisaya: "Additional expenses nga dapat imong tan-awon:\n\n👕 Lab Uniform\n🥘 Culinary ingredients\n🎪 Event participation fees (MICE)\n💼 OJT requirements\n\nKini nga gastos nagkalainlain depende sa imong programa ug activities.",
      tagalog: "Karagdagang gastos na dapat isaalang-alang:\n\n👕 Lab Uniform\n🥘 Culinary ingredients\n🎪 Event participation fees (MICE)\n💼 OJT requirements\n\nAng mga gastos na ito ay nag-iiba depende sa inyong programa at activities."
    },
    ACADEMIC: {
      english: "Academic content includes:\n\n📚 Heavy memorization (maps, cultures, procedures)\n💻 System training (Amadeus for bookings, Property Management Systems)\n🎪 Event planning and management (MICE)\n🔬 Practical labs and simulations\n\nA mix of theory and hands-on learning!",
      bisaya: "Academic content naglakip sa:\n\n📚 Heavy memorization (maps, cultures, procedures)\n💻 System training (Amadeus for bookings, Property Management Systems)\n🎪 Event planning ug management (MICE)\n🔬 Practical labs ug simulations\n\nCombination sa theory ug hands-on learning!",
      tagalog: "Academic content ay kinabibilangan ng:\n\n📚 Heavy memorization (maps, cultures, procedures)\n💻 System training (Amadeus for bookings, Property Management Systems)\n🎪 Event planning at management (MICE)\n🔬 Practical labs at simulations\n\nKombinasyon ng theory at hands-on learning!"
    },
    CAREERS: {
      english: "🎓 BSTM graduates can become:\n• Travel or tour agents\n• Flight attendants\n• Tourism officers\n• Event organizers\n• Destination managers\n\n🍽️ BSHM graduates can become:\n• Hotel or resort managers\n• Chefs or kitchen supervisors\n• Front desk managers\n• F&B supervisors\n• Restaurant managers\n\nGreat opportunities in both fields!",
      bisaya: "🎓 BSTM graduates makahimong:\n• Travel o tour agents\n• Flight attendants\n• Tourism officers\n• Event organizers\n• Destination managers\n\n🍽️ BSHM graduates makahimong:\n• Hotel o resort managers\n• Chefs o kitchen supervisors\n• Front desk managers\n• F&B supervisors\n• Restaurant managers\n\nDaghan og opportunities sa duha ka fields!",
      tagalog: "🎓 BSTM graduates ay maaaring maging:\n• Travel o tour agents\n• Flight attendants\n• Tourism officers\n• Event organizers\n• Destination managers\n\n🍽️ BSHM graduates ay maaaring maging:\n• Hotel o resort managers\n• Chefs o kitchen supervisors\n• Front desk managers\n• F&B supervisors\n• Restaurant managers\n\nMaraming opportunities sa dalawang fields!"
    },
    THESIS: {
      english: "📝 Yes, thesis is required!\n\nIt's usually completed in your 3rd or 4th year as part of the degree requirements. This research project helps develop your critical thinking and research skills.",
      bisaya: "📝 Oo, kinahanglan ang thesis!\n\nKini usually makompleto sa imong 3rd o 4th year isip parte sa degree requirements. Kini nga research project makatabang sa pag-develop sa imong critical thinking ug research skills.",
      tagalog: "📝 Oo, kailangan ang thesis!\n\nIto ay karaniwang nakukumpleto sa inyong 3rd o 4th year bilang bahagi ng degree requirements. Ang research project na ito ay tumutulong sa pag-develop ng inyong critical thinking at research skills."
    },
    INSTRUCTORS: {
      english: "👩‍🏫 Our Faculty:\n\n🎓 Dean: Rosalinda C. Jomoc, DDM-ET\n\n📚 Full-time Instructors:\nXaviera Colleen De Paz, Jazfer Jadd Sala, Angeline Manliguez, Euzarn Cuaton, Wayne Clerigo, Perlita Gerona, Eva Palero, Rachel Mamado, Trisha Louraine De La Torre\n\n📖 Part-time Instructors:\nJovanni Christian Plateros, Ruby De la Torre, Paz Belen Mariño, Rafael Bachanicha, Fr. Allan Igbalic, Fr. Emerson Nazareth, Fr. Mark Ortega\n\nExperienced and dedicated educators!",
      bisaya: "👩‍🏫 Among Faculty:\n\n🎓 Dean: Rosalinda C. Jomoc, DDM-ET\n\n📚 Full-time Instructors:\nXaviera Colleen De Paz, Jazfer Jadd Sala, Angeline Manliguez, Euzarn Cuaton, Wayne Clerigo, Perlita Gerona, Eva Palero, Rachel Mamado, Trisha Louraine De La Torre\n\n📖 Part-time Instructors:\nJovanni Christian Plateros, Ruby De la Torre, Paz Belen Mariño, Rafael Bachanicha, Fr. Allan Igbalic, Fr. Emerson Nazareth, Fr. Mark Ortega\n\nExperienced ug dedicated educators!",
      tagalog: "👩‍🏫 Aming Faculty:\n\n🎓 Dean: Rosalinda C. Jomoc, DDM-ET\n\n📚 Full-time Instructors:\nXaviera Colleen De Paz, Jazfer Jadd Sala, Angeline Manliguez, Euzarn Cuaton, Wayne Clerigo, Perlita Gerona, Eva Palero, Rachel Mamado, Trisha Louraine De La Torre\n\n📖 Part-time Instructors:\nJovanni Christian Plateros, Ruby De la Torre, Paz Belen Mariño, Rafael Bachanicha, Fr. Allan Igbalic, Fr. Emerson Nazareth, Fr. Mark Ortega\n\nExperienced at dedicated educators!"
    },
    LOCATION: {
      english: "📍 We're located at:\n\nSaint Joseph College\nTunga-Tunga, Maasin City\nSouthern Leyte, Philippines\n\nVisit us to learn more about our programs!",
      bisaya: "📍 Naa mi sa:\n\nSaint Joseph College\nTunga-Tunga, Maasin City\nSouthern Leyte, Philippines\n\nBisita mi aron makahibalo og dugang bahin sa among programs!",
      tagalog: "📍 Nandito kami sa:\n\nSaint Joseph College\nTunga-Tunga, Maasin City\nSouthern Leyte, Philippines\n\nBisitahin kami para malaman ang higit pa tungkol sa aming programs!"
    }
  };

  const responseText = responses[payload]?.[language] || responses[payload]?.english;

  if (responseText) {
    console.log(`✅ Sending postback response for ${payload}`);
    await sendMessage(sender_psid, responseText, language);
  } else {
    console.error(`❌ Unknown payload: ${payload}`);
    await sendTextMessage(sender_psid, "Sorry, I didn't understand that. Please try again.");
  }
}

// Handle incoming messages
async function handleMessage(sender_psid, text) {
  const textLower = text.toLowerCase();
  const language = detectLanguage(text);
  
  userLanguages.set(sender_psid, language);
  
  console.log(`📨 Message from ${sender_psid}: "${text}" (detected: ${language})`);

  // Welcome message
  if (textLower.match(/^(hello|hi|hey|start|kumusta|musta|kamusta|get started)$/i)) {
    const welcomeMessages = {
      english: "Hello! 👋 I'm Hestia, your Tourism & Hospitality Department assistant at Saint Joseph College.\n\nHow can I help you today?",
      bisaya: "Kumusta! 👋 Ako si Hestia, ang inyong Tourism & Hospitality Department assistant sa Saint Joseph College.\n\nUnsa ang akong matabang ninyo karon?",
      tagalog: "Kumusta! 👋 Ako si Hestia, ang inyong Tourism & Hospitality Department assistant sa Saint Joseph College.\n\nPaano ko kayo matutulungan ngayon?"
    };
    
    await sendMessage(sender_psid, welcomeMessages[language], language);
    return;
  }

  // Try Gemini AI first
  console.log("🤖 Attempting Gemini AI response...");
  const geminiResponse = await callGeminiAI(text, language);
  
  if (geminiResponse) {
    console.log("✅ Using Gemini AI response");
    await sendMessage(sender_psid, geminiResponse, language);
  } else {
    // Fallback to keyword-based responses
    console.log("⚠️ Gemini unavailable, using keyword matching");
    
    const keywordResponses = {
      english: {
        program: "We offer BSTM (Tourism Management) and BSHM (Hospitality Management). Click 'Programs' below for details! 🎓",
        cost: "Additional costs include lab uniforms, culinary ingredients, event fees, and OJT requirements. Click 'Costs' for more info! 💰",
        location: "We're at Saint Joseph College, Tunga-Tunga, Maasin City, Southern Leyte. Click 'Location' below! 📍",
        instructor: "We have excellent full-time and part-time instructors. Click 'Instructors' to see the list! 👩‍🏫",
        thesis: "Yes, thesis is required in 3rd or 4th year. Click 'Thesis' for details! 📝",
        career: "Great career opportunities in tourism and hospitality! Click 'Careers' to learn more! 💼",
        partner: "We partner with major companies like Air Asia, Nustar Resort, and many more! Click 'Partnerships' for the full list! 🤝",
        event: "We organize exciting competitions like bartending, housekeeping, and more! Click 'Events' to learn about them! 🎪",
        training: "Practical training through labs, simulations, and internships! Click 'Training' for details! 💪",
        academic: "Learn about systems, event planning, and practical skills! Click 'Academic Content' for more! 📚",
        default: "I'm here to help! Please use the quick reply buttons below to explore specific topics about our Tourism & Hospitality programs. 😊"
      },
      bisaya: {
        program: "Nag-offer mi og BSTM (Tourism Management) ug BSHM (Hospitality Management). Click 'Mga Programa' sa ubos! 🎓",
        cost: "Additional costs naglakip sa lab uniforms, culinary ingredients, event fees, ug OJT requirements. Click 'Mga Gasto'! 💰",
        location: "Naa mi sa Saint Joseph College, Tunga-Tunga, Maasin City, Southern Leyte. Click 'Lokasyon'! 📍",
        instructor: "Adunay mi maayo nga instructors. Click 'Instructors' para makita ang lista! 👩‍🏫",
        thesis: "Oo, kinahanglan ang thesis sa 3rd o 4th year. Click 'Thesis'! 📝",
        career: "Daghan og career opportunities sa tourism ug hospitality! Click 'Trabaho'! 💼",
        partner: "Adunay partnerships sa mga kompanya sama sa Air Asia, Nustar Resort! Click 'Partnerships'! 🤝",
        event: "Nag-organize mi og exciting competitions! Click 'Mga Event'! 🎪",
        training: "Practical training pinaagi sa labs, simulations, ug internships! Click 'Training'! 💪",
        academic: "Mahibal-an ang systems, event planning, ug practical skills! Click 'Academic'! 📚",
        default: "Naa ko dinhi aron matabangan ka! Palihug gamita ang mga quick reply buttons sa ubos. 😊"
      },
      tagalog: {
        program: "Nag-aalok kami ng BSTM (Tourism Management) at BSHM (Hospitality Management). Click 'Mga Programa'! 🎓",
        cost: "Karagdagang gastos ay kinabibilangan ng lab uniforms, culinary ingredients, event fees. Click 'Mga Gastos'! 💰",
        location: "Nandito kami sa Saint Joseph College, Tunga-Tunga, Maasin City, Southern Leyte. Click 'Lokasyon'! 📍",
        instructor: "Mayroon kaming mahusay na instructors. Click 'Instructors'! 👩‍🏫",
        thesis: "Oo, kailangan ang thesis sa 3rd o 4th year. Click 'Thesis'! 📝",
        career: "Maraming career opportunities sa tourism at hospitality! Click 'Trabaho'! 💼",
        partner: "May partnerships sa mga kompanya tulad ng Air Asia, Nustar Resort! Click 'Partnerships'! 🤝",
        event: "Nag-organize kami ng exciting competitions! Click 'Mga Event'! 🎪",
        training: "Practical training sa pamamagitan ng labs, simulations, at internships! Click 'Training'! 💪",
        academic: "Matuto tungkol sa systems, event planning, at practical skills! Click 'Academic'! 📚",
        default: "Nandito ako para tumulong! Pakiusap gamitin ang mga quick reply buttons sa ibaba. 😊"
      }
    };
    
    // Simple keyword matching
    let response = keywordResponses[language].default;
    
    if (textLower.match(/program|course|bstm|bshm|degree|kurso/i)) {
      response = keywordResponses[language].program;
    } else if (textLower.match(/cost|price|tuition|gasto|bayad|gastos|presyo/i)) {
      response = keywordResponses[language].cost;
    } else if (textLower.match(/location|address|where|lokasyon|asa|saan|diin/i)) {
      response = keywordResponses[language].location;
    } else if (textLower.match(/instructor|teacher|professor|faculty|magtutudlo/i)) {
      response = keywordResponses[language].instructor;
    } else if (textLower.match(/thesis|research/i)) {
      response = keywordResponses[language].thesis;
    } else if (textLower.match(/career|job|work|trabaho|employment/i)) {
      response = keywordResponses[language].career;
    } else if (textLower.match(/partner|company|industry|kompanya/i)) {
      response = keywordResponses[language].partner;
    } else if (textLower.match(/event|competition|contest|kalihokan/i)) {
      response = keywordResponses[language].event;
    } else if (textLower.match(/training|ojt|internship|practicum/i)) {
      response = keywordResponses[language].training;
    } else if (textLower.match(/academic|subject|study|pag-aaral/i)) {
      response = keywordResponses[language].academic;
    }
    
    await sendMessage(sender_psid, response, language);
  }
}

// Send message with quick replies
async function sendMessage(sender_psid, text, language) {
  const quickReplies = getQuickReplies(language);
  
  const response = {
    text: text,
    quick_replies: quickReplies.map(qr => ({
      content_type: "text",
      title: qr.title,
      payload: qr.payload
    }))
  };

  await callSendAPI(sender_psid, response);
}

// Send simple text message without quick replies
async function sendTextMessage(sender_psid, text) {
  await callSendAPI(sender_psid, { text: text });
}

// Send API call to Facebook Messenger
async function callSendAPI(sender_psid, response) {
  if (!PAGE_ACCESS_TOKEN) {
    console.error("❌ Cannot send message: PAGE_ACCESS_TOKEN not set");
    return;
  }

  const request_body = {
    recipient: { id: sender_psid },
    message: response,
  };

  const url = `https://graph.facebook.com/v21.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;

  try {
    console.log(`📤 Sending message to ${sender_psid}...`);
    
    const res = await axios.post(url, request_body);

    if (res.data.error) {
      console.error("❌ Facebook API error:", JSON.stringify(res.data.error));
      console.error("Error code:", res.data.error.code);
      console.error("Error message:", res.data.error.message);
      
      // Check for specific errors
      if (res.data.error.code === 190) {
        console.error("🔑 ACCESS TOKEN ERROR: Your PAGE_ACCESS_TOKEN is invalid or expired!");
      } else if (res.data.error.code === 100) {
        console.error("📋 PARAMETER ERROR: Invalid parameter in request");
      }
    } else {
      console.log(`✅ Message sent successfully to ${sender_psid}`);
    }
  } catch (err) {
    console.error("❌ Unable to send message:", err.response?.data || err.message);
    console.error("Stack trace:", err.stack);
  }
}

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    status: "running",
    bot: "Hestia Tourism Assistant",
    version: "3.0.0-merged",
    gemini_model: "gemini-1.5-pro",
    gemini_enabled: !!GEMINI_API_KEY,
    page_token_set: !!PAGE_ACCESS_TOKEN
  });
});

// Test endpoint to verify bot configuration
app.get("/test", (req, res) => {
  res.json({
    verify_token_set: !!VERIFY_TOKEN,
    page_access_token_set: !!PAGE_ACCESS_TOKEN,
    gemini_api_key_set: !!GEMINI_API_KEY,
    environment: process.env.NODE_ENV || "development",
    gemini_model: "gemini-1.5-pro"
  });
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("\n" + "=".repeat(50));
  console.log(`🚀 Hestia Tourism Bot Server Started`);
  console.log("=".repeat(50));
  console.log(`📡 Server running on port: ${PORT}`);
  console.log(`🌐 Webhook endpoint: /webhook`);
  console.log(`✅ Verify token set: ${!!VERIFY_TOKEN}`);
  console.log(`✅ Page access token set: ${!!PAGE_ACCESS_TOKEN}`);
  console.log(`🤖 Gemini AI enabled: ${!!GEMINI_API_KEY}`);
  console.log(`🧠 Gemini Model: gemini-1.5-pro`);
  console.log("=".repeat(50) + "\n");
  
  if (!PAGE_ACCESS_TOKEN) {
    console.error("⚠️  WARNING: PAGE_ACCESS_TOKEN not set!");
    console.error("⚠️  Bot will NOT be able to send messages!");
    console.error("⚠️  Set it in your environment variables.\n");
  }
  
  if (!GEMINI_API_KEY) {
    console.error("⚠️  WARNING: GEMINI_API_KEY not set!");
    console.error("⚠️  Bot will use fallback keyword matching only.\n");
  }
});
