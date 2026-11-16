const QUESTIONS_LIMIT = 20;
const HISTORY_KEY = 'quiz_recent_history';
const GIST_CONFIG_KEY = 'quiz_gist_config';

let currentQuestions = [];
let currentIndex = 0;
let score = 0;
let currentTestTitle = '';

const menuScreen = document.getElementById('menu-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultScreen = document.getElementById('result-screen');

// Перемешивание массива (алгоритм Фишера-Йейтса)
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// --- БЛОК СИНХРОНИЗАЦИИ С GITHUB GIST ---

function getGistConfig() {
  return JSON.parse(localStorage.getItem(GIST_CONFIG_KEY) || 'null');
}

function setSyncStatus(text, isError = false) {
  const el = document.getElementById('sync-status');
  el.textContent = text;
  el.style.color = isError ? '#dc2626' : '#6b7280';
}

// Загрузка истории из Gist
async function pullHistoryFromGist() {
  const cfg = getGistConfig();
  if (!cfg || !cfg.gistId || !cfg.token) {
    setSyncStatus('Локальный режим (без облака)');
    return;
  }

  setSyncStatus('Синхронизация...');
  try {
    const res = await fetch(`https://api.github.com/gists/${cfg.gistId}?t=${Date.now()}`, {
      headers: {
        'Authorization': `Bearer ${cfg.token}`,
        'Accept': 'application/vnd.github+json'
      }
    });

    if (!res.ok) throw new Error(`Ошибка HTTP ${res.status}`);

    const data = await res.json();
    const fileContent = data.files['history.json']?.content;

    if (fileContent) {
      const remoteHistory = JSON.parse(fileContent);
      if (Array.isArray(remoteHistory)) {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(remoteHistory));
        renderHistory();
      }
    }
    setSyncStatus('☁️ Синхронизировано с GitHub');
  } catch (e) {
    setSyncStatus('⚠️ Ошибка загрузки из Gist', true);
    console.error(e);
  }
}

// Отправка истории в Gist
async function pushHistoryToGist(historyArray) {
  const cfg = getGistConfig();
  if (!cfg || !cfg.gistId || !cfg.token) return;

  setSyncStatus('Сохранение в облако...');
  try {
    const res = await fetch(`https://api.github.com/gists/${cfg.gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${cfg.token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: {
          'history.json': {
            content: JSON.stringify(historyArray, null, 2)
          }
        }
      })
    });

    if (!res.ok) throw new Error(`Ошибка HTTP ${res.status}`);
    setSyncStatus('☁️ Сохранено в GitHub');
  } catch (e) {
    setSyncStatus('⚠️ Не удалось сохранить в Gist', true);
    console.error(e);
  }
}

// Управление формой настроек синхронизации
document.getElementById('toggle-sync-btn').onclick = () => {
  const box = document.getElementById('sync-settings');
  box.classList.toggle('hidden');

  const cfg = getGistConfig();
  if (cfg) {
    document.getElementById('gist-id-input').value = cfg.gistId || '';
    document.getElementById('gist-token-input').value = cfg.token || '';
  }
};

document.getElementById('save-sync-btn').onclick = async () => {
  const gistId = document.getElementById('gist-id-input').value.trim();
  const token = document.getElementById('gist-token-input').value.trim();

  if (!gistId || !token) {
    localStorage.removeItem(GIST_CONFIG_KEY);
    setSyncStatus('Локальный режим (настройки очищены)');
    document.getElementById('sync-settings').classList.add('hidden');
    return;
  }

  localStorage.setItem(GIST_CONFIG_KEY, JSON.stringify({ gistId, token }));
  document.getElementById('sync-settings').classList.add('hidden');
  await pullHistoryFromGist();
};

// --- ОСНОВНАЯ ЛОГИКА ПРИЛОЖЕНИЯ ---

async function initMenu() {
  renderHistory();
  pullHistoryFromGist(); // Фоново подтягиваем актуальные данные из облака

  try {
    const res = await fetch(`data/manifest.json?t=${Date.now()}`);
    const data = await res.json();
    const container = document.getElementById('categories-list');
    container.innerHTML = '';

    data.categories.forEach(cat => {
      const catTitle = document.createElement('h3');
      catTitle.textContent = cat.title;
      catTitle.style.marginTop = '20px';
      container.appendChild(catTitle);

      cat.subcategories.forEach(sub => {
        const btn = document.createElement('button');
        btn.textContent = `${sub.title} (${sub.count} вопр.)`;
        btn.onclick = () => startQuiz(sub.file, `${cat.title}: ${sub.title}`);
        container.appendChild(btn);
      });
    });
  } catch (e) {
    document.getElementById('categories-list').textContent = 'Ошибка загрузки manifest.json';
  }
}

async function saveResult(title, score, total) {
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  const now = new Date();
  const dateStr = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) +
                  ' ' + now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  history.unshift({
    title,
    score,
    total,
    date: dateStr
  });

  const trimmedHistory = history.slice(0, 15);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmedHistory));
  await pushHistoryToGist(trimmedHistory);
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  const container = document.getElementById('history-list');
  const clearBtn = document.getElementById('clear-history-btn');

  if (history.length === 0) {
    container.innerHTML = '<div class="meta">Пока нет пройденных тестов</div>';
    clearBtn.classList.add('hidden');
    return;
  }

  clearBtn.classList.remove('hidden');
  container.innerHTML = '';

  history.forEach(item => {
    const percent = Math.round((item.score / item.total) * 100);
    let badgeClass = 'badge-bad';
    if (percent >= 80) badgeClass = 'badge-good';
    else if (percent >= 50) badgeClass = 'badge-mid';

    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <div class="history-title">${item.title}</div>
      <div class="history-meta">
        <span>${item.date}</span>
        <span class="badge ${badgeClass}">${item.score} / ${item.total} (${percent}%)</span>
      </div>
    `;
    container.appendChild(div);
  });
}

document.getElementById('clear-history-btn').onclick = async () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
  await pushHistoryToGist([]);
};

async function startQuiz(filePath, testTitle) {
  const res = await fetch(filePath);
  const data = await res.json();

  currentTestTitle = testTitle || `${data.category}: ${data.subcategory}`;

  currentQuestions = shuffle(data.questions)
    .slice(0, QUESTIONS_LIMIT)
    .map(q => {
      const correctText = q.options[q.correctIndex];
      const shuffledOptions = shuffle(q.options);
      return {
        ...q,
        options: shuffledOptions,
        correctIndex: shuffledOptions.indexOf(correctText)
      };
    });

  currentIndex = 0;
  score = 0;

  menuScreen.classList.add('hidden');
  resultScreen.classList.add('hidden');
  quizScreen.classList.remove('hidden');
  renderQuestion();
}

function renderQuestion() {
  const q = currentQuestions[currentIndex];
  document.getElementById('progress-text').textContent = `Вопрос ${currentIndex + 1} из ${currentQuestions.length}`;
  document.getElementById('question-text').textContent = q.question;

  const optionsList = document.getElementById('options-list');
  optionsList.innerHTML = '';

  const expBox = document.getElementById('explanation-box');
  expBox.classList.add('hidden');
  document.getElementById('next-btn').classList.add('hidden');

  q.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.textContent = opt;
    btn.onclick = () => handleAnswer(idx, btn);
    optionsList.appendChild(btn);
  });
}

function handleAnswer(selectedIndex, selectedBtn) {
  const q = currentQuestions[currentIndex];
  const buttons = document.getElementById('options-list').querySelectorAll('button');

  buttons.forEach((btn, idx) => {
    btn.disabled = true;
    if (idx === q.correctIndex) btn.classList.add('correct');
  });

  if (selectedIndex === q.correctIndex) {
    score++;
  } else {
    selectedBtn.classList.add('wrong');
  }

  if (q.explanation) {
    const expBox = document.getElementById('explanation-box');
    expBox.textContent = q.explanation;
    expBox.classList.remove('hidden');
  }

  document.getElementById('next-btn').classList.remove('hidden');
}

document.getElementById('next-btn').onclick = () => {
  currentIndex++;
  if (currentIndex < currentQuestions.length) {
    renderQuestion();
  } else {
    saveResult(currentTestTitle, score, currentQuestions.length);
    quizScreen.classList.add('hidden');
    resultScreen.classList.remove('hidden');
    document.getElementById('score-text').textContent = `Правильных ответов: ${score} из ${currentQuestions.length}`;
  }
};

const goHome = () => {
  renderHistory();
  quizScreen.classList.add('hidden');
  resultScreen.classList.add('hidden');
  menuScreen.classList.remove('hidden');
};

document.getElementById('back-btn').onclick = goHome;
document.getElementById('restart-btn').onclick = goHome;

initMenu();
