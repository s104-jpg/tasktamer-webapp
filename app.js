const tg = window.Telegram.WebApp;
tg.expand();

console.log('TaskTamer v3 загружен');

// === Восстановление данных из URL ===
function loadStateFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const startParam = urlParams.get('start');
    if (!startParam) return;
    try {
        const binaryStr = atob(startParam.replace(/-/g, '+').replace(/_/g, '/'));
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        const jsonStr = new TextDecoder('utf-8').decode(bytes);
        const state = JSON.parse(jsonStr);
        if (state.tasks) localStorage.setItem('taskTamer_tasks', JSON.stringify(state.tasks));
        if (state.achievements) localStorage.setItem('taskTamer_achievements', JSON.stringify(state.achievements));
        console.log('Данные восстановлены из URL');
    } catch(e) {
        console.error('Ошибка восстановления:', e);
    }
}
loadStateFromURL();

// === Достижения ===
const ACHIEVEMENTS = [
    { key: "first_task", name: "Первый шаг", icon: "👶" },
    { key: "first_complete", name: "Покоритель", icon: "✅" },
    { key: "ten_tasks", name: "Десятка", icon: "🔟" },
    { key: "high_rating", name: "Отлично", icon: "🌟" },
    { key: "night_owl", name: "Ночная сова", icon: "🦉" },
    { key: "speedy", name: "Спринтер", icon: "⚡" },
    { key: "comeback", name: "Возвращение", icon: "👋" },
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
updateAchievements();

// === Задачи ===
let tasks = JSON.parse(localStorage.getItem('taskTamer_tasks') || '[]');
let selectedPeriod = 'day';

document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPeriod = btn.dataset.period;
    });
});

// Кнопка создания задачи
document.getElementById('createTaskBtn').addEventListener('click', () => {
    const text = document.getElementById('taskText').value.trim();
    if (!text) { 
        showToast('Введи текст задачи!');
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
    
    // Отправляем боту без закрытия приложения
    try {
        tg.sendData(JSON.stringify({
            action: 'task_created',
            task_id: task.id,
            task_text: task.text,
            period: task.period
        }));
        showToast('Задача создана! ✅');
    } catch(e) { 
        showToast('Ошибка: ' + e.message); 
    }
    
    document.getElementById('taskText').value = '';
    updateUI();
});

// Выполнение задачи (НЕ закрывает приложение)
window.toggleTask = function(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    if (!task.completed) {
        task.completed = true;
        task.completed_at = new Date().toISOString();
        localStorage.setItem('taskTamer_tasks', JSON.stringify(tasks));
        
        // Отправляем боту
        try {
            tg.sendData(JSON.stringify({ action: 'task_completed', task_id: task.id }));
        } catch(e) {}
        
        // Показываем оценку ВНУТРИ приложения
        showRatingModal(taskId);
    } else {
        task.completed = false;
        localStorage.setItem('taskTamer_tasks', JSON.stringify(tasks));
    }
    updateUI();
};

// === ОЦЕНКА ВНУТРИ ПРИЛОЖЕНИЯ ===
let ratingTaskId = null;

function showRatingModal(taskId) {
    ratingTaskId = taskId;
    
    // Удаляем старый модал если есть
    const oldModal = document.querySelector('.rating-modal');
    if (oldModal) oldModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'rating-modal';
    modal.innerHTML = `
        <div class="rating-content glass-card">
            <h3>Оцени выполнение</h3>
            <div class="rating-stars">
                ${[1,2,3,4,5,6,7,8,9,10].map(i => `
                    <button class="star-btn" onclick="submitRating(${i})">${i}</button>
                `).join('')}
            </div>
            <button class="cancel-btn" onclick="closeRatingModal()">Позже</button>
        </div>
    `;
    document.body.appendChild(modal);
}

function submitRating(rating) {
    if (!ratingTaskId) return;
    const task = tasks.find(t => t.id === ratingTaskId);
    if (task) {
        task.rating = rating;
        task.rated_at = new Date().toISOString();
        localStorage.setItem('taskTamer_tasks', JSON.stringify(tasks));
        
        // Отправляем оценку боту
        try {
            tg.sendData(JSON.stringify({
                action: 'task_rated',
                task_id: ratingTaskId,
                rating: rating
            }));
        } catch(e) {}
        
        showToast(`Оценка: ${rating}/10 ⭐`);
    }
    closeRatingModal();
    updateUI();
}

function closeRatingModal() {
    const modal = document.querySelector('.rating-modal');
    if (modal) modal.remove();
    ratingTaskId = null;
}

// Всплывающее уведомление (вместо alert)
function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

function updateUI() {
    const list = document.getElementById('tasksList');
    if (!list) return;
    if (!tasks || tasks.length === 0) {
        list.innerHTML = '<div class="empty-state"><span class="empty-icon">🎈</span><p>Пока задач нет.</p></div>';
    } else {
        list.innerHTML = tasks.map((t,i) => `
            <div class="task-item ${t.completed ? 'completed' : ''}" style="animation-delay:${i*0.05}s">
                <div class="task-checkbox ${t.completed ? 'checked' : ''}" onclick="toggleTask('${t.id}')"></div>
                <div style="flex:1">
                    <div style="font-weight:500">${escapeHtml(t.text)}</div>
                    ${t.rating ? `<div style="font-size:12px;color:#a855f7">⭐ ${t.rating}/10</div>` : ''}
                </div>
            </div>
        `).join('');
    }
    document.getElementById('totalTasks').textContent = tasks.length;
    document.getElementById('completedTasks').textContent = tasks.filter(t => t.completed).length;
    const rated = tasks.filter(t => t.rating);
    const avg = rated.length ? (rated.reduce((s,t) => s + t.rating, 0) / rated.length).toFixed(1) : '0';
    document.getElementById('avgRating').textContent = avg;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Добавляем стили для toast и rating-modal
const style = document.createElement('style');
style.textContent = `
    .toast {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(168,85,247,0.9);
        color: white;
        padding: 12px 24px;
        border-radius: 12px;
        font-size: 14px;
        z-index: 9999;
        transition: opacity 0.3s;
        pointer-events: none;
    }
    .rating-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9998;
    }
    .rating-content {
        text-align: center;
        padding: 24px;
        max-width: 300px;
        width: 90%;
    }
    .rating-content h3 {
        margin-bottom: 16px;
        color: #fff;
    }
    .rating-stars {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: center;
        margin-bottom: 16px;
    }
    .star-btn {
        width: 40px;
        height: 40px;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 50%;
        background: rgba(255,255,255,0.1);
        color: white;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.2s;
    }
    .star-btn:hover {
        background: rgba(168,85,247,0.5);
        border-color: #a855f7;
    }
    .cancel-btn {
        padding: 8px 16px;
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 8px;
        color: #fff;
        cursor: pointer;
    }
`;
document.head.appendChild(style);

updateUI();
