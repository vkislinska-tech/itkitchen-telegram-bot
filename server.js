const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());

const { TG_TOKEN, GEMINI_KEY, ADMIN_ID, PORT = 3000 } = process.env;
const sessions = {};

const SYSTEM_PROMPT = `
Ти — проактивний ментор школи «IT-кухня» 👨‍🍳💻 (Софіївська Борщагівка). 

ТВОЯ МІСІЯ: Надихати через сенси та ВЕСТИ діалог.
1. КОЖНА відповідь має закінчуватися влучним питанням до батьків (наприклад: "А ваша дитина вже пробувала щось створювати сама чи це буде перший крок у світ IT?").
2. ЗАБОРОНА: Ніколи не вітайся знову ("Привіт", "Вітаю"), якщо діалог уже триває. 🛑

ТВОЯ БАЗА ЗНАНЬ:
- СТАТУС: Ми ще НЕ відкриті офіційно. Зараз триває ФАЗА ПЕРЕДЗАПИСУ та формування груп. 🏗️
- ЦІНИ: 2400–3200 грн на місяць. 💰
- КУРСИ (тільки ці 6): 1. Цифровий малюнок (Procreate), 2. Геймдизайн (Roblox/Minecraft), 3. 3D-моделювання, 4. Креативне програмування, 5. Блогінг, 6. Штучний інтелект (AI). 
❌ РОБОТОТЕХНІКИ НЕМАЄ.

ЛОГІКА ТЕРПІННЯ:
- Перші 4-5 повідомлень: Тільки надихаюча розмова. Ніяких номерів.
- Потім: Запитай, чи хоче клієнт дзвінок Вікторії, щоб забронювати місце за передзаписом.
- ТРИГЕР КНОПКИ: Якщо згодні, пиши ТІЛЬКИ: "Чудово! Натисніть кнопку нижче, щоб поділитися номером, і ми зв'яжемося з вами. ✨"

СТИЛЬ: Натхненний, лаконічний (3-4 речення). Емодзі обов'язкові ✨🎨.
`;

app.get('/alive', (req, res) => res.send('Kitchen is heating up! 👨‍🍳'));

app.post('/', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.sendStatus(200);
        const chatId = message.chat.id;

        // --- 1. ОБРОБКА КОНТАКТУ ---
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
                    text: `🚀 ЗАЯВКА (ПЕРЕДЗАПИС)!\n👤 ${message.contact.first_name}\n📱 ${message.contact.phone_number}\n🔍 ПИТАЛИ: ${context}\n💬 [ЧАТ](${chatLink})`,
                    parse_mode: 'Markdown'
                })
            });

            return res.json({ 
                method: "sendMessage", 
                chat_id: chatId, 
                text: "Дякую! Вікторія отримала ваш контакт і зателефонує вам щодо деталей передзапису та дати відкриття! ✨", 
                reply_markup: { remove_keyboard: true } 
            });
        }

        if (!message.text) return res.sendStatus(200);
        const userText = message.text;

        // --- 2. ЛОГІКА /START (Тут єдине привітання) ---
        if (userText === '/start') { 
            delete sessions[chatId]; 
            return res.json({ method: "sendMessage", chat_id: chatId, text: "Привіт! Вітаємо в IT Kitchen 👨‍🍳✨ Ми готуємося до відкриття та вже ведемо передзапис у групи. Чим найбільше цікавиться ваша дитина: малюванням, іграми чи, можливо, 3D? 🤖🎨" }); 
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

        // --- 4. ВІДПРАВКА ВІДПОВІДІ ---
        const payload = { chat_id: chatId, text: replyText };

        if (replyText.includes("Натисніть кнопку нижче")) {
            payload.reply_markup = { 
                keyboard: [[{ text: "📱 Поділитися моїм номером", request_contact: true }]], 
                one_time_keyboard: true, 
                resize_keyboard: true 
            };
        }

        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

    } catch (e) { console.error("Error:", e); }
    res.sendStatus(200);
});

app.listen(PORT, () => console.log(`Proactive Mentor is Live!`));
