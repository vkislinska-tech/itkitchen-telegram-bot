const express = require("express");
const fetch = require("node-fetch"); // для відповіді боту
const app = express();

app.use(express.json());

// Проста перевірка alive
app.get("/alive", (req, res) => {
  res.send("Server is alive ✅");
});

// Telegram webhook
app.post("/", async (req, res) => {
  try {
    const message = req.body.message;
    console.log("Incoming message:", JSON.stringify(req.body, null, 2));

    if (message && message.chat && message.text) {
      const chatId = message.chat.id;
      const text = message.text;

      // Відповідь боту
      await fetch(`https://api.telegram.org/bot${process.env.TG_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: `Привіт! Ти написав: ${text}` })
      });
    }

    res.send("OK");
  } catch (err) {
    console.error("POST / error:", err);
    res.sendStatus(500);
  }
});

// Порт
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
