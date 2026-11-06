/* ============================================================
   Таро Шоколад — приложение
   Работает без сервера и без ИИ: случайная колода + готовые тексты.
   ============================================================ */
(function () {
  'use strict';

  const T = window.TAROT || {};
  const CARDS = T.cards || [];
  const SPREADS = T.spreads || [];
  const SPREAD_BY_ID = T.spreadById || {};
  const MATRIX = T.matrixArcana || [];
  const MATRIX_BY_NUM = Object.fromEntries(MATRIX.map((a) => [a.arcana, a]));
  const MATRIX_POINTS = T.matrixPoints || {};
  const UI = T.ui || {};
  const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

  const HISTORY_KEY = 'taro-chocolate:history:v1';
  const PROFILE_KEY = 'taro-chocolate:profile:v1';

  const app = document.getElementById('app');
  const modalRoot = document.getElementById('modalRoot');
  const toastRoot = document.getElementById('toastRoot');

  const state = {
    catalogQuery: '',
    catalogGroup: 'all',
    reading: null,
    matrix: null,
    matrixDate: '',
    matrixName: '',
    replay: null,
  };

  let shuffleTimer = null;
  let revealTimer = null;
  let lastModalTrigger = null;
  let confirmResolve = null;

  /* ============================================================
     Утилиты
     ============================================================ */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const escapeHtml = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  const shuffle = (list) => {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  const roman = (n) => {
    const map = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
    return map[n] ?? String(n);
  };

  const rankIndex = (card) => {
    if (card.arcana === 'major') return roman(card.number);
    if (card.rank <= 10) return roman(card.rank);
    return { 11: 'П', 12: 'Р', 13: 'К', 14: 'К' }[card.rank] || '·';
  };

  const cardSub = (card) => (card.arcana === 'major' ? 'Старший аркан' : card.suitName || '');

  const cardMeta = (card) => {
    if (card.arcana === 'major') return `Старший аркан ${card.number === 0 ? '0' : roman(card.number)}`;
    const suit = card.suitName || '';
    return `${suit} · ${card.rankName || ''}`;
  };

  const sideOf = (card, reversed) => card[reversed ? 'reversed' : 'upright'];

  const invertAnswer = {
    'да': 'скорее да',
    'скорее да': 'неоднозначно',
    'неоднозначно': 'неоднозначно',
    'скорее нет': 'нет',
    'нет': 'нет',
  };

  const effectiveAnswer = (card, reversed) => {
    const base = card.yes_no?.answer || 'неоднозначно';
    return reversed ? invertAnswer[base] || base : base;
  };

  const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  const dateFromInput = (value) => {
    if (!value) return null;
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return null;
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
    return date;
  };

  const formatDate = (date) =>
    new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);

  const formatDateTime = (iso) => {
    try {
      return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
    } catch {
      return '';
    }
  };

  const localISO = (date = new Date()) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };

  const hashCode = (str) => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  const dailyCard = () => {
    const key = localISO();
    const hash = hashCode(key);
    const card = CARDS[hash % CARDS.length];
    const reversed = ((hash >> 7) % 100) < 32;
    return { card, reversed };
  };

  const toast = (message) => {
    if (!toastRoot) return;
    const node = document.createElement('div');
    node.className = 'toast';
    node.textContent = message;
    toastRoot.appendChild(node);
    window.setTimeout(() => node.remove(), 3200);
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        area.remove();
        return ok;
      } catch {
        return false;
      }
    }
  };

  /* ============================================================
     Иконки
     ============================================================ */
  const ICONS = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/><path d="M17 3l.7 2.3L20 6l-2.3.7L17 9l-.7-2.3L14 6l2.3-.7z"/>',
    star: '<path d="M12 3l2.3 6.2L20 12l-5.7 2.8L12 21l-2.3-6.2L4 12l5.7-2.8z"/>',
    heart: '<path d="M20.8 5.9a5 5 0 0 0-7.1 0L12 7.6l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21l8.8-8a5 5 0 0 0 0-7.1z"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.5 9.5h4a2 2 0 0 1 0 4h-4"/><path d="M12 3.5v1M12 19.5v1"/>',
    key: '<circle cx="8" cy="8" r="4"/><path d="M11 11l9 9M17 17l2-2M15 15l2-2"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/><path d="M12 3v2M12 19v2"/>',
    path: '<path d="M5 21c0-4 5-4 5-8s-3-4-3-8"/><path d="M14 3c0 4 5 5 5 9s-4 4-4 9"/><path d="M4 3h6M14 21h6"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z"/>',
    scales: '<path d="M12 4v16M8 20h8M6 8h12M6 8l-3 6h6zM18 8l-3 6h6z"/><circle cx="12" cy="4" r="1.5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M16 16l4 4"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 6.3M20 5v6h-6"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h8V4M8 20v-6h8v6"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.3 10.9l7.4-3.8M8.3 13.1l7.4 3.8"/>',
    shield: '<path d="M12 3l7 2v6c0 5-3 8-7 10-4-2-7-5-7-10V5z"/><path d="M9 12l2 2 4-4"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
    question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 1 1 3.7 2.4c-.8.4-1.2 1-1.2 2M12 17h.01"/>',
  };

  const icon = (name, cls = '') =>
    `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.spark}</svg>`;

  /* ============================================================
     Карты
     ============================================================ */
  const BACK_SUN = `
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="50" cy="50" r="17" stroke="currentColor" stroke-width="1.2"/>
      <circle cx="50" cy="50" r="25" stroke="currentColor" stroke-width=".8" stroke-dasharray="1 4" opacity=".8"/>
      ${Array.from({ length: 16 }).map((_, i) => {
        const a = (Math.PI * 2 * i) / 16;
        const r1 = i % 2 ? 30 : 33;
        const r2 = i % 2 ? 37 : 41;
        return `<path d="M${(50 + Math.cos(a) * r1).toFixed(1)} ${(50 + Math.sin(a) * r1).toFixed(1)}L${(50 + Math.cos(a) * r2).toFixed(1)} ${(50 + Math.sin(a) * r2).toFixed(1)}" stroke="currentColor" stroke-width="1" opacity="${i % 2 ? 0.5 : 0.9}"/>`;
      }).join('')}
      <path d="M50 38l3.2 8.8L62 50l-8.8 3.2L50 62l-3.2-8.8L38 50l8.8-3.2z" fill="currentColor" opacity=".8"/>
      <circle cx="50" cy="50" r="3" fill="currentColor"/>
    </svg>`;

  const BACK_FRAME = `<span class="back-frame"><span class="back-sun">${BACK_SUN}</span><span class="back-brand">ТШ</span></span>`;

  function cardEl(card, options = {}) {
    const {
      reversed = false,
      faceDown = false,
      tag = 'button',
      extraClass = '',
      attrs = '',
      style = '',
    } = options;
    if (!card) return '';
    const classes = [
      'tarot-card',
      `card-arcana-${card.arcana}`,
      card.suit ? `card-suit-${card.suit}` : '',
      reversed ? 'is-reversed' : '',
      faceDown ? '' : 'is-revealed',
      tag !== 'button' ? 'is-static' : '',
      extraClass,
    ].filter(Boolean).join(' ');
    const aria = faceDown ? 'Закрытая карта расклада' : `${card.name}${reversed ? ', перевёрнутая' : ''}`;
    const buttonAttrs = tag === 'button' ? 'type="button"' : '';
    return `<${tag} class="${classes}" ${buttonAttrs} ${style ? `style="${style}"` : ''} ${attrs} aria-label="${escapeHtml(aria)}">
      <span class="card-inner">
        <span class="card-face card-front">
          <span class="front-rotor">
            <span class="card-corner tl">${rankIndex(card)}</span>
            <span class="card-art">${T.cardArt ? T.cardArt(card) : ''}</span>
            <span class="card-name">${escapeHtml(card.name)}</span>
            <span class="card-sub">${escapeHtml(cardSub(card))}</span>
            <span class="card-corner br">${rankIndex(card)}</span>
          </span>
        </span>
        <span class="card-face card-back">${BACK_FRAME}</span>
      </span>
    </${tag}>`;
  }

  const cardBack = (cls = '') =>
    `<div class="tarot-card is-static is-back ${cls}" aria-hidden="true"><span class="card-inner"><span class="card-face card-back">${BACK_FRAME}</span></span></div>`;

  /* ============================================================
     Хранилище
     ============================================================ */
  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* приватный режим или переполнение — молча продолжаем */
    }
  }

  const getHistory = () => {
    const list = readJSON(HISTORY_KEY, []);
    return Array.isArray(list) ? list : [];
  };

  const getProfile = () => readJSON(PROFILE_KEY, {}) || {};

  const saveProfile = (name, birthDate) => {
    if (!name && !birthDate) return;
    writeJSON(PROFILE_KEY, { name: name || '', birthDate: birthDate || '' });
  };

  function saveReadingToHistory(reading) {
    if (!reading || reading.saved) return;
    const list = getHistory();
    const entry = {
      id: reading.id,
      createdAt: reading.createdAt,
      spreadId: reading.spreadId,
      spreadTitle: SPREAD_BY_ID[reading.spreadId]?.title || 'Расклад',
      name: reading.name,
      birthDate: reading.birthDate,
      question: reading.question,
      cards: reading.cards.map((c) => ({ id: c.card.id, reversed: c.reversed })),
      summary: reading.summary || [],
    };
    const next = [entry, ...list.filter((item) => item.id !== entry.id)].slice(0, 40);
    writeJSON(HISTORY_KEY, next);
    reading.saved = true;
  }

  function deleteHistoryEntry(id) {
    writeJSON(HISTORY_KEY, getHistory().filter((entry) => entry.id !== id));
  }

  /* ============================================================
     Маршрутизация
     ============================================================ */
  function navigate(path) {
    if (`#${path}` === location.hash) renderRoute();
    else location.hash = path;
  }

  function parseRoute() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [pathPart, anchor] = raw.split('#');
    const path = pathPart || '/';
    return { path, anchor, parts: path.split('/').filter(Boolean) };
  }

  function renderRoute() {
    clearTimeout(shuffleTimer);
    clearTimeout(revealTimer);
    closeModal(false);
    const { path, anchor, parts } = parseRoute();
    const route = parts[0] || 'home';

    if (route === 'home') renderHome();
    else if (route === 'spreads') renderSpreads();
    else if (route === 'spread' && parts[1]) renderReading(parts[1]);
    else if (route === 'cards') renderCards();
    else if (route === 'matrix') renderMatrix();
    else if (route === 'history' && parts[1]) renderHistoryEntry(parts[1]);
    else if (route === 'history') renderHistory();
    else if (route === 'about') renderAbout();
    else render404();

    updateNav(route, parts[1]);

    if (anchor) {
      window.requestAnimationFrame(() => {
        const target = document.getElementById(anchor);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else window.scrollTo({ top: 0, behavior: 'auto' });
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }

  function updateNav(route, param) {
    const key =
      route === 'spread' ? 'spreads' :
      route === 'spreads' ? 'spreads' :
      route === 'cards' ? 'cards' :
      route === 'matrix' ? 'matrix' :
      route === 'history' ? 'history' :
      route === 'about' ? 'about' : '';
    $$('.site-nav a').forEach((link) => {
      const active = link.dataset.nav === key;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    closeMobileNav();
    window.requestAnimationFrame(() => app.focus({ preventScroll: true }));
  }

  /* ============================================================
     Главная
     ============================================================ */
  const HOME_FEATURED = ['day', 'love', 'money', 'big', 'yesno', 'quick'];

  function spreadTile(spread, extra = '') {
    return `<a class="spread-tile ${extra}" href="#/spread/${spread.id}">
      <div class="spread-tile-top">
        <span class="spread-icon">${icon(spread.icon)}</span>
        <span class="spread-count">${spread.count} ${spread.count === 1 ? 'карта' : spread.count < 5 ? 'карты' : 'карт'}</span>
      </div>
      <h3>${spread.title}</h3>
      <p>${spread.short}</p>
      <div class="spread-tile-foot"><span>Разложить</span>${icon('arrow')}</div>
    </a>`;
  }

  function sectionHead(eyebrow, title, sub, link) {
    return `<div class="section-head">
      <div class="section-title-group">
        <span class="eyebrow">${eyebrow}</span>
        <h2>${title}</h2>
        ${sub ? `<p class="section-sub">${sub}</p>` : ''}
      </div>
      ${link || ''}
    </div>`;
  }

  function renderHome() {
    document.title = 'Таро Шоколад — тёплые расклады, значения карт и Матрица судьбы';
    const daily = dailyCard();
    const heroCards = ['the_empress', 'the_star', 'the_moon'].map((id) => CARD_BY_ID[id]).filter(Boolean);

    app.innerHTML = `
      <section class="hero">
        <div class="wrap hero-inner">
          <div class="hero-copy">
            <span class="eyebrow">Таро без ИИ · бережная рефлексия</span>
            <h1><span class="line">Тёплое</span> <span class="line"><em>таро</em></span> <span class="line">на каждый день</span></h1>
            <p class="hero-lead">78 карт, 11 раскладов и Матрица судьбы. Колода честно перемешивается, а тексты помогают услышать себя — без искусственного интеллекта и без обещаний изменить судьбу.</p>
            <div class="hero-cta">
              <a class="btn btn-primary btn-lg" href="#/spread/day">${icon('spark')}Вытянуть карту дня</a>
              <a class="btn btn-ghost btn-lg" href="#/spreads">Все расклады</a>
            </div>
            <div class="hero-meta">
              <span>78 карт Райдера–Уэйта</span>
              <span>Перевёрнутые значения</span>
              <span>Всё остаётся в браузере</span>
            </div>
          </div>
          <div class="hero-deck" aria-label="Колода Таро Шоколад">
            <div class="hero-deck-glow" aria-hidden="true"></div>
            <div class="hero-deck-ring" aria-hidden="true"></div>
            ${heroCards.map((card) => cardEl(card, { attrs: `data-card-open="${card.id}"` })).join('')}
            <div class="hero-deck-note">78 карт · 11 раскладов · матрица</div>
          </div>
        </div>
      </section>

      <div class="stats">
        <div class="stats-inner">
          <div class="stat"><span class="stat-num">78</span><span class="stat-label">карт в колоде</span></div>
          <div class="stat"><span class="stat-num">11</span><span class="stat-label">раскладов</span></div>
          <div class="stat"><span class="stat-num">22</span><span class="stat-label">аркана матрицы</span></div>
          <div class="stat"><span class="stat-num">0</span><span class="stat-label">искусственного интеллекта</span></div>
        </div>
      </div>

      <section class="section">
        <div class="wrap">
          ${sectionHead('Что можно разложить', 'Расклады на <em>любой</em> вопрос', 'От короткой карты дня до большого расклада на семь карт. Выберите тему — остальное сделает колода.', `<a class="link-arrow" href="#/spreads">Все расклады ${icon('arrow')}</a>`)}
          <div class="spread-grid">
            ${HOME_FEATURED.map((id) => SPREAD_BY_ID[id]).filter(Boolean).map((s) => spreadTile(s)).join('')}
          </div>
        </div>
      </section>

      <section class="section-tight">
        <div class="wrap">
          <div class="daily-panel">
            <div class="daily-card-wrap">
              ${cardEl(daily.card, { reversed: daily.reversed, attrs: `data-card-open="${daily.card.id}" data-reversed="${daily.reversed}"` })}
            </div>
            <div class="daily-content">
              <span class="eyebrow">Карта дня · ${formatDate(new Date())}</span>
              <h2>${daily.reversed ? '<em>Перевёрнутая</em>' : '<em>Прямая</em>'} ${escapeHtml(daily.card.name)}</h2>
              <p>${escapeHtml(daily.reversed ? daily.card.reversed.short : daily.card.upright.short)}</p>
              <div class="daily-chips">
                <span class="chip"><span class="dot"></span>${daily.reversed ? 'энергия развёрнута внутрь' : 'энергия дня'}</span>
                <span class="chip">${escapeHtml(daily.card.keywords[0])}</span>
                <span class="chip">${escapeHtml(daily.card.keywords[1])}</span>
              </div>
              <div class="hero-cta">
                <button class="btn btn-primary" type="button" data-card-open="${daily.card.id}" data-reversed="${daily.reversed}">${icon('search')}Смотреть значение</button>
                <a class="link-arrow" href="#/spread/day">Сделать полный расклад ${icon('arrow')}</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          ${sectionHead('Как это работает', 'Три шага — и можно <em>слушать</em>', 'Никакой регистрации, оплаты и «магических» обещаний. Только карты, тишина и ваши вопросы.')}
          <div class="steps">
            <div class="step"><span class="step-num">01</span><h3>Выберите расклад</h3><p>Карта дня, отношения, деньги, работа, выбор или большой расклад. В каждом — свои позиции и свои вопросы.</p></div>
            <div class="step"><span class="step-num">02</span><h3>Перемешайте колоду</h3><p>Можно добавить имя, дату рождения и вопрос. Колода из 78 карт перемешается случайным образом — так же, как в руках таролога.</p></div>
            <div class="step"><span class="step-num">03</span><h3>Откройте карты</h3><p>Каждая карта переворачивается и получает трактовку в своей позиции. Сложите смыслы в историю и заберите то, что откликается.</p></div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="philosophy">
            <div>
              <span class="eyebrow">Наша позиция</span>
              <h2>Магия без <em>ИИ</em> и без давления</h2>
              <p>«Таро Шоколад» — статичный сайт. Здесь нет искусственного интеллекта, который «анализирует» вашу ситуацию, и нет попытки предсказать будущее. Есть 78 карт, закреплённые значения, случайная выборка и ваша собственная работа с вопросом.</p>
              <p style="margin-top:14px">Мы считаем, что честнее сказать «вот образ, подумайте, как он откликается», чем обещать точный ответ на всё.</p>
            </div>
            <div class="philosophy-list">
              ${UI.principles.map((p) => `<div class="philosophy-item">${icon('check')}<div><h4>${p.title}</h4><p>${p.text}</p></div></div>`).join('')}
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="matrix-teaser">
            <div>
              <span class="eyebrow">Нумерология даты рождения</span>
              <h2>Матрица <em>судьбы</em></h2>
              <p>Введите полную дату рождения — и получите 22 аркана как карту тем: характер, эмоции, род, любовь, деньги, кармический хвост и возрастные точки. Без фатализма: только потенциал и вопросы для размышления.</p>
              <a class="btn btn-primary" href="#/matrix">${icon('compass')}Рассчитать матрицу</a>
            </div>
            <div class="matrix-teaser-figure" aria-hidden="true">${matrixHeroArt()}</div>
          </div>
        </div>
      </section>
    `;
  }

  /* ============================================================
     Расклады: список
     ============================================================ */
  function renderSpreads() {
    document.title = 'Расклады — Таро Шоколад';
    app.innerHTML = `
      <section class="page-head">
        <div class="wrap">
          <div class="breadcrumbs"><a href="#/">Главная</a><span class="sep">/</span><span>Расклады</span></div>
          <span class="eyebrow">Колода из 78 карт</span>
          <h1 class="page-title">Выберите <em>расклад</em></h1>
          <p class="page-sub">Каждая тема — это свой набор позиций и своя логика чтения. Если не знаете, с чего начать, возьмите карту дня или быстрый расклад на три карты.</p>
        </div>
      </section>
      <section class="section">
        <div class="wrap">
          ${T.groups.map((group) => {
            const list = SPREADS.filter((s) => s.group === group.id);
            if (!list.length) return '';
            return `<div class="spread-group">
              <div class="spread-group-head"><h2>${group.title}</h2><span>${group.note}</span></div>
              <div class="spread-grid">${list.map((s) => spreadTile(s)).join('')}</div>
            </div>`;
          }).join('')}
        </div>
      </section>
    `;
  }

  /* ============================================================
     Расклад: форма и сцена
     ============================================================ */
  function renderReading(spreadId) {
    const spread = SPREAD_BY_ID[spreadId];
    if (!spread) return render404();
    document.title = `${spread.title} — Таро Шоколад`;

    const profile = getProfile();
    const replay = state.replay;
    const prefill = replay || profile;
    state.reading = null;
    state.replay = null;

    const positions = spread.positions;
    const countMap = { 1: '1 карта', 3: '3 карты', 5: '5 карт', 7: '7 карт' };

    app.innerHTML = `
      <section class="page-head">
        <div class="wrap">
          <div class="breadcrumbs"><a href="#/">Главная</a><span class="sep">/</span><a href="#/spreads">Расклады</a><span class="sep">/</span><span>${spread.title}</span></div>
          <span class="eyebrow">${icon(spread.icon)} ${T.groups.find((g) => g.id === spread.group)?.title || 'Расклад'}</span>
          <h1 class="page-title">${spread.title}</h1>
          <p class="page-sub">${spread.description}</p>
        </div>
      </section>

      <div class="wrap reading-shell">
        <div class="reading-layout">
          <aside class="reading-aside">
            <form class="reading-form" id="readingForm" novalidate>
              <h2>Настройте расклад</h2>
              <p>Достаточно одного намерения. Остальное можно оставить пустым.</p>
              <div class="field">
                <label for="readingName">Имя <span class="optional">необязательно</span></label>
                <input id="readingName" name="name" type="text" maxlength="40" placeholder="Как к вам обращаться" value="${escapeHtml(prefill.name || '')}" autocomplete="given-name">
              </div>
              <div class="field">
                <label for="readingDate">Дата рождения <span class="optional">необязательно</span></label>
                <input id="readingDate" name="birthDate" type="date" min="1900-01-01" max="${localISO()}" value="${escapeHtml(prefill.birthDate || '')}">
                <p class="hint">Нужна только для личного аркана. Никуда не отправляется.</p>
              </div>
              <div class="field">
                <label for="readingQuestion">Вопрос <span class="optional">необязательно</span></label>
                <textarea id="readingQuestion" name="question" maxlength="180" placeholder="${escapeHtml(spread.question)}">${escapeHtml(prefill.question || '')}</textarea>
                <p class="hint">Лучше про себя: «Что мне важно понять?», а не «Что он сделает?».</p>
              </div>
              <div class="form-note">${icon('shield')}<span>Расклад развлекательный и рефлексивный. Карты не заменяют консультацию специалиста и не гарантируют событий.</span></div>
              <button class="btn btn-primary btn-block" type="submit">${icon('spark')}Перемешать колоду</button>
            </form>
          </aside>

          <div class="reading-main">
            <div class="reading-title-bar">
              <div>
                <h2 style="font-size:clamp(28px,3vw,38px)">${positions.length > 1 ? 'Расклад готов к раздаче' : 'Одна карта — один вопрос'}</h2>
                <p>${positions.map((p) => p.title).join(' · ')}</p>
              </div>
              <span class="reading-badge">${countMap[spread.count] || `${spread.count} карт`}</span>
            </div>
            <div id="readingStage">
              <div class="empty-state reading-empty">
                <h3>Колода ждёт вашего вопроса</h3>
                <p>Заполните поля слева или просто нажмите «Перемешать колоду». Все карты будут лежать рубашкой вверх — открывать их можно по одной.</p>
                <div class="reading-empty-cards" aria-hidden="true">
                  ${cardBack()}
                  ${cardBack()}
                  ${cardBack()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const form = $('#readingForm');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = $('#readingName').value.trim();
      const birthDate = $('#readingDate').value;
      const question = $('#readingQuestion').value.trim();
      if (birthDate && !dateFromInput(birthDate)) {
        toast('Проверьте дату рождения');
        return;
      }
      saveProfile(name, birthDate);
      const values = { name, birthDate, question: question || spread.question };
      state.lastValues = values;
      startReading(spread, values);
    });
  }

  function startReading(spread, values, options = {}) {
    clearTimeout(shuffleTimer);
    clearTimeout(revealTimer);
    const stage = $('#readingStage');
    if (!stage) return;

    const useDaily = spread.id === 'day' && options.daily !== false;
    const drawn = useDaily
      ? (() => {
        const daily = dailyCard();
        return [{ card: daily.card, reversed: daily.reversed, revealed: false }];
      })()
      : shuffle(CARDS).slice(0, spread.count).map((card) => ({
        card,
        reversed: Math.random() < 0.36,
        revealed: false,
      }));

    const reading = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      spreadId: spread.id,
      name: values.name,
      birthDate: values.birthDate,
      question: values.question,
      cards: drawn,
      summary: [],
      closing: pick(T.closingLines || ['']),
      saved: false,
    };
    state.reading = reading;
    state.lastValues = values;

    stage.innerHTML = `
      <div class="shuffle-stage" id="shuffleStage">
        <div class="shuffle-deck is-shuffling" id="shuffleDeck">
          ${[0, 1, 2, 3, 4].map(() => cardBack()).join('')}
        </div>
        <div class="shuffle-caption">
          <strong>Колода перемешивается</strong>
          ${escapeHtml(spread.title)} · ${spread.count} ${spread.count === 1 ? 'карта' : spread.count < 5 ? 'карты' : 'карт'}
        </div>
      </div>`;

    shuffleTimer = window.setTimeout(() => {
      renderBoard(spread, reading);
    }, 1250);
  }

  function renderBoard(spread, reading) {
    const stage = $('#readingStage');
    if (!stage || state.reading !== reading) return;
    const positions = spread.positions;
    const countClass = `count-${positions.length}`;

    stage.innerHTML = `
      <div class="spread-board ${countClass}" id="spreadBoard" data-count="${positions.length}">
        ${positions.map((pos, i) => {
          const item = reading.cards[i];
          return `<div class="spread-slot" data-slot="${i}" style="--slot-i:${i}">
            <div class="slot-head">
              <span class="slot-index">${String(i + 1).padStart(2, '0')}</span>
              <span class="slot-title">${pos.title}</span>
            </div>
            ${cardEl(item.card, {
              faceDown: true,
              reversed: item.reversed,
              extraClass: 'is-dealt',
              style: `animation-delay:${i * 90}ms`,
              attrs: `data-index="${i}"`,
            })}
            <span class="slot-hint">${pos.hint}</span>
          </div>`;
        }).join('')}
      </div>
      <div class="board-toolbar">
        <div class="board-hint"><span class="pulse"></span><span id="revealCount" aria-live="polite">Открыто 0 из ${positions.length} · нажмите на карту</span></div>
        <div class="board-actions">
          <button class="btn btn-soft btn-sm" type="button" id="revealAll">${icon('spark')}Открыть все</button>
          <button class="btn btn-ghost btn-sm" type="button" id="shuffleAgain">${icon('refresh')}Перемешать заново</button>
        </div>
      </div>
      <div class="reading-result" id="readingResult"></div>
    `;

    const board = $('#spreadBoard');
    board.addEventListener('click', (event) => {
      const el = event.target.closest('.tarot-card');
      if (!el || !board.contains(el)) return;
      const index = Number(el.dataset.index);
      if (Number.isNaN(index)) return;
      if (reading.cards[index].revealed) {
        openCardModal(reading.cards[index].card.id, reading.cards[index].reversed, el);
        return;
      }
      revealCard(reading, index, el);
    });

    $('#revealAll').addEventListener('click', () => revealAll(reading));
    $('#shuffleAgain').addEventListener('click', () => {
      if (state.lastValues) startReading(spread, state.lastValues, { daily: false });
    });

    board.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function revealCard(reading, index, el) {
    const item = reading.cards[index];
    if (!item || item.revealed) return;
    item.revealed = true;
    el.classList.add('is-revealed');
    el.setAttribute('aria-label', `${item.card.name}${item.reversed ? ', перевёрнутая' : ''}. Открыть значение`);
    const slot = el.closest('.spread-slot');
    if (slot) {
      slot.classList.add('is-revealed');
      const hint = $('.slot-hint', slot);
      if (hint) hint.textContent = item.reversed ? 'перевёрнутое положение' : 'прямое положение';
    }
    updateRevealCount(reading);
    if (reading.cards.every((c) => c.revealed)) {
      revealTimer = window.setTimeout(() => showReadingResult(reading), 500);
    }
  }

  function revealAll(reading) {
    clearTimeout(revealTimer);
    const toReveal = reading.cards.map((c, i) => ({ c, i })).filter((x) => !x.c.revealed);
    toReveal.forEach(({ i }, step) => {
      window.setTimeout(() => {
        if (state.reading !== reading) return;
        const el = $(`.spread-board .tarot-card[data-index="${i}"]`);
        if (el) revealCard(reading, i, el);
      }, step * 160);
    });
    if (!toReveal.length) showReadingResult(reading);
  }

  function updateRevealCount(reading) {
    const count = reading.cards.filter((c) => c.revealed).length;
    const label = $('#revealCount');
    if (label) {
      label.textContent = count === reading.cards.length
        ? `Открыто ${count} из ${reading.cards.length} · расклад собран`
        : `Открыто ${count} из ${reading.cards.length} · нажмите на карту`;
    }
  }

  /* ============================================================
     Трактовки расклада
     ============================================================ */
  function positionText(card, reversed, pos) {
    const s = sideOf(card, reversed);
    let main;
    switch (pos.lens) {
      case 'root':
        main = `Корень ситуации — тема «${card.keywords[0]}». ${s.general}`;
        break;
      case 'influence':
        main = `Во внешнем контуре звучит тема «${card.keywords[1] || card.keywords[0]}». ${s.general}`;
        break;
      case 'lesson':
        main = `Урок этой карты — ${card.keywords[1] || card.keywords[0]}. ${s.advice}`;
        break;
      case 'obstacle':
        main = `${card.shadow} ${s.advice}`;
        break;
      case 'direction':
        main = `${s.short} ${s.advice}`;
        break;
      case 'gift':
        main = `${card.gift} ${s.short}`;
        break;
      case 'shadow':
        main = card.shadow;
        break;
      default:
        main = s[pos.lens] || s.general;
    }
    return `${main} ${pos.close || ''}`.replace(/\s+/g, ' ').trim();
  }

  function dayPlanes(card, reversed) {
    const s = sideOf(card, reversed);
    return [
      { title: 'Энергия дня', text: s.general },
      { title: 'На что обратить внимание', text: `${card.shadow} ${reversed ? 'В перевёрнутом положении это особенно легко не заметить.' : ''}`.trim() },
      { title: 'Практический совет', text: `${s.advice} ${s.short}`.trim() },
    ];
  }

  function yesNoResult(reading) {
    const list = reading.cards.map((c) => ({
      card: c.card,
      reversed: c.reversed,
      answer: effectiveAnswer(c.card, c.reversed),
    }));
    const yesCount = list.filter((item) => item.answer.includes('да')).length;
    const noCount = list.filter((item) => item.answer.includes('нет')).length;
    const neutral = list.length - yesCount - noCount;

    let word;
    if (list.length === 1) {
      word = capitalize(list[0].answer);
    } else if (yesCount >= 2 && yesCount > noCount) {
      word = yesCount === list.length ? 'Да' : 'Скорее да';
    } else if (noCount >= 2 && noCount > yesCount) {
      word = noCount === list.length ? 'Нет' : 'Скорее нет';
    } else {
      word = 'Неоднозначно';
    }

    const cls = word === 'Нет' || word === 'Скорее нет' ? 'is-no' : word === 'Неоднозначно' ? 'is-neutral' : '';
    const verdictNotes = {
      'Да': 'Карты скорее поддерживают этот шаг. Окончательное решение всё равно остаётся за вами.',
      'Скорее да': 'Поддержка есть, хотя путь может потребовать терпения и уточнений.',
      'Неоднозначно': 'В ситуации есть и поддержка, и сопротивление: однозначного ответа пока нет.',
      'Скорее нет': 'Карты скорее предупреждают, чем запрещают. Проверьте, что стоит за вашим желанием.',
      'Нет': 'Сейчас энергия не поддерживает этот шаг. Это не приговор, а приглашение пересмотреть подход.',
    };

    let caption;
    if (list.length === 1) {
      caption = list[0].card.yes_no.text;
      if (list[0].reversed) caption += ' Перевёрнутое положение ослабляет и замедляет эту энергию.';
    } else {
      const grouped = list.reduce((acc, item) => {
        acc[item.answer] = (acc[item.answer] || 0) + 1;
        return acc;
      }, {});
      const breakdown = Object.entries(grouped).map(([answer, count]) => `«${answer}» — ${count}`).join(', ');
      caption = `Голоса: ${breakdown}. ${verdictNotes[word] || ''}`;
    }

    const score = list.length === 1 ? 'одна карта' : `${yesCount} да · ${noCount} нет`;
    return { word, cls, caption, yesCount, noCount, score };
  }

  function buildSummary(reading) {
    const spread = SPREAD_BY_ID[reading.spreadId];
    const lead = reading.cards[0];
    const leadSide = sideOf(lead.card, lead.reversed);
    const greeting = reading.name ? `${escapeHtml(reading.name)}, ` : '';
    const paras = [];

    const noName = !reading.name;
    if (spread.special === 'yesno' || spread.special === 'yesno3') {
      paras.push(`${greeting}${noName ? 'К' : 'к'}олода дала ответ на ваш вопрос. Важно не превращать его в приговор, а проверить, что он поднимает: надежду, сопротивление или желание действовать иначе.`);
    } else if (spread.special === 'day') {
      paras.push(`${greeting}${noName ? 'С' : 'с'}егодняшняя карта — ${lead.card.name}. ${leadSide.short}`);
      paras.push(`Тон дня задаёт тема «${lead.card.keywords[0]}». Не обязательно что-то предпринимать: иногда достаточно заметить, как эта энергия уже проявляется.`);
    } else {
      paras.push(`${greeting}${noName ? 'Р' : 'р'}асклад «${spread.title}» собрался вокруг темы «${lead.card.keywords[0]}». ${leadSide.short}`);
      const adviceIndex = spread.positions.findIndex((p) => p.lens === 'advice');
      const adviceItem = reading.cards[adviceIndex >= 0 ? adviceIndex : reading.cards.length - 1];
      const adviceSide = sideOf(adviceItem.card, adviceItem.reversed);
      paras.push(`Опорная мысль — «${adviceItem.card.name}»: ${adviceSide.advice}`);
    }

    if (reading.closing) paras.push(reading.closing);
    else paras.push(pick(T.closingLines || ['']));
    return paras;
  }

  function personalArcana(birthDate) {
    if (!birthDate) return null;
    const date = dateFromInput(birthDate);
    if (!date) return null;
    let n = date.getDate();
    while (n > 22) n = String(n).split('').reduce((sum, d) => sum + Number(d), 0);
    return MATRIX_BY_NUM[n === 0 ? 22 : n] || null;
  }

  function resultItemHTML(reading, index) {
    const spread = SPREAD_BY_ID[reading.spreadId];
    const pos = spread.positions[index];
    const item = reading.cards[index];
    const s = sideOf(item.card, item.reversed);
    const text = positionText(item.card, item.reversed, pos);
    return `<article class="result-item" id="result-${index}" style="animation-delay:${index * 55}ms">
      <div class="result-item-card">${cardEl(item.card, { reversed: item.reversed, tag: 'div' })}</div>
      <div class="result-item-body">
        <div class="result-position">${pos.title}</div>
        <div class="result-item-top">
          <h3>${escapeHtml(item.card.name)}</h3>
          <span class="orientation ${item.reversed ? 'is-rev' : ''}">${item.reversed ? 'перевёрнутая' : 'прямая'}</span>
          <button class="result-card-link" type="button" data-card-open="${item.card.id}" data-reversed="${item.reversed}">о карте</button>
        </div>
        <p class="result-text">${escapeHtml(text)}</p>
        <div class="result-reflect">${icon('question')}<span>Вопрос себе: ${escapeHtml(item.card.reflection)}</span></div>
      </div>
    </article>`;
  }

  function resultHTML(reading, options = {}) {
    const { readOnly = false } = options;
    const spread = SPREAD_BY_ID[reading.spreadId];
    if (!spread) return '';
    reading.summary = reading.summary?.length ? reading.summary : buildSummary(reading);
    const isYesNo = spread.special === 'yesno' || spread.special === 'yesno3';
    const isDay = spread.special === 'day';
    const verdict = isYesNo ? yesNoResult(reading) : null;
    const personal = personalArcana(reading.birthDate);
    const daily = isDay ? dayPlanes(reading.cards[0].card, reading.cards[0].reversed) : null;

    const items = reading.cards.map((_, i) => resultItemHTML(reading, i)).join('');
    const dayExtra = isDay ? `<div class="day-planes">
      ${daily.map((plane, i) => `<div class="day-plane"><span class="day-plane-num">0${i + 1}</span><h4>${plane.title}</h4><p>${escapeHtml(plane.text)}</p></div>`).join('')}
    </div>` : '';

    return `
      <div class="result-summary">
        <span class="eyebrow">${isDay ? 'Послание дня' : 'Расклад собран'}</span>
        <h2>${isDay ? escapeHtml(reading.cards[0].card.name) : spread.title}</h2>
        ${reading.question ? `<blockquote class="result-query">«${escapeHtml(reading.question)}»</blockquote>` : ''}
        ${verdict ? `<div class="verdict-box">
          <div class="verdict-word ${verdict.cls}">${verdict.word}</div>
          <div class="verdict-caption">${escapeHtml(verdict.caption)}</div>
          <div class="verdict-score">${verdict.score}</div>
        </div>` : ''}
        ${reading.summary.map((p) => `<p>${p}</p>`).join('')}
        <div class="result-meta">
          <span class="chip"><span class="dot"></span>${escapeHtml(spread.title)}</span>
          <span class="chip">${formatDateTime(reading.createdAt)}</span>
          ${reading.name ? `<span class="chip">${icon('user')}${escapeHtml(reading.name)}</span>` : ''}
          ${personal ? `<span class="chip">${icon('star')}Личный аркан — ${escapeHtml(personal.name)}</span>` : ''}
        </div>
      </div>
      <div class="result-items">${isDay ? items + dayExtra : items}</div>
      <div class="result-actions">
        <button class="btn btn-soft" type="button" data-copy-reading>${icon('copy')}Скопировать расклад</button>
        <button class="btn btn-ghost" type="button" data-share-reading>${icon('share')}Поделиться</button>
        ${readOnly
          ? `<a class="btn btn-ghost" href="#/spread/${spread.id}" data-repeat-reading>${icon('repeat')}Повторить расклад</a>`
          : `<button class="btn btn-ghost" type="button" data-new-reading>${icon('refresh')}Новый расклад</button>`}
      </div>
      <div class="result-disclaimer">${icon('shield')}<span>Это не приговор и не предсказание. Расклад — зеркало для размышления: он помогает заметить чувства, выборы и возможные направления, но не принимает решения за вас.</span></div>
    `;
  }

  function showReadingResult(reading) {
    if (state.reading !== reading) return;
    const container = $('#readingResult');
    if (!container || container.dataset.ready === '1') return;
    container.dataset.ready = '1';
    container.innerHTML = `<div class="reading-result-inner">${resultHTML(reading)}</div>`;
    if (!reading.saved) {
      saveReadingToHistory(reading);
      toast('Расклад сохранён в истории');
    }
    bindReadingActions(reading, container);
    const items = $$('.result-item', container);
    items.forEach((item, i) => {
      item.style.animationDelay = `${i * 55}ms`;
    });
    window.setTimeout(() => container.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  }

  function bindReadingActions(reading, root) {
    const copyBtn = $('[data-copy-reading]', root);
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const ok = await copyText(buildCopyText(reading));
        toast(ok ? 'Расклад скопирован' : 'Не удалось скопировать');
      });
    }
    const shareBtn = $('[data-share-reading]', root);
    if (shareBtn) {
      shareBtn.addEventListener('click', async () => {
        const text = buildCopyText(reading);
        if (navigator.share) {
          try {
            await navigator.share({ title: `Таро Шоколад · ${SPREAD_BY_ID[reading.spreadId]?.title || 'Расклад'}`, text });
            return;
          } catch {
            /* пользователь отменил — просто копируем */
          }
        }
        const ok = await copyText(text);
        toast(ok ? 'Текст расклада скопирован — можно поделиться' : 'Не удалось поделиться');
      });
    }
    const newBtn = $('[data-new-reading]', root);
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        state.replay = {
          name: reading.name || '',
          birthDate: reading.birthDate || '',
          question: '',
        };
        navigate(`/spread/${reading.spreadId}`);
      });
    }
    const repeatLink = $('[data-repeat-reading]', root);
    if (repeatLink) {
      repeatLink.addEventListener('click', () => {
        state.replay = {
          name: reading.name || '',
          birthDate: reading.birthDate || '',
          question: reading.question || '',
        };
      });
    }
  }

  function buildCopyText(reading) {
    const spread = SPREAD_BY_ID[reading.spreadId];
    const lines = [];
    lines.push('✦ ТАРО ШОКОЛАД ✦');
    lines.push(spread?.title || 'Расклад');
    lines.push(formatDateTime(reading.createdAt));
    if (reading.name) lines.push(`Имя: ${reading.name}`);
    if (reading.question) lines.push(`Вопрос: ${reading.question}`);
    lines.push('— — —');
    reading.cards.forEach((item, i) => {
      const pos = spread?.positions[i];
      lines.push(`${i + 1}. ${pos?.title || 'Карта'}: ${item.card.name}${item.reversed ? ' (перевёрнутая)' : ''}`);
      if (pos) lines.push(positionText(item.card, item.reversed, pos));
      lines.push('');
    });
    lines.push('— — —');
    (reading.summary?.length ? reading.summary : buildSummary(reading)).forEach((p) => lines.push(p.replace(/<[^>]+>/g, '')));
    lines.push('');
    lines.push('taro shokolad · развлекательный и рефлексивный сервис, не предсказание.');
    return lines.join('\n');
  }

  /* ============================================================
     Каталог карт
     ============================================================ */
  const CATALOG_GROUPS = [
    { id: 'all', label: 'Все 78' },
    { id: 'major', label: 'Старшие' },
    { id: 'wands', label: 'Жезлы' },
    { id: 'cups', label: 'Кубки' },
    { id: 'swords', label: 'Мечи' },
    { id: 'pentacles', label: 'Пентакли' },
  ];

  function renderCards() {
    document.title = 'Значения 78 карт — Таро Шоколад';
    app.innerHTML = `
      <section class="page-head">
        <div class="wrap">
          <div class="breadcrumbs"><a href="#/">Главная</a><span class="sep">/</span><span>Карты</span></div>
          <span class="eyebrow">Колода Райдера–Уэйта</span>
          <h1 class="page-title">Значения <em>78 карт</em></h1>
          <p class="page-sub">Прямое и перевёрнутое положение, любовь, деньги, работа, совет и ответ «да / нет». Нажмите на карту, чтобы прочитать полное значение.</p>
        </div>
      </section>
      <div class="catalog-toolbar">
        <div class="wrap catalog-tools">
          <div class="search-box">${icon('search')}<input type="search" id="cardSearch" placeholder="Найти карту или тему…" autocomplete="off" aria-label="Поиск по картам"></div>
          <div class="filter-chips" id="catalogFilters">
            ${CATALOG_GROUPS.map((g) => `<button class="filter-chip ${g.id === state.catalogGroup ? 'is-active' : ''}" type="button" data-filter="${g.id}">${g.label}</button>`).join('')}
          </div>
          <span class="catalog-count" id="catalogCount">78 карт</span>
        </div>
      </div>
      <div class="wrap">
        <div class="catalog-grid" id="catalogGrid"></div>
      </div>
    `;

    const input = $('#cardSearch');
    input.value = state.catalogQuery;
    input.addEventListener('input', () => {
      state.catalogQuery = input.value.trim().toLowerCase();
      updateCatalogGrid();
    });

    $('#catalogFilters').addEventListener('click', (event) => {
      const btn = event.target.closest('[data-filter]');
      if (!btn) return;
      state.catalogGroup = btn.dataset.filter;
      $$('#catalogFilters .filter-chip').forEach((chip) => chip.classList.toggle('is-active', chip === btn));
      updateCatalogGrid();
    });

    updateCatalogGrid();
  }

  function filteredCards() {
    const q = state.catalogQuery;
    return CARDS.filter((card) => {
      const groupOk = state.catalogGroup === 'all'
        || (state.catalogGroup === 'major' ? card.arcana === 'major' : card.suit === state.catalogGroup);
      if (!groupOk) return false;
      if (!q) return true;
      const haystack = `${card.name} ${card.keywords.join(' ')} ${card.suitName || ''} ${card.upright.general} ${card.reversed.general}`.toLowerCase();
      return haystack.includes(q);
    });
  }

  function updateCatalogGrid() {
    const grid = $('#catalogGrid');
    if (!grid) return;
    const list = filteredCards();
    const count = $('#catalogCount');
    if (count) count.textContent = `${list.length} ${list.length === 1 ? 'карта' : list.length < 5 ? 'карты' : 'карт'}`;

    if (!list.length) {
      grid.innerHTML = `<div class="catalog-empty"><p>Ничего не нашлось. Попробуйте другое слово или <strong>сбросьте фильтр</strong>.</p></div>`;
      return;
    }

    grid.innerHTML = list.map((card) => `
      <div class="catalog-item">
        <div class="catalog-item-card-wrap">
          ${cardEl(card, { attrs: `data-card-open="${card.id}"` })}
        </div>
        <div class="catalog-item-info" data-card-open="${card.id}">
          <div class="catalog-item-name">${escapeHtml(card.name)}</div>
          <div class="catalog-item-meta">${escapeHtml(cardMeta(card))}</div>
        </div>
      </div>`).join('');
  }

  /* ============================================================
     Модальное окно карты
     ============================================================ */
  function openCardModal(cardId, reversed = false, trigger = null) {
    const card = CARD_BY_ID[cardId];
    if (!card) return;
    lastModalTrigger = trigger || document.activeElement;
    let orientation = reversed ? 'reversed' : 'upright';

    const meaning = (orient) => {
      const s = sideOf(card, orient === 'reversed');
      const answer = effectiveAnswer(card, orient === 'reversed');
      return `
        <div class="meaning-block"><h3>Общее значение</h3><p>${escapeHtml(s.general)}</p></div>
        <div class="meaning-block"><h3>Коротко</h3><p>${escapeHtml(s.short)}</p></div>
        <div class="meaning-pair">
          <div class="meaning-block"><h3>Любовь и отношения</h3><p>${escapeHtml(s.love)}</p></div>
          <div class="meaning-block"><h3>Деньги</h3><p>${escapeHtml(s.money)}</p></div>
        </div>
        <div class="meaning-block" style="margin-top:16px"><h3>Работа и дело</h3><p>${escapeHtml(s.work)}</p></div>
        <div class="meaning-block"><h3>Совет</h3><p>${escapeHtml(s.advice)}</p></div>
        <div class="meaning-block">
          <h3>Да или нет</h3>
          <p><span class="yesno-pill" data-answer="${escapeHtml(answer)}"><span class="dot"></span>${escapeHtml(capitalize(answer))}</span></p>
          <p style="margin-top:8px">${escapeHtml(card.yes_no.text)}</p>
        </div>
        <div class="meaning-pair">
          <div class="meaning-block"><h3>Теневая сторона</h3><p>${escapeHtml(card.shadow)}</p></div>
          <div class="meaning-block"><h3>Ресурс</h3><p>${escapeHtml(card.gift)}</p></div>
        </div>
        <div class="meaning-block"><h3>Вопрос для рефлексии</h3><p><em>${escapeHtml(card.reflection)}</em></p></div>
      `;
    };

    const markup = `
      <div class="modal-overlay" id="cardModalOverlay">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="cardModalTitle">
          <button class="modal-close" type="button" data-modal-close aria-label="Закрыть">${icon('close')}</button>
          <div class="modal-grid">
            <div class="modal-card-col">
              ${cardEl(card, { reversed: orientation === 'reversed', tag: 'div' })}
              <div class="modal-card-caption">${escapeHtml(cardMeta(card))}</div>
            </div>
            <div>
              <div class="modal-header">
                <span class="eyebrow">${card.arcana === 'major' ? 'Старший аркан' : card.suitName}</span>
                <h2 id="cardModalTitle">${escapeHtml(card.name)}</h2>
                <div class="modal-keywords">${card.keywords.map((k) => `<span class="chip">${escapeHtml(k)}</span>`).join('')}</div>
              </div>
              <div class="modal-tabs" role="tablist">
                <button class="modal-tab ${orientation === 'upright' ? 'is-active' : ''}" type="button" role="tab" aria-selected="${orientation === 'upright'}" data-orientation="upright">Прямое</button>
                <button class="modal-tab ${orientation === 'reversed' ? 'is-active' : ''}" type="button" role="tab" aria-selected="${orientation === 'reversed'}" data-orientation="reversed">Перевёрнутое</button>
              </div>
              <div class="modal-meaning">${meaning(orientation)}</div>
              <div class="modal-footer-note">${icon('info')}<span>Значение зависит от позиции в раскладе и вашего вопроса. Это традиционная трактовка, а не предсказание.</span></div>
            </div>
          </div>
        </div>
      </div>`;

    modalRoot.innerHTML = markup;
    document.body.classList.add('no-scroll');
    const overlay = $('#cardModalOverlay');
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeModal();
    });
    $$('.modal-tab', overlay).forEach((tab) => {
      tab.addEventListener('click', () => {
        orientation = tab.dataset.orientation;
        $$('.modal-tab', overlay).forEach((t) => {
          t.classList.toggle('is-active', t === tab);
          t.setAttribute('aria-selected', String(t === tab));
        });
        $('.modal-meaning', overlay).innerHTML = meaning(orientation);
        const cardCol = $('.modal-card-col', overlay);
        cardCol.innerHTML = `${cardEl(card, { reversed: orientation === 'reversed', tag: 'div' })}<div class="modal-card-caption">${escapeHtml(cardMeta(card))}</div>`;
      });
    });
    setTimeout(() => $('.modal-close', overlay)?.focus(), 60);
  }

  function closeModal(restoreFocus = true) {
    if (!modalRoot.innerHTML) {
      if (confirmResolve) {
        const resolve = confirmResolve;
        confirmResolve = null;
        resolve(false);
      }
      return;
    }
    modalRoot.innerHTML = '';
    document.body.classList.remove('no-scroll');
    if (restoreFocus && lastModalTrigger && typeof lastModalTrigger.focus === 'function') {
      lastModalTrigger.focus({ preventScroll: true });
    }
    lastModalTrigger = null;
    if (confirmResolve) {
      const resolve = confirmResolve;
      confirmResolve = null;
      resolve(false);
    }
  }

  function confirmDialog({ title, text, confirmLabel = 'Удалить' }) {
    return new Promise((resolve) => {
      modalRoot.innerHTML = `
        <div class="modal-overlay" id="confirmOverlay">
          <div class="modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirmTitle">
            <h2 id="confirmTitle" style="font-size:30px;margin-bottom:10px">${escapeHtml(title)}</h2>
            <p style="color:var(--muted);font-size:14px;margin-bottom:24px">${escapeHtml(text)}</p>
            <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">
              <button class="btn btn-ghost" type="button" data-confirm-cancel>Отмена</button>
              <button class="btn btn-primary" type="button" data-confirm-ok>${escapeHtml(confirmLabel)}</button>
            </div>
          </div>
        </div>`;
      document.body.classList.add('no-scroll');
      confirmResolve = resolve;
      const overlay = $('#confirmOverlay');
      const finish = (value) => {
        const fn = confirmResolve;
        confirmResolve = null;
        closeModal(false);
        if (fn) fn(value);
      };
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) finish(false);
      });
      $('[data-confirm-cancel]', overlay).addEventListener('click', () => finish(false));
      $('[data-confirm-ok]', overlay).addEventListener('click', () => finish(true));
      setTimeout(() => $('[data-confirm-ok]', overlay)?.focus(), 50);
    });
  }

  /* ============================================================
     Матрица судьбы
     ============================================================ */
  function reduceArcana(n) {
    let value = Number(n);
    while (value > 22) {
      value = String(value).split('').reduce((sum, digit) => sum + Number(digit), 0);
    }
    return value === 0 ? 22 : value;
  }

  function calculateMatrix(day, month, year) {
    const a = reduceArcana(day);
    const b = reduceArcana(month);
    const yearSum = String(year).split('').reduce((sum, d) => sum + Number(d), 0);
    const c = reduceArcana(yearSum);
    const d = reduceArcana(a + b + c);
    const e = reduceArcana(a + b + c + d);
    const love = reduceArcana(b + e);
    const money = reduceArcana(c + e);
    const balance = reduceArcana(love + money);
    const karma = reduceArcana(a + c);
    return {
      a, b, c, d, e, love, money, balance, karma,
      age20: reduceArcana(e + 20),
      age40: reduceArcana(e + 40),
      age60: reduceArcana(e + 60),
    };
  }

  function arcanaOf(n) {
    return MATRIX_BY_NUM[n] || MATRIX_BY_NUM[22];
  }

  function matrixHeroArt() {
    return `<svg viewBox="0 0 400 400" fill="none" aria-hidden="true">
      <circle cx="200" cy="200" r="176" stroke="rgba(227,181,106,.18)" stroke-dasharray="2 6"/>
      <circle cx="200" cy="200" r="150" stroke="rgba(227,181,106,.22)"/>
      <path d="M200 54L346 200 200 346 54 200Z" stroke="rgba(227,181,106,.3)"/>
      <path d="M200 54V346M54 200H346" stroke="rgba(227,181,106,.12)"/>
      <circle cx="200" cy="200" r="52" stroke="rgba(227,181,106,.5)"/>
      <circle cx="200" cy="200" r="44" stroke="rgba(227,181,106,.22)"/>
      <path d="M200 176l6 18 18 6-18 6-6 18-6-18-18-6 18-6z" fill="#e3b56a"/>
      <circle cx="200" cy="200" r="4" fill="#1a100b"/>
      ${[[200, 54, 8], [346, 200, 8], [200, 346, 7], [54, 200, 6]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#e3b56a" opacity=".75"/>`).join('')}
      ${[[200, 54], [346, 200], [200, 346], [54, 200]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#1a100b"/>`).join('')}
      ${[[125, 120], [285, 132], [310, 288], [104, 300], [200, 88]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#f2cd8b" opacity=".55"/>`).join('')}
      <circle cx="200" cy="200" r="190" stroke="rgba(227,181,106,.08)"/>
      <path d="M200 10v18M200 372v18M10 200h18M372 200h18" stroke="rgba(227,181,106,.35)"/>
    </svg>`;
  }

  function matrixSvg(m) {
    const node = (x, y, value, cls = 'm-circle', numClass = 'm-num', r = 30) =>
      `<circle cx="${x}" cy="${y}" r="${r}" class="${cls}"/>
       <text x="${x}" y="${y + 1}" class="m-num ${numClass}">${value}</text>`;

    const center = 250;
    return `<svg viewBox="0 0 500 500" class="matrix-svg" role="img" aria-label="Схема вашей матрицы судьбы">
      <circle cx="${center}" cy="${center}" r="224" class="m-line-soft"/>
      <circle cx="${center}" cy="${center}" r="212" class="m-line"/>
      <path d="M250 76L424 250 250 424 76 250Z" class="m-line"/>
      <path d="M250 76V424M76 250H424" class="m-line-soft"/>
      <path d="M250 76L424 250M424 250L250 424M250 424L76 250M76 250L250 76" class="m-line-soft"/>
      ${node(250, 76, m.a)}
      ${node(424, 250, m.b)}
      ${node(250, 424, m.c)}
      ${node(76, 250, m.d)}
      ${node(250, 250, m.e, 'm-circle-center', 'm-num-center', 46)}
      <text x="250" y="32" class="m-label">личный аркан</text>
      <text x="424" y="204" class="m-label">эмоции</text>
      <text x="250" y="470" class="m-label">род</text>
      <text x="76" y="204" class="m-label">комфорт</text>
      <text x="250" y="318" class="m-label">центр</text>
      <path d="M424 250L250 250M250 424L250 250" class="m-accent-line" stroke-dasharray="3 5"/>
      <circle cx="348" cy="250" r="3" class="m-accent"/>
      <circle cx="250" cy="348" r="3" class="m-accent"/>
      <path d="M180 118l4 10M302 120l5-9M376 308l-8 6M126 306l9 8" class="m-line" opacity=".5"/>
      <circle cx="250" cy="250" r="210" class="m-line-soft" opacity=".32"/>
      <path d="M250 12v10M250 478v10M12 250h10M478 250h10" class="m-line"/>
    </svg>`;
  }

  function matrixPointCard(key, value, point) {
    const arcana = arcanaOf(value);
    const lens = point.lens || 'essence';
    return `<div class="matrix-point">
      <div class="matrix-point-top">
        <span class="matrix-point-badge">${value}</span>
        <div>
          <div class="matrix-point-title">${point.title}</div>
          <div class="matrix-point-name">${escapeHtml(arcana.name)}</div>
        </div>
      </div>
      <p class="matrix-point-desc">${escapeHtml(arcana[lens] || arcana.essence)}</p>
      <div class="matrix-point-formula">${point.subtitle} · ${point.formula}</div>
    </div>`;
  }

  function matrixResultHTML(m, dateStr, name) {
    const points = [
      ['a', m.a, MATRIX_POINTS.personal],
      ['b', m.b, MATRIX_POINTS.emotion],
      ['c', m.c, MATRIX_POINTS.family],
      ['d', m.d, MATRIX_POINTS.comfort],
      ['e', m.e, MATRIX_POINTS.center],
    ];
    const personal = arcanaOf(m.a);
    const dateText = dateStr ? formatDate(dateFromInput(dateStr) || new Date()) : '';

    const line = (title, value, formula, lens) => {
      const arcana = arcanaOf(value);
      return `<div class="matrix-line-row">
        <div class="matrix-line-name">${title}</div>
        <div class="matrix-line-arcana">${value}</div>
        <div class="matrix-line-content">
          <h4>${escapeHtml(arcana.name)}</h4>
          <p>${escapeHtml(arcana[lens] || arcana.essence)}</p>
          <div class="matrix-line-tags"><span>${formula}</span><span>${escapeHtml(arcana.short)}</span></div>
        </div>
      </div>`;
    };

    return `
      <div class="matrix-result-head">
        <div>
          <span class="eyebrow">Расчёт по дате рождения</span>
          <h2>${name ? `${escapeHtml(name)}, ваша матрица` : 'Ваша матрица'}</h2>
          <p>${dateText} · линия любви, линия денег, кармический хвост и возрастные точки</p>
          <div class="matrix-personal"><span class="avatar">${personal.name.charAt(0)}</span><span>Личный аркан — <strong>${escapeHtml(personal.name)}</strong></span></div>
        </div>
        <span class="reading-badge">22 аркана</span>
      </div>

      <div class="matrix-figure-panel">
        ${matrixSvg(m)}
        <div class="matrix-figure-caption">
          <span><i></i>основные точки</span>
          <span><i class="rose"></i>линии любви и денег</span>
          <span><i></i>центр</span>
        </div>
      </div>

      <div class="matrix-points">
        ${points.map(([key, value, point]) => point ? matrixPointCard(key, value, point) : '').join('')}
      </div>

      <div class="matrix-insight">
        <div class="matrix-insight-head">
          <span class="eyebrow">Центр матрицы</span>
          <h3>Ресурс, тень и предназначение</h3>
        </div>
        <div class="matrix-insight-grid">
          <div class="matrix-insight-item"><h4>На что опереться</h4><p>${escapeHtml(arcanaOf(m.e).strength)}</p></div>
          <div class="matrix-insight-item"><h4>Зона роста</h4><p>${escapeHtml(arcanaOf(m.e).shadow)}</p></div>
          <div class="matrix-insight-item"><h4>Предназначение</h4><p>${escapeHtml(arcanaOf(m.e).career)}</p></div>
        </div>
      </div>

      <div class="matrix-lines">
        ${line('Линия любви', m.love, 'B + E', 'love')}
        ${line('Линия денег', m.money, 'C + E', 'money')}
        ${line('Точка баланса', m.balance, 'любовь + деньги', 'advice')}
        ${line('Кармический хвост', m.karma, 'A + C', 'karma')}
      </div>

      <div class="matrix-age-panel">
        <div class="matrix-age-head"><h3>Возрастные точки</h3><p>Ориентиры развития, а не жёсткие рамки.</p></div>
        <div class="matrix-age-grid">
          ${[['20 лет', m.age20], ['40 лет', m.age40], ['60 лет', m.age60]].map(([label, value]) => {
            const arcana = arcanaOf(value);
            return `<div class="matrix-age-point">
              <span class="matrix-age-label">${label}</span>
              <span class="matrix-age-num">${value}</span>
              <span class="matrix-age-name">${escapeHtml(arcana.name)}</span>
              <p>${escapeHtml(arcana.advice)}</p>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="matrix-method">
        <h4>Как мы считаем</h4>
        <p>Используется одна согласованная схема: <code>A</code> — день рождения, сведённый к 1–22; <code>B</code> — номер месяца; <code>C</code> — сумма цифр года, сведённая к 1–22; <code>D</code> — A + B + C; <code>E</code> — A + B + C + D. Линия любви — B + E, линия денег — C + E, кармический хвост — A + C. Число 22 соответствует Шуту. Если сумма больше 22, складываем цифры, пока не получим 1–22.</p>
        <p style="margin-top:8px">Матрица судьбы — нумерологическая интерпретация, а не научно доказанный метод прогнозирования. Результат описывает потенциал и темы для размышления, а не гарантированные события.</p>
      </div>
    `;
  }

  function matrixEmptyHTML() {
    return `<div class="empty-state matrix-empty">
      <h3>Введите дату рождения</h3>
      <p>Мы сведём день, месяц и год к 22 арканам и покажем основные точки, линии любви и денег, кармический хвост и возрастные ориентиры.</p>
      <div class="matrix-empty-chips">
        <span class="chip"><span class="dot"></span>характер</span>
        <span class="chip"><span class="dot"></span>отношения</span>
        <span class="chip"><span class="dot"></span>деньги</span>
        <span class="chip"><span class="dot"></span>предназначение</span>
      </div>
    </div>`;
  }

  function renderMatrix() {
    document.title = 'Матрица судьбы — Таро Шоколад';
    const profile = getProfile();
    const dateValue = state.matrixDate || profile.birthDate || '';
    const nameValue = state.matrixName || profile.name || '';

    app.innerHTML = `
      <section class="page-head">
        <div class="wrap">
          <div class="matrix-hero">
            <div>
              <div class="breadcrumbs"><a href="#/">Главная</a><span class="sep">/</span><span>Матрица судьбы</span></div>
              <span class="eyebrow">22 аркана · дата рождения</span>
              <h1>Матрица <em>судьбы</em></h1>
              <p>Дата рождения как карта тем: характер, эмоциональный фон, род, зона комфорта, центр, любовь, деньги и кармический хвост. Не приговор — повод посмотреть на себя объёмнее.</p>
              <div class="hero-meta">
                <span>Полная дата рождения</span>
                <span>Расчёт в браузере</span>
                <span>Без сохранения на сервер</span>
              </div>
            </div>
            <div class="matrix-hero-figure" aria-hidden="true">${matrixHeroArt()}</div>
          </div>
        </div>
      </section>

      <div class="wrap">
        <div class="matrix-grid">
          <aside class="matrix-form-panel">
            <h2>Рассчитать матрицу</h2>
            <p>Нужна полная дата рождения: день, месяц и год. Имя — по желанию, чтобы результат был теплее.</p>
            <form id="matrixForm" novalidate>
              <div class="field">
                <label for="matrixName">Имя <span class="optional">необязательно</span></label>
                <input id="matrixName" name="name" type="text" maxlength="40" placeholder="Как к вам обращаться" value="${escapeHtml(nameValue)}">
              </div>
              <div class="field">
                <label for="matrixDate">Дата рождения <span class="optional">обязательно</span></label>
                <input id="matrixDate" name="date" type="date" min="1900-01-01" max="${localISO()}" value="${escapeHtml(dateValue)}" required>
                <p class="hint">Например, 14.07.1990. Дата не отправляется на сервер.</p>
              </div>
              <button class="btn btn-primary btn-block" type="submit">${icon('compass')}Показать матрицу</button>
            </form>
            <div class="matrix-form-note">${icon('info')}<span>Метод предполагает несколько школ расчёта. Здесь используется одна прозрачная схема — она описана под результатом.</span></div>
          </aside>

          <div class="matrix-result" id="matrixResult">
            ${state.matrix ? matrixResultHTML(state.matrix, state.matrixDate, state.matrixName) : matrixEmptyHTML()}
          </div>
        </div>
      </div>
    `;

    $('#matrixForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const dateInput = $('#matrixDate').value;
      const name = $('#matrixName').value.trim();
      const date = dateFromInput(dateInput);
      if (!date) {
        toast('Введите корректную дату рождения');
        $('#matrixDate').focus();
        return;
      }
      const m = calculateMatrix(date.getDate(), date.getMonth() + 1, date.getFullYear());
      state.matrix = m;
      state.matrixDate = dateInput;
      state.matrixName = name;
      saveProfile(name, dateInput);
      $('#matrixResult').innerHTML = matrixResultHTML(m, dateInput, name);
      $('#matrixResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast('Матрица рассчитана');
    });
  }

  /* ============================================================
     История
     ============================================================ */
  function renderHistory() {
    document.title = 'История раскладов — Таро Шоколад';
    const history = getHistory();
    app.innerHTML = `
      <section class="page-head">
        <div class="wrap">
          <div class="breadcrumbs"><a href="#/">Главная</a><span class="sep">/</span><span>История</span></div>
          <span class="eyebrow">Только в вашем браузере</span>
          <h1 class="page-title">История <em>раскладов</em></h1>
          <p class="page-sub">Последние 40 раскладов хранятся локально в localStorage. Их можно открыть заново, повторить или удалить. Данные не уходят на сервер.</p>
        </div>
      </section>
      <section class="section">
        <div class="wrap">
          ${history.length ? `
            <div class="history-toolbar">
              <span class="catalog-count" style="margin-left:0">${history.length} ${history.length === 1 ? 'расклад' : history.length < 5 ? 'расклада' : 'раскладов'}</span>
              <button class="btn btn-ghost btn-sm" type="button" id="clearHistory">${icon('trash')}Очистить историю</button>
            </div>
            <div class="history-list">
              ${history.map((entry) => historyItemHTML(entry)).join('')}
            </div>
          ` : `<div class="empty-state">
            <h3>Пока пусто</h3>
            <p>Сделайте первый расклад — он сохранится здесь автоматически. Можно вернуться к нему позже или сравнить с новым.</p>
            <a class="btn btn-primary" href="#/spread/day">${icon('spark')}Начать с карты дня</a>
          </div>`}
        </div>
      </section>
    `;

    if (!history.length) return;

    $('#clearHistory')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Очистить историю?',
        text: 'Все сохранённые расклады будут удалены из этого браузера. Отменить действие нельзя.',
        confirmLabel: 'Очистить',
      });
      if (!ok) return;
      writeJSON(HISTORY_KEY, []);
      toast('История очищена');
      renderHistory();
    });

    $$('[data-history-delete]').forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        event.preventDefault();
        const ok = await confirmDialog({
          title: 'Удалить расклад?',
          text: 'Он исчезнет из истории этого браузера.',
        });
        if (!ok) return;
        deleteHistoryEntry(btn.dataset.historyDelete);
        toast('Расклад удалён');
        renderHistory();
      });
    });
  }

  function historyItemHTML(entry) {
    const spread = SPREAD_BY_ID[entry.spreadId];
    const firstCard = entry.cards?.[0] ? CARD_BY_ID[entry.cards[0].id] : null;
    return `<div class="history-item">
      <div class="history-thumb">${firstCard ? cardEl(firstCard, { reversed: entry.cards[0].reversed, tag: 'div' }) : ''}</div>
      <div class="history-body">
        <h3>${escapeHtml(spread?.title || entry.spreadTitle || 'Расклад')}</h3>
        ${entry.question ? `<p class="history-question">«${escapeHtml(entry.question)}»</p>` : ''}
        <div class="history-meta">
          <span>${formatDateTime(entry.createdAt)}</span>
          ${entry.name ? `<span>${escapeHtml(entry.name)}</span>` : ''}
          <span>${entry.cards?.length || 0} карт</span>
        </div>
        <div class="history-cards">
          ${(entry.cards || []).map((c) => {
            const card = CARD_BY_ID[c.id];
            return card ? `<span class="history-card-mini ${c.reversed ? 'is-rev' : ''}">${escapeHtml(card.name)}${c.reversed ? ' ↺' : ''}</span>` : '';
          }).join('')}
        </div>
      </div>
      <div class="history-actions">
        <a class="icon-btn" href="#/history/${entry.id}" aria-label="Открыть расклад">${icon('arrow')}</a>
        <button class="icon-btn" type="button" data-history-delete="${entry.id}" aria-label="Удалить расклад">${icon('trash')}</button>
      </div>
    </div>`;
  }

  function renderHistoryEntry(id) {
    const entry = getHistory().find((item) => item.id === id);
    if (!entry) {
      render404('Расклад не найден');
      return;
    }
    const spread = SPREAD_BY_ID[entry.spreadId];
    const cards = (entry.cards || []).map((c) => ({
      card: CARD_BY_ID[c.id],
      reversed: !!c.reversed,
      revealed: true,
    })).filter((c) => c.card);

    if (!spread || !cards.length) {
      render404('Расклад не найден');
      return;
    }

    const reading = {
      id: entry.id,
      createdAt: entry.createdAt,
      spreadId: entry.spreadId,
      name: entry.name,
      birthDate: entry.birthDate,
      question: entry.question,
      cards,
      summary: entry.summary || [],
      saved: true,
    };
    if (!reading.summary.length) reading.summary = buildSummary(reading);
    document.title = `${spread.title} — история — Таро Шоколад`;

    app.innerHTML = `
      <section class="page-head">
        <div class="wrap">
          <div class="breadcrumbs"><a href="#/">Главная</a><span class="sep">/</span><a href="#/history">История</a><span class="sep">/</span><span>${spread.title}</span></div>
          <span class="eyebrow">Сохранённый расклад</span>
          <h1 class="page-title">${spread.title}</h1>
          <p class="page-sub">${formatDateTime(entry.createdAt)}${entry.name ? ` · ${escapeHtml(entry.name)}` : ''}${entry.question ? ` · «${escapeHtml(entry.question)}»` : ''}</p>
        </div>
      </section>
      <div class="wrap" style="padding-top:38px">
        <div class="reading-result" id="historyReading" style="margin-top:0">
          ${resultHTML(reading, { readOnly: true })}
        </div>
      </div>
    `;

    const root = $('#historyReading');
    bindReadingActions(reading, root);
  }

  /* ============================================================
     О проекте
     ============================================================ */
  function renderAbout() {
    document.title = 'О проекте — Таро Шоколад';
    app.innerHTML = `
      <section class="page-head">
        <div class="wrap">
          <div class="breadcrumbs"><a href="#/">Главная</a><span class="sep">/</span><span>О проекте</span></div>
          <span class="eyebrow">Честно о том, как всё устроено</span>
          <h1 class="page-title">Тёплое таро <em>без магии</em> и без ИИ</h1>
          <p class="page-sub">«Таро Шоколад» — небольшой атмосферный сервис для раскладов и рефлексии. Мы хотим, чтобы после него вам было спокойнее и яснее, а не страшнее.</p>
        </div>
      </section>
      <section class="section">
        <div class="wrap about-grid">
          <div class="prose">
            <h2>Что это за сайт</h2>
            <p>Здесь 78 карт Райдера–Уэйта, 11 раскладов, каталог значений и калькулятор Матрицы судьбы. Всё работает в статичном HTML, CSS и JavaScript: нет сервера, аккаунтов, платежей и искусственного интеллекта.</p>
            <p><strong>Вся «интерпретация» написана заранее.</strong> JavaScript перемешивает колоду, случайно выбирает карты, определяет перевёрнутые положения и подставляет тексты в позиции расклада. Сайт не анализирует ваш вопрос и не «понимает» ситуацию — и не притворяется, что понимает.</p>

            <div class="callout"><p>Мы сознательно не называем это предсказанием. Расклад — это структурированный разговор с собой, где картинки помогают заметить то, что вы, возможно, и так знаете, но боитесь назвать.</p></div>

            <h2 id="ethics">Этика и дисклеймер</h2>
            <p>Таро и Матрица судьбы — культурные и эзотерические практики, а не наука и не медицинский инструмент. Мы формулируем результаты через «потенциал», «тему», «символ» и «вопрос для размышления», а не через «так будет».</p>
            <ul>
              <li>Сервис не заменяет консультацию врача, психолога, юриста или финансового специалиста.</li>
              <li>Мы не ставим диагнозы, не назначаем лечение и не даём финансовых гарантий.</li>
              <li>Мы не используем запугивание, «порчи», «проклятия» и обязательные ритуалы.</li>
              <li>Решения о здоровье, деньгах, отношениях и безопасности остаются за вами.</li>
              <li>Если тема вызывает сильную тревогу или боль, пожалуйста, обратитесь к живому специалисту.</li>
            </ul>

            <h2 id="privacy">Конфиденциальность</h2>
            <p>Имя, дата рождения и вопрос обрабатываются только в вашем браузере. Они не отправляются на сервер и не передаются третьим лицам.</p>
            <p>История раскладов хранится в <code>localStorage</code> этого браузера. Её можно удалить кнопкой «Очистить историю» или стандартной очисткой данных сайта. Если вы не хотите сохранять имя и вопрос — просто оставьте поля пустыми.</p>

            <h2>Как мы работаем с картами</h2>
            <p>Значения опираются на традицию Райдера–Уэйта: 22 старших аркана описывают крупные темы и внутренние повороты, 56 младших — бытовые события, чувства, слова и ресурсы. Перевёрнутое положение мы читаем не как «наоборот», а как заблокированную, отложенную, внутреннюю или чрезмерную энергию.</p>
            <p>Смысл карты всегда зависит от позиции: Башня в «препятствии» и Башня в «совете» звучат по-разному. Поэтому в каждом раскладе у карты своя позиция, свой текст и свой вопрос для рефлексии.</p>

            <h2 id="faq">Вопросы и ответы</h2>
            <div class="faq-list">
              ${(UI.faq || []).map((item, i) => `<div class="faq-item" data-faq="${i}">
                <button class="faq-q" type="button" aria-expanded="false">${escapeHtml(item.q)}<span class="faq-icon">+</span></button>
                <div class="faq-a"><div class="faq-a-inner">${escapeHtml(item.a)}</div></div>
              </div>`).join('')}
            </div>

            <h2>Техническая честность</h2>
            <p>Сайт не использует ИИ, нейросети, внешние API и трекеры. Колода — 78 карт, база значений — авторские тексты, матрица — прозрачный калькулятор. Исходный код статичный: его можно открыть, проверить и запустить без интернета (шрифты при этом загрузятся с Google Fonts, но сайт останется читаемым и без них).</p>
            <p style="font-size:12.5px;color:var(--muted-2);margin-top:24px">© ${new Date().getFullYear()} Таро Шоколад. Развлекательный и рефлексивный сервис. Не предсказание будущего.</p>
          </div>
          <aside class="about-aside">
            <div class="about-ornament">
              <svg viewBox="0 0 120 120" fill="none" aria-hidden="true">
                <circle cx="60" cy="60" r="52" stroke="currentColor" stroke-width=".8" stroke-dasharray="2 5" opacity=".5"/>
                <circle cx="60" cy="60" r="38" stroke="currentColor" stroke-width="1"/>
                <path d="M60 28l7 20 20 7-20 7-7 20-7-20-20-7 20-7z" fill="currentColor" opacity=".85"/>
                <circle cx="60" cy="60" r="4" fill="currentColor"/>
                <path d="M60 8v10M60 102v10M8 60h10M102 60h10" stroke="currentColor" stroke-width="1" opacity=".6"/>
              </svg>
              <p>«Карты не решают за вас. Они лишь помогают услышать вопрос, который вы уже носите».</p>
              <span>команда Таро Шоколад</span>
            </div>
            <div class="about-principles">
              <h3>Наши принципы</h3>
              ${(UI.principles || []).map((p) => `<div class="philosophy-item">${icon('check')}<div><h4>${p.title}</h4><p>${p.text}</p></div></div>`).join('')}
            </div>
          </aside>
        </div>
      </section>
    `;

    $$('[data-faq]').forEach((item) => {
      const q = $('.faq-q', item);
      q.addEventListener('click', () => {
        const isOpen = item.classList.toggle('is-open');
        q.setAttribute('aria-expanded', String(isOpen));
      });
    });
  }

  /* ============================================================
     404
     ============================================================ */
  function render404(message = 'Такого расклада нет') {
    document.title = 'Страница не найдена — Таро Шоколад';
    app.innerHTML = `
      <section class="section" style="padding-top:100px">
        <div class="wrap">
          <div class="empty-state">
            <span class="eyebrow" style="justify-content:center">404</span>
            <h3>${escapeHtml(message)}</h3>
            <p>Возможно, ссылка устарела или расклад был удалён из истории. Вернитесь на главную и начните заново.</p>
            <a class="btn btn-primary" href="#/">${icon('arrow')}На главную</a>
          </div>
        </div>
      </section>`;
  }

  /* ============================================================
     Мобильное меню, модалки, инициализация
     ============================================================ */
  function closeMobileNav() {
    const nav = document.getElementById('siteNav');
    const toggle = document.getElementById('navToggle');
    if (!nav || !toggle) return;
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  function init() {
    const year = document.getElementById('footerYear');
    if (year) year.textContent = String(new Date().getFullYear());

    const toggle = document.getElementById('navToggle');
    const nav = document.getElementById('siteNav');
    toggle?.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    });

    nav?.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeMobileNav();
    });

    const header = document.getElementById('siteHeader');
    const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-card-open]');
      if (trigger) {
        event.preventDefault();
        openCardModal(trigger.dataset.cardOpen, trigger.dataset.reversed === 'true', trigger);
        return;
      }
      if (event.target.closest('[data-modal-close]')) closeModal();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modalRoot.innerHTML) closeModal();
    });

    window.addEventListener('hashchange', renderRoute);
    renderRoute();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
