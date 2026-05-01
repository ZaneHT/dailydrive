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

async function generateIntro() {
  const now = new Date().toLocaleDateString("en-AU", {
    timeZone: "Australia/Sydney",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const prompt = `You are generating a short, warm and energising daily intro for Naresh's personal podcast playlist called Daily Drive. 

Today is ${now} in Sydney, Australia.

Write a spoken intro that is exactly 3-4 sentences long:
1. A warm good morning greeting using the date, know I am based in Sydney Australia so the facts should be relevant to that location and time zone, and a friendly welcome to the Daily Drive podcast playlist — make it personal and engaging, like a radio host would do, not too formal or robotic
2. Give a brief overview of the day's news, weather and any special events or holidays — keep it light and positive, no doom and gloom
3. An interesting fun fact, thought for the day, or piece of wisdom — keep it varied, could be historical, scientific, philosophical or humorous
4. A short energising send-off to start the day

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
  const guid = `daily-drive-intro-${now.toISOString().split("T")[0]}`;

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
        url="https://zaneht.github.io/dailydrive/podcast/intro.mp3" 
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