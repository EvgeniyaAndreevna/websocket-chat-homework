import './styles.css';
import logo from './assets/logo.svg';
import emptyIllustration from './assets/empty.svg';

const $ = (selector) => document.querySelector(selector);
const refs = {
  logo: $('#brand-logo'), emptyArt: $('#empty-art'),
  connectionBadge: $('#connection-badge'), connectionLabel: $('#connection-label'),
  footerState: $('#footer-state'), onlineCount: $('#online-count'), participantsLabel: $('#participants-label'), userTotal: $('#user-total'),
  members: $('#members'), feed: $('#message-feed'), empty: $('#empty-state'),
  messageForm: $('#message-form'), messageInput: $('#message-input'), sendMessage: $('#send-message'), chatError: $('#chat-error'),
  joinOverlay: $('#join-overlay'), joinForm: $('#join-form'), nickname: $('#nickname-input'), joinError: $('#join-error'), joinButton: $('#join-button'),
  settingsOverlay: $('#settings-overlay'), settingsForm: $('#settings-form'), serverUrl: $('#server-url'), settingsError: $('#settings-error'),
};
refs.logo.src = logo;
refs.emptyArt.src = emptyIllustration;

const CONFIGURED_URL = process.env.WS_URL;
const DEFAULT_LOCAL_URL = 'ws://127.0.0.1:7071/ws';
const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const STORAGE_KEY = 'netology_websocket_chat_url';
const REGISTRATION_TIMEOUT = 10_000;
const state = {
  url: localStorage.getItem(STORAGE_KEY) || CONFIGURED_URL || (isLocal ? DEFAULT_LOCAL_URL : ''),
  socket: null, user: null, pendingName: '', reconnectTimer: null, registrationTimer: null,
  attempt: 0, closedIntentionally: false,
};

function showOverlay(element, shouldShow) {
  element.hidden = !shouldShow;
  element.setAttribute('aria-hidden', String(!shouldShow));
}

function setStatus(status, label) {
  refs.connectionBadge.dataset.status = status;
  refs.connectionLabel.textContent = label;
  refs.footerState.textContent = label;
  const connected = status === 'connected';
  refs.messageInput.disabled = !connected || !state.user;
  refs.sendMessage.disabled = !connected || !state.user;
}

function errorMessage(message) {
  refs.chatError.textContent = message;
  refs.chatError.hidden = !message;
}

function hint(message) {
  refs.joinError.textContent = message || '';
  refs.joinButton.disabled = false;
  refs.joinButton.textContent = 'Войти в чат →';
}

function clearRegistrationTimer() {
  if (state.registrationTimer !== null) clearTimeout(state.registrationTimer);
  state.registrationTimer = null;
}

function clearReconnectTimer() {
  if (state.reconnectTimer !== null) clearTimeout(state.reconnectTimer);
  state.reconnectTimer = null;
}

function failRegistration(message) {
  clearRegistrationTimer();
  clearReconnectTimer();
  // Detach the old socket before closing it, so late replies cannot log us in.
  const socket = state.socket;
  state.socket = null;
  if (socket) socket.close();
  state.user = null;
  state.pendingName = '';
  state.attempt = 0;
  updateUsers([]);
  setStatus('disconnected', 'Вход не выполнен');
  showOverlay(refs.joinOverlay, true);
  hint(message);
  refs.nickname.focus();
}

function isValidUser(user) {
  return Boolean(user && typeof user === 'object' && !Array.isArray(user)
    && typeof user.name === 'string' && user.name.trim().length > 0
    && ((typeof user.id === 'string' && user.id.trim().length > 0)
      || Number.isFinite(user.id)));
}

function getValidUrl(value) {
  const url = value.trim();
  if (!/^wss?:\/\/[^\s/]+(?:\/[^\s]*)?$/i.test(url)) return null;
  try {
    const parsed = new URL(url);
    if (!['ws:', 'wss:'].includes(parsed.protocol)) return null;
    if (window.location.protocol === 'https:' && parsed.protocol !== 'wss:') return null;
    return parsed.toString();
  } catch { return null; }
}

function updateUsers(rawUsers) {
  const users = Array.isArray(rawUsers) ? rawUsers.filter((u) => u && typeof u.name === 'string') : [];
  refs.members.replaceChildren();
  refs.userTotal.textContent = String(users.length);
  refs.onlineCount.textContent = String(users.length);
  const n = users.length;
  const word = n % 10 === 1 && n % 100 !== 11 ? 'участник' : ((n % 10 >= 2 && n % 10 <= 4) && !(n % 100 >= 12 && n % 100 <= 14) ? 'участника' : 'участников');
  refs.participantsLabel.textContent = `${word} онлайн`;
  if (!users.length) {
    const empty = document.createElement('p');
    empty.className = 'members-empty';
    empty.textContent = 'Пока нет участников онлайн.';
    refs.members.append(empty);
    return;
  }
  for (const user of users) {
    const me = Boolean(state.user && user.id === state.user.id);
    const member = document.createElement('div');
    member.className = `member${me ? ' is-me' : ''}`;
    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.textContent = user.name.slice(0, 1).toLocaleUpperCase('ru');
    const details = document.createElement('div');
    details.className = 'member-details';
    const name = document.createElement('div');
    name.className = 'member-name';
    name.textContent = user.name;
    const sub = document.createElement('div');
    sub.className = 'member-status';
    sub.textContent = me ? 'You · это вы' : 'В сети';
    details.append(name, sub);
    const live = document.createElement('span');
    live.className = 'member-online-dot';
    member.append(avatar, details, live);
    refs.members.append(member);
  }
}

function addNotice(message) {
  const el = document.createElement('div');
  el.className = 'feed-notice';
  el.textContent = String(message);
  appendFeed(el);
}

function appendFeed(element) {
  if (refs.empty.isConnected) refs.empty.remove();
  refs.feed.append(element);
  // Keep a bounded number of DOM nodes without requiring server-side history.
  while (refs.feed.childElementCount > 250) refs.feed.firstElementChild.remove();
  refs.feed.scrollTop = refs.feed.scrollHeight;
}

function appendMessage(messageData) {
  if (typeof messageData.message !== 'string' || !messageData.user) return;
  const sender = messageData.user;
  const mine = Boolean(state.user && sender.id === state.user.id);
  const row = document.createElement('article');
  row.className = `message-row${mine ? ' mine' : ''}`;
  const avatar = document.createElement('span');
  avatar.className = 'message-avatar';
  avatar.textContent = String(sender.name || '?').slice(0, 1).toLocaleUpperCase('ru');
  const content = document.createElement('div');
  content.className = 'message-content';
  const meta = document.createElement('div');
  meta.className = 'message-meta';
  const author = document.createElement('span');
  author.className = 'message-author';
  author.textContent = mine ? 'You' : String(sender.name || 'Участник');
  const time = document.createElement('time');
  const date = new Date(Number(messageData.created) || Date.now());
  time.dateTime = date.toISOString();
  time.textContent = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  meta.append(author, time);
  const bubble = document.createElement('p');
  bubble.className = 'message-bubble';
  bubble.textContent = messageData.message; // Never render messages as HTML.
  content.append(meta, bubble);
  row.append(avatar, content);
  appendFeed(row);
}

function handleData(data) {
  if (!data || typeof data !== 'object') return;
  switch (data.type) {
    case 'registered': {
      if (state.registrationTimer === null || state.user) break;
      if (!isValidUser(data.user)) {
        failRegistration('Сервер вернул некорректные данные пользователя. Попробуйте снова.');
        break;
      }
      clearRegistrationTimer();
      state.user = data.user;
      state.pendingName = data.user.name;
      hint('');
      setStatus('connected', 'В сети');
      showOverlay(refs.joinOverlay, false);
      refs.messageInput.focus();
      errorMessage('');
      break;
    }
    case 'name_taken': {
      if (state.registrationTimer === null || state.user) break;
      clearRegistrationTimer();
      state.user = null;
      state.pendingName = '';
      showOverlay(refs.joinOverlay, true);
      hint(data.message || 'Этот никнейм занят. Выберите другой.');
      setStatus('disconnected', 'Выберите другой никнейм');
      refs.nickname.focus();
      break;
    }
    case 'users': updateUsers(data.users); break;
    case 'send': appendMessage(data); break;
    case 'notice': addNotice(data.message || ''); break;
    case 'error': {
      if (!state.user) failRegistration(data.message || 'Не удалось войти в чат.');
      else errorMessage(data.message || 'Ошибка сервера.');
      break;
    }
    default: break;
  }
}

function connect() {
  const url = getValidUrl(state.url);
  if (!url) {
    setStatus('disconnected', 'Требуется адрес сервера');
    hint('Укажите WebSocket-адрес в настройках подключения.');
    refs.joinButton.disabled = false;
    return;
  }
  if (state.socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(state.socket.readyState)) {
    if (state.socket.readyState === WebSocket.OPEN) submitRegistration();
    return;
  }
  clearReconnectTimer();
  state.closedIntentionally = false;
  setStatus('connecting', 'Подключаемся...');
  hint('');
  refs.joinButton.disabled = true;
  refs.joinButton.textContent = 'Подключаемся...';
  let socket;
  try { socket = new WebSocket(url); }
  catch { failRegistration('Не удалось создать WebSocket. Проверьте адрес сервера.'); return; }
  state.socket = socket;
  state.registrationTimer = setTimeout(() => {
    if (state.socket === socket) failRegistration('Сервер не установил соединение. Попробуйте снова.');
  }, REGISTRATION_TIMEOUT);

  socket.addEventListener('open', () => {
    if (state.socket !== socket) return;
    clearRegistrationTimer();
    state.attempt = 0;
    setStatus('connecting', 'Соединение установлено');
    submitRegistration();
  });
  socket.addEventListener('message', (event) => {
    if (state.socket !== socket) return;
    try { handleData(JSON.parse(event.data)); }
    catch {
      if (!state.user) failRegistration('Получен некорректный ответ сервера. Попробуйте снова.');
      else errorMessage('Получен некорректный ответ сервера.');
    }
  });
  socket.addEventListener('error', () => {
    if (state.socket === socket) setStatus('disconnected', 'Ошибка соединения');
  });
  socket.addEventListener('close', () => {
    if (state.socket !== socket) return;
    clearRegistrationTimer();
    state.socket = null;
    if (state.closedIntentionally) return;
    setStatus('disconnected', 'Связь потеряна');
    refs.joinButton.disabled = false;
    refs.joinButton.textContent = 'Войти в чат →';
    if (state.user) {
      addNotice('Соединение прервано. Пробуем подключиться снова…');
      state.pendingName = state.user.name;
      state.user = null;
    }
    if (state.pendingName) {
      state.attempt++;
      clearReconnectTimer();
      state.reconnectTimer = setTimeout(() => {
        state.reconnectTimer = null;
        connect();
      }, Math.min(3000 * state.attempt, 15000));
    } else {
      showOverlay(refs.joinOverlay, true);
      hint('Не удалось подключиться. Проверьте сервер и попробуйте снова.');
    }
  });
}

function submitRegistration() {
  if (!state.socket || state.socket.readyState !== WebSocket.OPEN
    || state.registrationTimer !== null || state.user) return;
  const name = state.pendingName.trim();
  if (name.length < 2 || name.length > 24) { hint('Никнейм должен содержать от 2 до 24 символов.'); return; }
  clearReconnectTimer();
  const socket = state.socket;
  refs.joinButton.disabled = true;
  refs.joinButton.textContent = 'Проверяем никнейм...';
  state.registrationTimer = setTimeout(() => {
    if (state.socket === socket) failRegistration('Сервер не ответил на запрос входа. Попробуйте снова.');
  }, REGISTRATION_TIMEOUT);
  try { socket.send(JSON.stringify({ type: 'register', name })); }
  catch { failRegistration('Не удалось отправить запрос входа. Попробуйте снова.'); }
}

refs.joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (state.registrationTimer !== null || state.user) return;
  const name = refs.nickname.value.trim();
  if (name.length < 2 || name.length > 24) { hint('Введите от 2 до 24 символов.'); return; }
  state.pendingName = name;
  if (state.socket?.readyState === WebSocket.OPEN) submitRegistration();
  else connect();
});

refs.messageForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const message = refs.messageInput.value.trim();
  if (!message) return;
  if (!state.user || state.socket?.readyState !== WebSocket.OPEN) {
    errorMessage('Соединение потеряно. Отправка пока недоступна.');
    return;
  }
  state.socket.send(JSON.stringify({ type: 'send', message, user: state.user }));
  refs.messageInput.value = '';
  errorMessage('');
  refs.messageInput.focus();
});

function openSettings() {
  refs.serverUrl.value = state.url || '';
  refs.settingsError.textContent = '';
  showOverlay(refs.settingsOverlay, true);
  refs.serverUrl.focus();
}

function closeSettings() {
  showOverlay(refs.settingsOverlay, false);
  if (!state.user && !refs.joinOverlay.hidden) refs.nickname.focus();
}

$('#open-settings').addEventListener('click', openSettings);
$('#join-config').addEventListener('click', openSettings);
$('#close-settings').addEventListener('click', closeSettings);
refs.settingsOverlay.addEventListener('click', (event) => {
  if (event.target === refs.settingsOverlay) closeSettings();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !refs.settingsOverlay.hidden) closeSettings();
});
refs.settingsForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const url = getValidUrl(refs.serverUrl.value);
  if (!url) {
    refs.settingsError.textContent = window.location.protocol === 'https:'
      ? 'Укажите защищённый адрес wss://.../ws.'
      : 'Введите адрес ws://.../ws или wss://.../ws.';
    return;
  }
  state.url = url;
  localStorage.setItem(STORAGE_KEY, url);
  state.closedIntentionally = true;
  clearRegistrationTimer();
  clearReconnectTimer();
  const socket = state.socket;
  state.socket = null;
  if (socket) socket.close();
  state.user = null;
  state.pendingName = '';
  state.attempt = 0;
  refs.feed.replaceChildren(refs.empty);
  refs.feed.scrollTop = 0;
  refs.messageInput.value = '';
  errorMessage('');
  refs.nickname.value = '';
  refs.joinButton.disabled = false;
  refs.joinButton.textContent = 'Войти в чат →';
  updateUsers([]);
  setStatus('disconnected', 'Готово к подключению');
  showOverlay(refs.settingsOverlay, false);
  showOverlay(refs.joinOverlay, true);
  hint('Адрес сохранён. Введите никнейм и подключитесь.');
  refs.nickname.focus();
});

setStatus('disconnected', state.url ? 'Ожидание входа' : 'Настройте сервер');
updateUsers([]);
refs.nickname.focus();
window.addEventListener('beforeunload', () => {
  state.closedIntentionally = true;
  clearRegistrationTimer();
  clearReconnectTimer();
  if (state.socket) state.socket.close();
});
