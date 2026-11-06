#!/usr/bin/env node
/**
 * Собирает контентные JSON-файлы в браузерные скрипты.
 * Запуск: node scripts/build-content.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const content = (name) => resolve(root, 'src/content', name);
const out = (name) => resolve(root, 'assets/js/data', name);

const readJson = async (name) => JSON.parse(await readFile(content(name), 'utf8'));

const [majors1, majors2, wands, cups, swords, pentacles, matrixArcana] = await Promise.all([
  readJson('majors-1.json'),
  readJson('majors-2.json'),
  readJson('wands.json'),
  readJson('cups.json'),
  readJson('swords.json'),
  readJson('pentacles.json'),
  readJson('matrix-arcana.json'),
]);

const SUITS = {
  wands: { name: 'Жезлы', genitive: 'Жезлов', element: 'Огонь', theme: 'воля, дело и творчество' },
  cups: { name: 'Кубки', genitive: 'Кубков', element: 'Вода', theme: 'чувства, близость и вдохновение' },
  swords: { name: 'Мечи', genitive: 'Мечей', element: 'Воздух', theme: 'мысли, слова и решения' },
  pentacles: { name: 'Пентакли', genitive: 'Пентаклей', element: 'Земля', theme: 'ресурсы, тело и устойчивость' },
};

const RANKS = {
  1: 'Туз', 2: 'Двойка', 3: 'Тройка', 4: 'Четвёрка', 5: 'Пятёрка',
  6: 'Шестёрка', 7: 'Семёрка', 8: 'Восьмёрка', 9: 'Девятка', 10: 'Десятка',
  11: 'Паж', 12: 'Рыцарь', 13: 'Королева', 14: 'Король',
};

const required = ['id', 'name', 'arcana', 'keywords', 'upright', 'reversed', 'yes_no', 'shadow', 'gift', 'reflection'];
const sub = ['general', 'love', 'money', 'work', 'advice', 'short'];
const allowedAnswers = new Set(['да', 'скорее да', 'неоднозначно', 'скорее нет', 'нет']);
const cards = [];
const errors = [];

function validate(card, group) {
  for (const key of required) {
    if (card[key] === undefined || card[key] === null || card[key] === '') {
      errors.push(`${group}: ${card.id || '?'} — нет поля ${key}`);
    }
  }
  for (const side of ['upright', 'reversed']) {
    for (const key of sub) {
      if (!card[side] || !card[side][key]) errors.push(`${group}: ${card.id} — ${side}.${key} пусто`);
      else if (key === 'short' && card[side][key].length > 160) {
        errors.push(`${group}: ${card.id} — ${side}.short длиннее 160`);
      }
    }
  }
  if (!Array.isArray(card.keywords) || card.keywords.length < 2) {
    errors.push(`${group}: ${card.id} — keywords`);
  }
  if (!allowedAnswers.has(card.yes_no?.answer)) {
    errors.push(`${group}: ${card.id} — yes_no.answer=${card.yes_no?.answer}`);
  }
}

function add(card, group) {
  validate(card, group);
  if (cards.some((c) => c.id === card.id)) errors.push(`Дубликат id: ${card.id}`);
  cards.push(card);
}

majors1.forEach((c) => add(c, 'majors-1'));
majors2.forEach((c) => add(c, 'majors-2'));
for (const [suit, list] of Object.entries({ wands, cups, swords, pentacles })) {
  list.forEach((c) => {
    const rank = Number(c.rank);
    const expectedSuit = suit;
    if (c.suit !== expectedSuit) errors.push(`${suit}: ${c.id} — suit=${c.suit}`);
    if (!RANKS[rank]) errors.push(`${suit}: ${c.id} — rank=${c.rank}`);
    if (!/^(ace|two|three|four|five|six|seven|eight|nine|ten|page|knight|queen|king)_of_/.test(c.id)) {
      errors.push(`${suit}: странный id ${c.id}`);
    }
    add({ ...c, suitName: SUITS[suit].name, rankName: RANKS[rank] }, suit);
  });
}

cards.sort((a, b) => {
  if (a.arcana === 'major' && b.arcana === 'major') return a.number - b.number;
  if (a.arcana === 'major') return -1;
  if (b.arcana === 'major') return 1;
  const order = { wands: 0, cups: 1, swords: 2, pentacles: 3 };
  return order[a.suit] - order[b.suit] || a.rank - b.rank;
});

const ids = new Set(cards.map((c) => c.id));
if (cards.length !== 78) errors.push(`Всего карт: ${cards.length}, ожидалось 78`);
if (ids.size !== cards.length) errors.push('Неуникальные id');
if (matrixArcana.length !== 22) errors.push(`Арканов матрицы: ${matrixArcana.length}, ожидалось 22`);
matrixArcana.sort((a, b) => a.arcana - b.arcana);
matrixArcana.forEach((a, i) => {
  if (a.arcana !== i + 1) errors.push(`Матрица: нарушен порядок на ${i + 1}`);
  for (const key of ['name', 'essence', 'strength', 'shadow', 'love', 'money', 'career', 'karma', 'advice', 'short']) {
    if (!a[key]) errors.push(`Матрица ${a.arcana}: пусто ${key}`);
  }
});

if (errors.length) {
  console.error('✗ Ошибки контента:\n' + errors.map((e) => '  • ' + e).join('\n'));
  process.exit(1);
}

const banner = `/* Сгенерировано scripts/build-content.mjs — не редактируйте вручную. */\n`;
const cardsJs = `${banner}window.TAROT = window.TAROT || {};\nwindow.TAROT.cards = ${JSON.stringify(cards, null, 2)};\n`;
await writeFile(out('cards.js'), cardsJs, 'utf8');

const matrixPoints = {
  personal: {
    title: 'Личный аркан',
    subtitle: 'Характер и способ действовать',
    lens: 'essence',
    formula: 'день рождения, сведённый к 1–22',
  },
  emotion: {
    title: 'Аркан эмоций',
    subtitle: 'Внутренний фон и близость',
    lens: 'love',
    formula: 'номер месяца',
  },
  family: {
    title: 'Аркан рода',
    subtitle: 'Социальная роль и опора',
    lens: 'money',
    formula: 'сумма цифр года, сведённая к 1–22',
  },
  comfort: {
    title: 'Зона комфорта',
    subtitle: 'Что даёт ощущение опоры',
    lens: 'strength',
    formula: 'A + B + C, сведённые к 1–22',
  },
  center: {
    title: 'Центр матрицы',
    subtitle: 'Главная тема и точка сборки',
    lens: 'essence',
    formula: 'A + B + C + D, сведённые к 1–22',
  },
};

const matrixJs = `${banner}window.TAROT = window.TAROT || {};
window.TAROT.matrixArcana = ${JSON.stringify(matrixArcana, null, 2)};
window.TAROT.matrixPoints = ${JSON.stringify(matrixPoints, null, 2)};
`;
await writeFile(out('matrix.js'), matrixJs, 'utf8');

const bySuit = cards.reduce((acc, c) => {
  const key = c.arcana === 'major' ? 'major' : c.suit;
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});

console.log('✓ cards.js —', cards.length, 'карт', bySuit);
console.log('✓ matrix.js —', matrixArcana.length, 'арканов');
console.log('  Первые:', cards.slice(0, 3).map((c) => c.name).join(', '));
console.log('  Последние:', cards.slice(-3).map((c) => c.name).join(', '));
