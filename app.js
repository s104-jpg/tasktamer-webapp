const tg = window.Telegram.WebApp;
tg.expand();

console.log('TaskTamer app.js загружен');

// === Восстановление данных из URL (синхронизация с ботом) ===
function loadStateFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const startParam = urlParams.get('start');
    if (!startParam) {
        console.log('Нет параметра start в URL');
        return;
    }
    try {
        // Декодируем base64 в байты UTF-8
        const binaryStr = atob(startParam.replace(/-/g, '+').replace(/_/g, '/'));
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }
        const jsonStr = new TextDecoder('utf-8').decode(bytes);
        const state = JSON.parse(jsonStr);
        
        if (state.tasks && Array.isArray(state.tasks)) {
            localStorage.setItem('taskTamer_tasks', JSON.stringify(state.tasks));
            console.log('Задачи восстановлены из URL:', state.tasks.length);
        } else {
            console.log('Нет задач в состоянии');
        }
        if (state.achievements && Array.isArray(state.achievements)) {
            localStorage.setItem('taskTamer_achievements', JSON.stringify(state.achievements));
            console.log('Достижения восстановлены:', state.achievements.length);
        }
    } catch(e) {
        console.error('Ошибка восстановления состояния:', e);
    }
}
loadStateFromURL();

// === Достижения ===
const ACHIEVEMENTS = [
    { key: "first_task", name: "Первый шаг", desc: "Создайте первую задачу", icon: "👶", check: (stats) => stats.total >= 1 },
    { key: "first_complete", name: "Покоритель", desc: "Выполните первую задачу", icon: "✅", check: (stats) => stats.completed >= 1 },
    { key: "ten_tasks", name: "Десятка", desc: "Создайте 10 задач", icon: "🔟", check: (stats) => stats.total >= 10 },
    { key: "fifty_tasks", name: "Полтинник", desc: "Создайте 50 задач", icon: "🪙", check: (stats) => stats.total >= 50 },
    { key: "high_rating", name: "Отлично", desc: "Оцените выполнение на 10 баллов", icon: "🌟", check: (stats) => stats.avgRating == 10 },
    { key: "perfect_week", name: "Идеальная неделя", desc: "Выполните 7 задач подряд", icon: "🔥", check: (stats) => stats.streak >= 7 },
    { key: "night_owl", name: "Ночная сова", desc: "Создайте задачу после 23:00", icon: "🦉", check: (stats) => stats.nightOwl },
    { key: "speedy", name: "Спринтер", desc: "Выполните задачу в течение часа", icon: "⚡", check: (stats) => stats.speedy },
    { key: "collector", name: "Коллекционер", desc: "Получите 5 разных достижений", icon: "🏅", check: (stats, earned) => earned.length >= 5 },
    { key: "comeback", name: "Возвращение", desc: "Вернитесь после 3 дней", icon: "👋", check: (stats) => stats.comeback },
];
let earnedAchievements = JSON.parse(localStorage.getItem('taskTamer_achievements') || '[]');

function updateAchievements() {
    const grid = document.getElementById('achievementsList');
    if (!grid) return;
    const earnedList = ACHIEVEMENTS.filter(a => earnedAchievements.includes(a.key));
    if (earnedList.length === 0) {
        grid.innerHTML = '<div class="empty-state"><span class="empty-icon">🔒</span><p>Пока нет достижений</p></div>';
        return;
    }
    grid.innerHTML = earnedList.map(a => `
        <div class="achievement-item earned">
            <span class="achievement-icon">${a.icon}</span>
            <span class="achievement-name">${a.name}</span>
        </div>
    `).join('');
}

function checkAndAwardAchievements() {
    if (!tasks) return;
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const ratings = tasks.filter(t => t.rating).map(t => t.rating);
    const avgRating = ratings.length ? ratings.reduce((a,b) => a + b, 0) / ratings.length : 0;
    const streak = parseInt(localStorage.getItem('taskTamer_streak') || '0');
    const nightOwl = tasks.some(t => {
        const hour = new Date(t.created).getHours();
        return hour >= 23 || hour < 5;
    });
    const speedy = tasks.some(t => {
        if (t.completed && t.created && t.completed_at) {
            const created = new Date(t.created);
            const completedAt = new Date(t.completed_at);
            return (completedAt - created) / 1000 < 3600;
        }
        return false;
    });
    const comeback = localStorage.getItem('taskTamer_comeback') === 'true';

    const stats = { total, completed, avgRating, streak, nightOwl, speedy, comeback };

    ACHIEVEMENTS.forEach(a => {
        if (!earnedAchievements.includes(a.key) && a.check(stats, earnedAchievements)) {
            earnedAchievements.push(a.key);
            try {
                tg.sendData(JSON.stringify({ action: 'achievement_unlocked', key: a.key }));
            } catch(e) {}
        }
    });
    localStorage.setItem('taskTamer_achievements', JSON.stringify(earnedAchievements));
    updateAchievements();
}

// === Задачи ===
let tasks = JSON.parse(localStorage.getItem('taskTamer_tasks') || '[]');
let selectedPeriod = 'day';

// Инициализация кнопок периода
document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPeriod = btn.dataset.period;
    });
});

// Кнопка создания задачи
const createBtn = document.getElementById('createTaskBtn');
if (createBtn) {
    createBtn.addEventListener('click', () => {
        const taskInput = document.getElementById('taskText');
        if (!taskInput) return;
        const text = taskInput.value.trim();
        if (!text) {
            alert('Введи текст задачи!');
            return;
        }
        const task = {
            id: Date.now().toString(),
            text,
            period: selectedPeriod,
            created: new Date().toISOString(),
            completed: false
        };
        tasks.unshift(task);
        localStorage.setItem('taskTamer_tasks', JSON.stringify(tasks));
        console.log('Задача создана:', task);

        try {
            tg.sendData(JSON.stringify({
                action: 'task_created',
                task_id: task.id,
                task_text: task.text,
                period: task.period
            }));
            alert('Задача отправлена боту!');
        } catch (e) {
            alert('Ошибка отправки: ' + e.message);
        }

        taskInput.value = '';
        checkAndAwardAchievements();
        updateUI();
    });
}

function updateUI() {
    const list = document.getElementById('tasksList');
    if (!list) return;
    if (!tasks || tasks.length === 0) {
        list.innerHTML = '<div class="empty-state"><span class="empty-icon">🎈</span><p>Пока задач нет. Создай первую!</p></div>';
    } else {
        list.innerHTML = tasks.map((t,i) => `
            <div class="task-item ${t.completed ? 'completed' : ''}" style="animation-delay:${i*0.05}s">
                <div class="task-checkbox ${t.completed ? 'checked' : ''}" onclick="toggleTask('${t.id}')"></div>
                <div style="flex:1"><div style="font-weight:500">${escapeHtml(t.text)}</div></div>
            </div>
        `).join('');
    }
    // Статистика
    const totalEl = document.getElementById('totalTasks');
    const completedEl = document.getElementById('completedTasks');
    const avgEl = document.getElementById('avgRating');
    if (totalEl) totalEl.textContent = tasks ? tasks.length : 0;
    if (completedEl) completedEl.textContent = tasks ? tasks.filter(t => t.completed).length : 0;
    const rated = tasks ? tasks.filter(t => t.rating) : [];
    const avg = rated.length ? (rated.reduce((s,t) => s + t.rating, 0) / rated.length).toFixed(1) : '0';
    if (avgEl) avgEl.textContent = avg;
}

// Защита от XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.toggleTask = function(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    task.completed = !task.completed;
    if (task.completed) {
        task.completed_at = new Date().toISOString();
    }
    localStorage.setItem('taskTamer_tasks', JSON.stringify(tasks));
    if (task.completed) {
        try {
            tg.sendData(JSON.stringify({ action: 'task_completed', task_id: task.id }));
        } catch (e) {
            console.error('Ошибка отправки выполнения:', e);
        }
    }
    checkAndAwardAchievements();
    updateUI();
};

// Финальная инициализация
checkAndAwardAchievements();
updateUI();
console.log('TaskTamer готов, задач:', tasks ? tasks.length : 0);
