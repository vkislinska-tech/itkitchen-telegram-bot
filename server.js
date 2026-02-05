const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

const { TG_TOKEN, GEMINI_KEY, ADMIN_ID, PORT = 3000 } = process.env;
const sessions = {};

const SYSTEM_PROMPT = `
Ти — інтелектуальний ментор школи «IT-кухня» 👨‍🍳💻 (Софіївська Борщагівка).

ТВОЯ БАЗА ЗНАНЬ (ДЛЯ ВПЕВНЕНИХ ВІДПОВІДЕЙ):
1. РОЗКЛАД: Ми готуємося до відкриття, тому точний розклад ЗАРАЗ ФОРМУЄТЬСЯ разом із групами передзапису. Ми підбираємо години так, щоб усім було зручно. Вікторія зможе врахувати ваші побажання при дзвінку! 🏗️
2. ЦІНИ: Від 2400 до 3200 грн на місяць. 💰
3. СТАТУС: Активний передзапис. Офіційний старт зовсім скоро.
4. КУРСИ (Тільки ці 6): Digital Art (Procreate), Геймдизайн (Roblox/Minecraft), 3D-моделювання, Креативне програмування, Блогінг, Штучний інтелект. 
❌ РОБОТОТЕХНІКИ НЕМАЄ.

ПРАВИЛА СПІЛКУВАННЯ:
- ГАРНИЙ ТОН: Обов'язково будь ввічливим! Вітайся на початку розмови ✨. Але не повторюй "Привіт" у кожній наступній репліці діалогу.
- ПРОАКТИВНІСТЬ: Кожна відповідь має закінчуватися твоїм запитанням до батьків. Веди діалог!
- НІКОЛИ не кажи "я не маю доступу" або "я не знаю". Використовуй інформацію про фазу передзапису.

ТЕРПІННЯ ТА ЗАКЛИК:
- Пропонуй дзвінок Вікторії після 4-го повідомлення або коли клієнт прямо спитає про запис чи розклад.
- ТРИГЕР КНОПКИ: Якщо згодні, пиши ТІЛЬКИ: "Чудово! Натисніть кнопку нижче, щоб поділитися номером, і ми зв'яжемося з вами. ✨"
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
            let context = "Передзапис / Розклад";
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
            return res.json({ method: "sendMessage", chat_id: chatId, text: "Дякую! Вікторія отримала ваш контакт і зателефонує вам щодо деталей розкладу та броні місця! ✨", reply_markup: { remove_keyboard: true } });
        }

        if (!message.text) return res.sendStatus(200);
        const userText = message.text;

        // --- 2. ЛОГІКА /START ---
if (userText === '/start') { 
    delete sessions[chatId]; 
    // Ми НЕ повертаємо тут текст через return res.json, 
    // щоб код пішов далі до блоку "3. ПАМ'ЯТЬ ТА AI"
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
                keyboard: [[{ text: "📱 Поділитися номером", request_contact: true }]], 
                one_time_keyboard: true, 
                resize_keyboard: true 
            };
        }

        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (e) { console.error(e); }
    res.sendStatus(200);
});

app.listen(PORT, () => console.log(`Mentor is online!`));
