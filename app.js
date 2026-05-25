const tg = window.Telegram.WebApp;
tg.expand();

// --- Достижения (синхронизируются с ботом вручную, можно хранить в localStorage) ---
const ACHIEVEMENTS = [
    { key: "first_task", name: "Первый шаг", desc: "Создайте первую задачу", icon: "👶" },
    { key: "first_complete", name: "Покоритель", desc: "Выполните первую задачу", icon: "✅" },
    { key: "ten_tasks", name: "Десятка", desc: "Создайте 10 задач", icon: "🔟" },
    { key: "fifty_tasks", name: "Полтинник", desc: "Создайте 50 задач", icon: "🪙" },
    { key: "high_rating", name: "Отлично", desc: "Оцените выполнение на 10 баллов", icon: "🌟" },
    { key: "perfect_week", name: "Идеальная неделя", desc: "Выполните 7 задач подряд", icon: "🔥" },
    { key: "night_owl", name: "Ночная сова", desc: "Создайте задачу после 23:00", icon: "🦉" },
    { key: "speedy", name: "Спринтер", desc: "Выполните задачу в течение часа", icon: "⚡" },
    { key: "collector", name: "Коллекционер", desc: "Получите 5 разных достижений", icon: "🏅" },
    { key: "comeback", name: "Возвращение", desc: "Вернитесь после 3 дней", icon: "👋" }
];
let earnedAchievements = JSON.parse(localStorage.getItem('taskTamer_achievements') || '[]');

function updateAchievements() {
    const grid = document.getElementById('achievementsList');
    grid.innerHTML = ACHIEVEMENTS.map(a => {
        const earned = earnedAchievements.includes(a.key);
        return `<div class="achievement-item ${earned ? 'earned' : ''}">
                    <span class="achievement-icon">${a.icon}</span>
                    <span class="achievement-name">${a.name}</span>
                </div>`;
    }).join('');
}
// Вызываем при старте
updateAchievements();

// --- Остальная логика задач ---
let tasks = JSON.parse(localStorage.getItem('taskTamer_tasks') || '[]');
let selectedPeriod = 'day';

document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPeriod = btn.dataset.period;
    });
});

document.getElementById('createTaskBtn').addEventListener('click', () => {
    const text = document.getElementById('taskText').value.trim();
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
    
    document.getElementById('taskText').value = '';
    updateUI();
});

function updateUI() {
    const list = document.getElementById('tasksList');
    if (tasks.length === 0) {
        list.innerHTML = '<div class="empty-state"><span class="empty-icon">🎈</span><p>Пока задач нет.</p></div>';
    } else {
        list.innerHTML = tasks.map((t,i) => `
            <div class="task-item ${t.completed ? 'completed' : ''}" style="animation-delay:${i*0.05}s">
                <div class="task-checkbox ${t.completed ? 'checked' : ''}" onclick="toggleTask('${t.id}')"></div>
                <div style="flex:1"><div style="font-weight:500">${t.text}</div></div>
            </div>
        `).join('');
    }
    document.getElementById('totalTasks').textContent = tasks.length;
    document.getElementById('completedTasks').textContent = tasks.filter(t => t.completed).length;
    const rated = tasks.filter(t => t.rating);
    const avg = rated.length ? (rated.reduce((s,t) => s + t.rating, 0) / rated.length).toFixed(1) : '0';
    document.getElementById('avgRating').textContent = avg;
}

window.toggleTask = function(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    task.completed = !task.completed;
    localStorage.setItem('taskTamer_tasks', JSON.stringify(tasks));
    if (task.completed) {
        try {
            tg.sendData(JSON.stringify({ action: 'task_completed', task_id: task.id }));
            alert('Выполнение отмечено!');
        } catch (e) {
            alert('Ошибка отправки: ' + e.message);
        }
    }
    updateUI();
};

// Функция для ручного добавления ачивки (бот может отправить сообщение, но автосинхронизации нет)
function earnAchievement(key) {
    if (!earnedAchievements.includes(key)) {
        earnedAchievements.push(key);
        localStorage.setItem('taskTamer_achievements', JSON.stringify(earnedAchievements));
        updateAchievements();
    }
}

updateUI();
