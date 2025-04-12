const venom = require("venom-bot");
require("dotenv").config();
const axios = require("axios");
const express = require("express");

const app = express();
const PORT = 3000;

let lastChecked = Date.now();
let botActive = true; // ✅ Bot ON by default

const job = require("./cron");
job.start();

// 🤖 Gemini AI Handler
const fetchGeminiReply = async (msg) => {
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: `Act like Jatin Poriya – a chill, friendly, tech-savvy Gujarati dev. Reply to: ${msg}`,
              },
            ],
            role: "user",
          },
        ],
      }
    );

    const reply =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Sorry, no reply.";
    return `🤖: ${reply}`;
  } catch (error) {
    console.error("Gemini API Error:", error.message);
    return "❌ Automated reply failed.";
  }
};

// ⚙️ Setup Control Server
app.get("/start", (req, res) => {
  botActive = true;
  lastChecked = Date.now();
  res.send("✅ Bot started.");
});

app.get("/stop", (req, res) => {
  botActive = false;
  res.send("🛑 Bot stopped.");
});

app.listen(PORT, () => {
  console.log(`🧠 Control Server: http://localhost:${PORT}`);
});

// 🚀 Start WhatsApp Session
venom
  .create({
    session: "whatsapp-ai",
    multidevice: true,
    browserArgs: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--headless=new",
    ],
  })
  .then((client) => start(client))
  .catch((error) => console.log(error));

// 🧠 Main Message Logic
function start(client) {
  client.onMessage(async (message) => {
    if (!botActive) return;

    if (message.body.toLowerCase() === "#seen") {
      lastChecked = Date.now();
      await client.sendText(
        message.from,
        "✅ Seen updated. AI paused for older messages."
      );
      return;
    }

    if (
      !message.isGroupMsg &&
      message.body &&
      message.timestamp * 1000 > lastChecked
    ) {
      try {
        await client.startTyping(message.from);
        const aiReply = await fetchGeminiReply(message.body);
        await client.sendText(message.from, aiReply);
      } catch (err) {
        console.log("AutoReply Error:", err);
      }
    }
  });
}
