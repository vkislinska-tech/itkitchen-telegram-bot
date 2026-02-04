// server.js
const express = require("express");
const app = express();

app.use(express.json());

// GET /alive
app.get("/alive", (req, res) => {
  res.send("Server is alive ✅");
});

// POST / для Telegram
app.post("/", (req, res) => {
  console.log("Incoming Telegram POST:", JSON.stringify(req.body, null, 2));
  res.send("OK");
});

// PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
