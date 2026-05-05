#!/usr/bin/env node
// =============================================================================
// Daily Drive — AI Intro Generator (Google Gemini)
// =============================================================================
// Generates a personalised daily intro and prints it to the console.
// Run standalone: node generate-intro.js

const fs = require("fs");

// Load .env if present
if (fs.existsSync(".env")) {
  for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY not set.");
  process.exit(1);
}

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
  const GEMINI_MODEL = "gemini-2.5-flash";

async function getWeather() {
  const response = await fetch(
    "https://api.open-meteo.com/v1/forecast?latitude=-33.87&longitude=151.21&current=temperature_2m,apparent_temperature,weathercode,windspeed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Australia/Sydney&forecast_days=1"
  );
  const data = await response.json();
  
  const current = data.current;
  const daily = data.daily;
  
  // Convert weather code to description
  const weatherDescriptions = {
    0: "clear skies",
    1: "mainly clear", 2: "partly cloudy", 3: "overcast",
    45: "foggy", 48: "foggy",
    51: "light drizzle", 53: "drizzle", 55: "heavy drizzle",
    61: "light rain", 63: "rain", 65: "heavy rain",
    80: "rain showers", 81: "rain showers", 82: "heavy showers",
    95: "thunderstorms",
  };
  
  const condition = weatherDescriptions[current.weathercode] || "mixed conditions";
  
  return {
    current_temp: Math.round(current.temperature_2m),
    feels_like: Math.round(current.apparent_temperature),
    condition,
    wind_speed: Math.round(current.windspeed_10m),
    max_temp: Math.round(daily.temperature_2m_max[0]),
    min_temp: Math.round(daily.temperature_2m_min[0]),
    rain_chance: daily.precipitation_probability_max[0],
  };
}
  
async function generateIntro() {
  const weather = await getWeather();
  
  const now = new Date().toLocaleDateString("en-AU", {
    timeZone: "Australia/Sydney",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Determine time of day in Sydney
  const sydneyHour = parseInt(new Date().toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "numeric",
    hour12: false,
  }));

  const isMorning = sydneyHour < 12;

  const timeContext = isMorning ? `
This is a MORNING intro (current time is around ${sydneyHour}am Sydney time):
- Greet with "Good morning"
- Frame weather for the day ahead — what to expect as the day unfolds
- Be inspirational and energising — start of day energy, set a positive tone
- Send-off should be about having a great day, making it count
- If rain is likely, mention grabbing an umbrella before leaving
` : `
This is an AFTERNOON/EVENING intro (current time is around ${sydneyHour - 12 || 12}pm Sydney time):
- Greet with "Good afternoon" or "Good evening"
- Frame weather for the rest of the afternoon and evening — commute home conditions
- Be warm and wind-down focused — finishing the day strong, safe commute home
- Send-off should be about a great evening, rest well, see you tomorrow
- If rain is likely for the commute, mention it specifically
`;

  const prompt = `You are generating a short, warm and engaging daily intro for Naresh's personal podcast playlist called Daily Drive.

Today is ${now} in Sydney, NSW, Australia. Note: I am in New South Wales specifically — do not assume public holidays from other Australian states apply here. NSW public holidays only.

${timeContext}

Today's Sydney weather (use these specific details naturally in the intro):
- Current temperature: ${weather.current_temp}°C (feels like ${weather.feels_like}°C)
- Conditions: ${weather.condition}
- Today's range: ${weather.min_temp}°C to ${weather.max_temp}°C
- Chance of rain: ${weather.rain_chance}% — ${weather.rain_chance > 50 ? 'worth grabbing an umbrella!' : 'looking dry'}
- Wind speed: ${weather.wind_speed} km/h

IMPORTANT: Mention the actual temperature (${weather.current_temp}°C) and weather conditions naturally in sentence 1. If rain chance is above 50%, mention it in context of the time of day (morning = before leaving, afternoon = for the commute home).

Write a spoken intro that is exactly 3-4 sentences long:
1. A ${isMorning ? 'warm good morning' : 'warm good afternoon/evening'} greeting using the date and a natural mention of the actual weather — make it personal and engaging, like a radio host, not too formal or robotic
2. ${isMorning ? 'A brief uplifting overview of the day ahead — any special events or holidays, keep it light and positive' : 'A warm reflection on the day and what to look forward to this evening — keep it positive and wind-down focused'}
3. An interesting fun fact, thought for the day, or piece of wisdom — keep it varied, could be historical, scientific, philosophical or humorous
4. ${isMorning ? 'An energising send-off to start the day strong' : 'A warm send-off — safe drive home, enjoy the evening, recharge for tomorrow'}

Keep it conversational, warm and upbeat. Do not use markdown or bullet points. Write it as if it will be read aloud.`;

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.9,
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${error}`);
  }

  const data = await response.json();
  const intro = data.candidates[0].content.parts[0].text.trim();
  return intro;
}

async function textToSpeech(text) {
  const GOOGLE_TTS_API_KEY = process.env.GOOGLE_TTS_API_KEY;
  if (!GOOGLE_TTS_API_KEY) {
    console.error("❌ GOOGLE_TTS_API_KEY not set.");
    process.exit(1);
  }

  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: "en-AU",
          name: "en-AU-Neural2-B",
          ssmlGender: "MALE",
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: 1.1,
          pitch: 0.0,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google TTS error: ${error}`);
  }

  const data = await response.json();
  const audioBuffer = Buffer.from(data.audioContent, "base64");
  fs.writeFileSync("podcast/intro.mp3", audioBuffer);
  console.log("🔊 Audio saved to podcast/intro.mp3");
}

async function updateRssFeed(introText) {
  const now = new Date();
  const pubDate = now.toUTCString();
  const guid = `daily-drive-intro-${now.toISOString().replace(/[:.]/g, "-")}`;

  // Get MP3 file size for the enclosure length
  const mp3Size = fs.statSync("podcast/intro.mp3").size;

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>Naresh's Daily Drive Intro</title>
    <link>https://zaneht.github.io/dailydrive/podcast/</link>
    <description>A personalised AI-generated daily intro for Naresh's Daily Drive playlist.</description>
    <language>en-au</language>
    <itunes:author>Naresh Hirani</itunes:author>
    <itunes:owner>
      <itunes:name>Naresh Hirani</itunes:name>
      <itunes:email>mister.naresh.hirani@gmail.com</itunes:email>
    </itunes:owner>
    <itunes:image href="https://zaneht.github.io/dailydrive/podcast/cover.jpg"/>
    <itunes:category text="Daily News"/>
    <itunes:explicit>false</itunes:explicit>
    <item>
      <title>${introText.substring(0, 80)}...</title>
      <description>${introText}</description>
      <enclosure 
        url="https://zaneht.github.io/dailydrive/podcast/intro.mp3?v=${guid}"
        type="audio/mpeg" 
        length="${mp3Size}"/>
      <guid isPermaLink="false">${guid}</guid>
      <pubDate>${pubDate}</pubDate>
    </item>
  </channel>
</rss>`;

  fs.writeFileSync("podcast/feed.xml", rss);
  console.log("📡 RSS feed updated");
}

async function main() {
  console.log("🎙️  Generating daily intro...\n");
  const intro = await generateIntro();
  console.log("📝 Today's intro:\n");
  console.log(intro);
  console.log("\n🔊 Converting to audio...");
  await textToSpeech(intro);
  await updateRssFeed(intro);
  console.log("\n✅ Done!");
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});