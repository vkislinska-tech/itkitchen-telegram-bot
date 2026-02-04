const express = require("express");
const fetch = require("node-fetch");
const app = express();

app.use(express.json());

// --- Alive маршрут ---
app.get("/alive", (req, res) => {
  res.send("Server is alive ✅");
});

// --- Основний маршрут Telegram ---
app.post("/", async (req, res) => {
  try {
    const message = req.body.message;
    console.log("Incoming Telegram message:", JSON.stringify(req.body, null, 2));

    if (message && message.chat && message.text) {
      const chatId = message.chat.id;
      const text = message.text.toLowerCase();

      // --- Логіка школи ---
      let reply = "Вибач, я не зрозумів 😅";
      if (text.includes("розклад")) {
        reply = "Ось розклад школи: Пн-Пт 08:00–15:00";
      } else if (text.includes("контакти")) {
        reply = "Контакти школи: +380 XX XXX XXXX, school@example.com";
      } else if (text.includes("привіт")) {
        reply = "Привіт! Я бот IT Kitchen 🧑‍🍳";
      }

      // --- Відправка відповіді в Telegram ---
      await fetch(`https://api.telegram.org/bot${process.env.TG_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: reply })
      });
    }

    res.send("OK");
  } catch (err) {
    console.error("POST / error:", err);
    res.sendStatus(500);
  }
});

// --- Порт ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
