const express = require('express');
const fetch = require('node-fetch'); // Переконайтеся, що node-fetch встановлено
const app = express();
app.use(express.json());

const { TG_TOKEN, GEMINI_KEY, ADMIN_ID, PORT = 3000 } = process.env;
const sessions = {};

const SYSTEM_PROMPT = `
Ти — інтелектуальний ментор школи «IT-кухня» 👨‍🍳💻 (Софіївська Борщагівка).

ТВОЯ БАЗА ЗНАНЬ (ДЛЯ ВПЕВНЕНИХ ВІДПОВІДЕЙ):
1. ЛОКАЦІЯ: Ми знаходимося за адресою: проспект Героїв Небесної Сотні, 18/4, ЖК «У квартал». Приміщення безпечне, розташоване на цокольному поверсі. 📍🛡️
2. ВІКОВІ ГРУПИ ТА ПІДХІД: Навчаємо дітей від 7 до 17 років, а також маємо групи для дорослих. Якщо дитині 6 років — запрошуємо на пробне заняття. Ми працюємо у форматі малих груп (зазвичай до 6-8 дітей), щоб забезпечити максимум уваги кожному учню. 👥✨
3. РОЗКЛАД: Ми готуємося до відкриття, тому точний розклад ЗАРАЗ ФОРМУЄТЬСЯ разом із групами передзапису. Ми підбираємо години так, щоб усім було зручно. Вікторія зможе врахувати ваші побажання при дзвінку! 🏗️
4. ЦІНИ: Від 2400 до 3200 грн на місяць. 💰
5. СТАТУС: Активний передзапис. Офіційний старт зовсім скоро.
6. КУРСИ: 
   - Digital Art (Procreate) 🎨
   - Геймдизайн (Roblox/Minecraft) 🎮
   - 3D-моделювання та 3D-друк на принтері Bambulab 🏗️🖨️
   - Креативне програмування 💻
   - Блогінг та створення медіаконтенту 📱🎥
   - Штучний інтелект 🤖
❌ РОБОТОТЕХНІКИ НЕМАЄ.

ПРАВИЛА СПІЛКУВАННЯ:
- ГАРНИЙ ТОН: Обов'язково будь ввічливим! Вітайся на початку розмови ✨. Але не повторюй "Привіт" у кожній наступній репліці діалогу.
- ПРОАКТИВНІСТЬ: Кожна відповідь має закінчуватися твоїм запитанням до батьків. Веди діалог!
- НІКОЛИ не кажи "я не маю доступу" або "я не знаю". Використовуй інформацію про фазу передзапису.

ТЕРПІННЯ ТА ЗАКЛИК:
- Пропонуй дзвінок Вікторії після 4-го повідомлення або коли клієнт прямо спитає про запис чи розклад.
- ТРИГЕР КНОПКИ: Якщо згодні, пиши ТІЛЬКИ: "Чудово! Натисніть кнопку нижче, щоб поділитися номером, і ми зв'яжемося з вами. ✨"
`;

// Цей маршрут потрібен для Cron-job, щоб будити бота
app.get('/alive', (req, res) => res.send('Kitchen is heating up! 👨‍🍳'));

app.post('/', async (req, res) => {
    // Відповідаємо Telegram одразу, щоб він не повторював запити
    res.sendStatus(200);

    try {
        const { message } = req.body;
        if (!message) return;
        const chatId = message.chat.id;

        // --- 1. ОБРОБКА КОНТАКТУ ---
        if (message.contact && ADMIN_ID) {
            const chatLink = `tg://user?id=${message.from.id}`;
            let context = "Передзапис / Розклад";
            
            // Спробуємо дістати контекст, якщо він є
            if (sessions[chatId] && sessions[chatId].length > 0) {
                 const history = sessions[chatId]
                    .filter(msg => msg.role === "user" && !msg.parts[0].text.includes("Ти —"))
                    .map(msg => msg.parts[0].text);
                 if (history.length > 0) context = history.slice(-3).join(" | ");
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
            
            // Відповідь користувачу після заявки
            await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: "Дякую! Вікторія отримала ваш контакт і зателефонує вам щодо деталей розкладу та броні місця! ✨", 
                    reply_markup: { remove_keyboard: true } 
                })
            });
            return;
        }

        if (!message.text) return;
        const userText = message.text;

        // --- 2. ЛОГІКА /START ---
        if (userText === '/start') { 
            delete sessions[chatId]; 
        }
        
        // --- 3. ПАМ'ЯТЬ ТА AI ---
        if (!sessions[chatId]) sessions[chatId] = [{ role: "user", parts: [{ text: SYSTEM_PROMPT }] }];
        sessions[chatId].push({ role: "user", parts: [{ text: userText }] });

        // ОЧИЩЕННЯ ПАМ'ЯТІ: Тримаємо тільки останні 6 повідомлень + інструкцію
        if (sessions[chatId].length > 13) { 
             sessions[chatId] = [
                sessions[chatId][0], 
                ...sessions[chatId].slice(-10) 
            ];
        }

        // --- ЗАПИТ ДО GEMINI З ТАЙМЕРОМ ---
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 секунд чекаємо

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: sessions[chatId] }),
                signal: controller.signal // Підключаємо наш контролер
            });
            clearTimeout(timeoutId); // Якщо встигли - скасовуємо таймер

            const data = await response.json();
            const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Замислився трішки... Спробуйте ще раз! 🤔";
            sessions[chatId].push({ role: "model", parts: [{ text: replyText }] });

            // --- 4. ВІДПРАВКА ВІДПОВІДІ ---
            const payload = { chat_id: chatId, text: replyText };
            
            // Перевірка на кнопку
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

        } catch (fetchError) {
            console.error("Gemini Error:", fetchError);
            // Якщо таймер спрацював або помилка мережі
            await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: "Вибачте, зараз дуже багато запитів. Спробуйте запитати ще раз через хвилинку! 👨‍🍳"
                })
            });
        }

    } catch (
