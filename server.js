const express = require("express");
const fetch = require("node-fetch"); // або import fetch
const app = express();

app.use(express.json());

// --- GET /alive ---
app.get("/alive", (req, res) => {
  res.send("Server is alive ✅");
});

// --- POST / для Telegram ---
app.post("/", async (req, res) => {
  try {
    const message = req.body.message;
    console.log("Incoming Telegram POST:", JSON.stringify(req.body, null, 2));

    if (message) {
      const chatId = message.chat.id;
      const text = message.text;

      const reply = `Привіт! Ти написав: ${text}`;
      await fetch(`https://api.telegram.org/bot${process.env.TG_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: reply })
      });
    }

    res.send("OK");
  } catch (err) {
    console.error("Error in POST /:", err);
    res.sendStatus(500);
  }
});

// --- PORT ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
