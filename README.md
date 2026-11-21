# Pulse Chat — WebSockets / Нетология

[![Deploy to GitHub Pages](https://github.com/EvgeniyaAndreevna/websocket-chat-homework/actions/workflows/deploy.yml/badge.svg)](https://github.com/EvgeniyaAndreevna/websocket-chat-homework/actions/workflows/deploy.yml)

**GitHub Pages (после публикации):** https://evgeniyaandreevna.github.io/websocket-chat-homework/

> Это заранее подготовленные адреса для будущего репозитория `EvgeniyaAndreevna/websocket-chat-homework`. Если репозиторий будет называться иначе, замените обе ссылки и бейдж.

Домашняя работа № 8 «EventSource, WebSockets». Реализована **обязательная задача «Чат»**. Необязательный Cloud Dashboard не входит в проект.

## Возможности

- При открытии страницы появляется окно ввода никнейма.
- Сервер проверяет уникальность имени среди подключённых пользователей (без учёта регистра). Если имя занято, показывается ошибка и можно ввести другое.
- Все сообщения отправляются и получаются через **нативный WebSocket API** браузера.
- Свои сообщения расположены справа и подписаны **You**, чужие — слева и с именем автора.
- Список участников обновляется при входе и выходе людей. При закрытии вкладки пользователь исчезает из списка.
- Есть статусы соединения, уведомления о подключении/отключении, автоматическое переподключение и экран для настройки адреса сервера.
- Frontend собирается **Webpack**, включая CSS и изображения SVG. GitHub Actions выкладывает сборку на GitHub Pages.
- Backend можно запустить на своём компьютере и развернуть на Render.

## Важное уточнение об исходном backend

По условию Нетологии указан [готовый backend](https://github.com/netology-code/ahj-homeworks/tree/AHJ-50/sse-ws/chat/backend). В момент подготовки проекта его файлы не удалось получить через доступные инструменты. **Поэтому в папку `backend/` включён самостоятельный сервер**, удовлетворяющий описанному в задании поведению и примеру сообщения `type: "send"`. Это рабочая связка с клиентом из данного архива, но протокол оригинального backend Нетологии **не был проверен на точное соответствие**. Для сдачи разрешён собственный рабочий backend, если проверяющий оценивает функциональность; если требуется строго готовый сервер Нетологии, сравните форматы событий перед заменой сервера.

## Структура проекта

```text
websocket-chat-homework/
├── .github/workflows/deploy.yml  # GitHub Actions → Pages
├── backend/server.cjs             # HTTP + WebSocket сервер
├── src/
│   ├── assets/                   # SVG-изображения
│   ├── app.js                    # логика чата
│   ├── index.html                # интерфейс
│   └── styles.css                # стили
├── webpack.config.cjs            # сборка Webpack
├── render.yaml                   # опциональная конфигурация Render
├── package.json
├── .gitignore
└── README.md
```

## Запуск локально (Windows / PowerShell)

Установите Node.js 20+ и откройте папку проекта в VS Code. Встроенный PowerShell иногда блокирует `npm.ps1`, поэтому используйте команды с **`npm.cmd`**.

Первый терминал:

```powershell
npm.cmd install
npm.cmd run server
```

Сервер работает на `http://127.0.0.1:7071`, WebSocket — на `ws://127.0.0.1:7071/ws`, проверка доступности — `http://127.0.0.1:7071/health`.

Второй терминал (из той же папки):

```powershell
npm.cmd start
```

Откройте http://localhost:8080. При первом открытии появится окно ввода никнейма.

Если порт `7071` занят, в **первом** терминале задайте другой порт перед запуском:

```powershell
$env:PORT = 7072
npm.cmd run server
```

В чате нажмите кнопку настроек (шестерёнка) и укажите `ws://127.0.0.1:7072/ws`. Настройка сохраняется в браузере.

### Проверка в двух окнах

1. Откройте `localhost:8080` в обычном окне и войдите как `Alex`.
2. Откройте его в режиме инкогнито и войдите как `Maria`.
3. Убедитесь, что оба пользователя видны слева; сообщения `Alex` находятся справа в первом окне и слева во втором.
4. В третьей вкладке попробуйте войти как `Alex`: должно появиться сообщение о занятом никнейме.
5. Закройте вкладку `Maria`: её имя должно исчезнуть из списка остальных участников.

> История сообщений не сохраняется в базе данных и после перезапуска сервера не восстанавливается. По условиям этого задания постоянное хранение переписки не требуется.

## Публикация backend на Render

В соответствии с [документацией Render](https://render.com/docs/deploy-node-express-app) и [WebSockets on Render](https://render.com/docs/websocket) публикуйте именно *Web Service*, не *Static Site*.

1. Загрузите проект на GitHub в публичный репозиторий, например `EvgeniyaAndreevna/websocket-chat-homework`.
2. Откройте [Render Dashboard](https://dashboard.render.com/), нажмите **New → Web Service**.
3. Подключите GitHub-репозиторий, установите Runtime `Node`, Branch `main`.
4. **Root Directory:** оставьте пустым (проект и `package.json` лежат в корне).
5. **Build Command:** `npm install --no-audit --no-fund`.
6. **Start Command:** `npm run server`.
7. **Health Check Path:** `/health` (если интерфейс Render предлагает поле).
8. Разверните Web Service и проверьте ссылку вида `https://<имя>.onrender.com/health`: ожидается JSON со статусом `ok`.
9. Адрес для чата будет **`wss://<имя>.onrender.com/ws`**. Обратите внимание на `wss` и `/ws`.

`render.yaml` также содержит пример конфигурации для Render Blueprint. Render автоматически задаёт переменную `PORT`; сервер берёт её из окружения. Доступные тарифы и время запуска зависят от вашего аккаунта.

Если Render недоступен из вашего региона, условие домашнего задания позволяет пропустить этот шаг, но без публичного WebSocket-сервера опубликованный чат не сможет обмениваться сообщениями между разными пользователями.

## GitHub Pages + GitHub Actions

1. Создайте **пустой публичный** репозиторий с именем `websocket-chat-homework`.
2. Из терминала VS Code в папке проекта выполните:

   ```powershell
   git init
   git add .
   git commit -m "Initial commit: WebSocket chat"
   git branch -M main
   git remote add origin https://github.com/EvgeniyaAndreevna/websocket-chat-homework.git
   git push -u origin main
   ```

3. В GitHub откройте **Settings → Pages → Build and deployment → Source → GitHub Actions**.
4. В разделе **Settings → Secrets and variables → Actions → Variables** добавьте переменную репозитория `WS_URL` со значением `wss://<имя>.onrender.com/ws`. **Не** добавляйте сюда адрес `localhost`.
5. Если переменную добавили после первого деплоя, откройте **Actions → Deploy to GitHub Pages → Run workflow**, чтобы пересобрать сайт с актуальным адресом.
6. Дождитесь зелёной галочки workflow. Проверьте адрес Pages из шапки этого README.
7. Если Render ещё не настроен, на опубликованной странице можно вручную указать `wss://` через шестерёнку. Адрес запомнится на этом компьютере.

Сборка выполняется командой `npm run build`; результат кладётся в `dist/`. CSS, SVG и JavaScript собираются средствами Webpack. `dist/` и `node_modules/` в Git не добавляются.

**Важное правило:** страница GitHub Pages открывается по HTTPS, поэтому браузер разрешит подключиться только к защищённому **`wss://`**, а не `ws://`.

## Протокол нашего WebSocket-сервера

Endpoint: `ws://127.0.0.1:7071/ws` (локально) или `wss://<сервис>.onrender.com/ws` (Render).

| Направление | Тип события | Формат |
|---|---|---|
| Клиент → сервер | `register` | `{ "type": "register", "name": "Alex" }` |
| Сервер → клиент | `registered` | `{ "type": "registered", "user": { "id": "uuid", "name": "Alex" } }` |
| Сервер → клиент | `name_taken` | `{ "type": "name_taken", "message": "..." }` |
| Сервер → всем | `users` | `{ "type": "users", "users": [{ "id": "uuid", "name": "Alex" }] }` |
| Клиент → сервер | `send` | `{ "type": "send", "message": "Привет", "user": { "id": "uuid", "name": "Alex" } }` |
| Сервер → всем | `send` | `{ "type": "send", "message": "Привет", "user": { "id": "uuid", "name": "Alex" }, "created": 1790000000000 }` |
| Сервер → всем | `notice` | `{ "type": "notice", "message": "Alex присоединился к чату", "created": 1790000000000 }` |
| Сервер → клиент | `error` | `{ "type": "error", "message": "..." }` |

Сервер не доверяет полю `user`, присланному клиентом при отправке: автор сообщения определяется по уже зарегистрированному WebSocket-соединению. После закрытия соединения сервер удаляет пользователя и отправляет свежий список другим участникам.

## Проверка готовности к сдаче

- [ ] Чат работает локально в двух браузерных окнах.
- [ ] Никнейм проверяется на уникальность.
- [ ] Сообщения отображаются слева / справа в зависимости от автора.
- [ ] При закрытии вкладки участник исчезает из списка.
- [ ] Фронтенд опубликован через GitHub Actions на GitHub Pages.
- [ ] README содержит бейдж сборки и рабочую ссылку Pages.
- [ ] Backend размещён на Render или этот пункт пропущен по разрешению преподавателя.

**Проверяющему:** ссылка на GitHub-репозиторий и ссылка на опубликованный GitHub Pages из шапки README.
