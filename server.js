const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

const { TG_TOKEN, GEMINI_KEY, ADMIN_ID, PORT = 3000 } = process.env;
const sessions = {};

const SYSTEM_PROMPT = `
Ти — інтелектуальний ментор школи «IT-кухня» 👨‍🍳💻 (Софіївська Борщагівка). 

ТВОЇ ЗНАННЯ ПРО КУРСИ (Тільки ці 6 напрямків):
1. Цифровий малюнок (Procreate) — візуальний інтелект.
2. Геймдизайн (Roblox/Minecraft) — логіка та декомпозиція.
3. 3D-моделювання — просторове мислення та інженерія.
4. Креативне програмування — алгоритмічне мислення.
5. Медіа та блогінг — комунікація та впевненість.
6. Штучний інтелект (AI) — інструменти майбутнього.
❌ РОБОТОТЕХНІКИ У НАС НЕМАЄ.

ВАЖЛИВІ ФАКТИ:
- Ми готуємося до відкриття. Зараз триває ПЕРЕДЗАПИС. 🏗️
- Ціни: від 2400 до 3200 грн на місяць. 💰

ЛОГІКА ТА СТИЛЬ:
- Будь ментором: пояснюй "навіщо" це дитині. Не пиши рекламні лозунги. ✨
- ТЕРПІННЯ: Пропонуй дзвінок Вікторії ТІЛЬКИ після 4-го або 5-го повідомлення.
- ТРИГЕР КНОПКИ: Якщо клієнт згоден на дзвінок, пиши ТІЛЬКИ: "Чудово! Натисніть кнопку нижче, щоб поділитися номером, і ми зв'яжемося з вами. ✨"
- ОБМЕЖЕННЯ: До 450 символів (3-4 речення). Емодзі обов'язкові 🚀🎨.
`;

app.get('/alive', (req, res) => res.send('Kitchen is heating up! 👨‍🍳'));

app.post('/', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.sendStatus(200);
        const chatId = message.chat.id;

        // --- 1. ПЕРЕХОПЛЕННЯ ТЕЛЕФОНУ ---
        if (message.contact && ADMIN_ID) {
            const chatLink = `tg://user?id=${message.from.id}`;
            let context = "Передзапис";
            if (sessions[chatId]) {
                context = sessions[chatId]
                    .filter(msg => msg.role === "user" && !msg.parts[0].text.includes("Ти —"))
                    .map(msg => msg.parts[0].text).slice(-3).join(" | ");
            }

            await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: ADMIN_ID,
                    text: `🚀 ЗАЯВКА (ПЕРЕДЗАПИС)!\n👤 ${message.contact.first_name}\n📱 ${message.contact.phone_number}\n🔍 КОНТЕКСТ: ${context}\n💬 [ЧАТ](${chatLink})`,
                    parse_mode: 'Markdown'
                })
            });
            return res.json({ method: "sendMessage", chat_id: chatId, text: "Дякую! Вікторія отримала ваш номер і зателефонує вам щодо деталей передзапису! ✨", reply_markup: { remove_keyboard: true } });
        }

        if (!message.text) return res.sendStatus(200);
        const userText = message.text;

        // --- 2. ЛОГІКА /START ---
        if (userText === '/start') { 
            delete sessions[chatId]; 
            return res.json({ method: "sendMessage", chat_id: chatId, text: "Привіт! Вітаємо в IT Kitchen 👨‍🍳✨ Ми готуємося до відкриття та вже ведемо передзапис у групи. Чим цікавиться ваша дитина: малюванням, іграми чи 3D? 🤖🎨" }); 
        }
        
        // --- 3. ПАМ'ЯТЬ ТА AI ---
        if (!sessions[chatId]) sessions[chatId] = [{ role: "user", parts: [{ text: SYSTEM_PROMPT }] }];
        sessions[chatId].push({ role: "user", parts: [{ text: userText }] });

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: sessions[chatId] })
        });

        const data = await response.json();
        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Замислився трішки... Спробуйте ще раз! 🤔";
        sessions[chatId].push({ role: "model", parts: [{ text: replyText }] });

        // --- 4. ВІДПРАВКА ---
        const payload = { chat_id: chatId, text: replyText };
        if (replyText.includes("Натисніть кнопку нижче")) {
            payload.reply_markup = { keyboard: [[{ text: "📱 Поділитися номером", request_contact: true }]], one_time_keyboard: true, resize_keyboard: true };
        }

        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (e) { console.error(e); }
    res.sendStatus(200);
});

app.listen(PORT, () => console.log(`Smart Mentor live!`));
