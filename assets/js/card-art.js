/* Символическая графика карт: чистый SVG, без внешних изображений */
(function () {
  'use strict';

  const svg = (inner) =>
    `<svg viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${inner}</svg>`;

  const g = (inner, width = 1.2, opacity = 1) =>
    `<g stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}">${inner}</g>`;

  const star = (x, y, r = 2) =>
    `<path d="M${x} ${y - r}L${x + r * 0.34} ${y - r * 0.34}L${x + r} ${y}L${x + r * 0.34} ${y + r * 0.34}L${x} ${y + r}L${x - r * 0.34} ${y + r * 0.34}L${x - r} ${y}L${x - r * 0.34} ${y - r * 0.34}Z" fill="currentColor" stroke="none"/>`;

  const dots = (points, r = 0.9, opacity = 0.55) =>
    points.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" stroke="none" opacity="${opacity}"/>`).join('');

  const rays = (cx, cy, r1, r2, count, offset = 0) => {
    let out = '';
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + offset;
      out += `<path d="M${(cx + Math.cos(a) * r1).toFixed(2)} ${(cy + Math.sin(a) * r1).toFixed(2)}L${(cx + Math.cos(a) * r2).toFixed(2)} ${(cy + Math.sin(a) * r2).toFixed(2)}"/>`;
    }
    return out;
  };

  const MAJOR = {
    the_fool: `
      <circle cx="50" cy="30" r="8"/>${rays(50, 30, 11, 15, 8, 0.2)}
      ${star(78, 48, 3)}${star(22, 60, 2)}
      <path d="M22 124L50 98L78 124"/>
      <path d="M22 124h56" opacity=".4"/>
      <circle cx="46" cy="72" r="4.5"/>
      <path d="M46 77c-4 7-4 13-2 19M46 83l9 6M46 82l-8 6"/>
      <path d="M62 62l6 44"/>
      <circle cx="64" cy="58" r="3.5"/>
      <path d="M64 62c-5 3-7 6-7 10"/>
      <path d="M26 104c4-3 8-3 11 0M29 97c3-2 6-2 8 0" opacity=".7"/>`,

    the_magician: `
      <circle cx="41" cy="38" r="7.5"/><circle cx="59" cy="38" r="7.5"/>
      <path d="M47.5 43.5c3 3.5 8 3.5 11 0" opacity=".6"/>
      <circle cx="50" cy="61" r="4"/>
      <path d="M50 65c-5 8-7 14-6 22M50 65c5 8 7 14 6 22M44 87h12"/>
      <path d="M50 54V22"/><path d="M46 26h8" opacity=".7"/>
      ${star(50, 18, 3.5)}
      <path d="M20 112h60"/>
      <path d="M27 112v-9m0 0 4-3m-4 3-4-3" />
      <path d="M38 112v-10c0-3 6-3 6 0v10"/>
      <path d="M58 112V101m0 0 3-4m-3-3v3"/>
      <circle cx="68" cy="107" r="4.5"/><path d="M68 100.5l2.6 2 1 3.2-2 2.6h-3.2l-2-2.6 1-3.2z" opacity=".7"/>
      ${star(14, 40, 2)}${star(86, 60, 2)}`,

    the_high_priestess: `
      <path d="M57 20a15 15 0 1 0 1 27 12 12 0 1 1-1-27z"/>
      ${star(50, 12, 3)}
      <rect x="20" y="48" width="10" height="72"/><rect x="18" y="44" width="14" height="5"/>
      <rect x="70" y="48" width="10" height="72"/><rect x="68" y="44" width="14" height="5"/>
      <path d="M30 58c10 10 30 10 40 0"/><path d="M30 64c10 10 30 10 40 0" opacity=".4"/>
      ${dots([[39, 70], [46, 76], [54, 76], [61, 70]], 1.1, 0.5)}
      <circle cx="50" cy="84" r="5" opacity=".55"/>
      <path d="M41 106c4-5 14-5 18 0v10H41z"/><path d="M50 106v10" opacity=".5"/>
      <path d="M34 122h32" opacity=".4"/>
      ${star(14, 76, 2)}${star(86, 96, 2)}`,

    the_empress: `
      <path d="M36 30l6-8 6 8 6-10 6 10 4-6" />
      <circle cx="50" cy="52" r="12"/>
      <path d="M41 48c3-5 15-5 18 0" opacity=".5"/>
      <path d="M50 64v54"/>
      <path d="M50 72c-7-3-11 1-10 6 5 1 9-2 10-6zM50 84c7-3 11 1 10 6-5 1-9-2-10-6zM50 96c-7-3-11 1-10 6 5 1 9-2 10-6zM50 108c7-3 11 1 10 6-5 1-9-2-10-6z"/>
      <path d="M50 72c7-3 11 1 10 6-5 1-9-2-10-6zM50 84c-7-3-11 1-10 6 5 1 9-2 10-6zM50 96c7-3 11 1 10 6-5 1-9-2-10-6z"/>
      <path d="M50 60l4 5 5-1-2 5 2 4-5-1-4 4-1-5-5-2 4-3z" opacity=".8"/>
      <path d="M28 126c6-6 14-6 22 0 8-6 16-6 22 0" opacity=".6"/>
      ${star(20, 42, 2)}${star(80, 34, 2.4)}`,

    the_emperor: `
      <path d="M34 52c-8-4-14-12-12-18 8-1 13 5 14 12M66 52c8-4 14-12 12-18-8-1-13 5-14 12" opacity=".8"/>
      <rect x="26" y="62" width="48" height="58" rx="2"/>
      <rect x="34" y="48" width="32" height="22" rx="2"/>
      <path d="M38 62v14M62 62v14" opacity=".4"/>
      <circle cx="50" cy="78" r="8"/><path d="M50 70v16M42 78h16" opacity=".5"/>
      <path d="M30 120h40M38 62v58M62 62v58" opacity=".3"/>
      <path d="M72 34v54"/><circle cx="72" cy="30" r="4"/><path d="M68 34h8" opacity=".6"/>
      <path d="M22 44h6M22 50h6M22 56h6" opacity=".5"/>
      ${star(50, 40, 2)}`,

    the_hierophant: `
      <path d="M50 24v96"/>
      <path d="M40 38h20M35 50h30M30 64h40"/>
      <path d="M38 74c2 4 2 8 0 12M62 74c-2 4-2 8 0 12" opacity=".5"/>
      <path d="M28 44v76M72 44v76" opacity=".35"/>
      <circle cx="34" cy="104" r="5"/><path d="M38 108l14 10"/>
      <circle cx="66" cy="104" r="5"/><path d="M62 108l-14 10"/>
      <path d="M34 110v8M66 110v8" opacity=".4"/>
      ${dots([[38, 32], [50, 18], [62, 32]], 1.2, 0.7)}
      <path d="M30 126h40" opacity=".4"/>`,

    the_lovers: `
      <circle cx="50" cy="28" r="9"/>${rays(50, 28, 12, 17, 8, 0.1)}
      <circle cx="38" cy="92" r="18"/><circle cx="62" cy="92" r="18"/>
      <circle cx="38" cy="70" r="4"/><path d="M38 74c-4 6-4 12-2 18M38 80l7 5M38 80l-7 5"/>
      <circle cx="62" cy="70" r="4"/><path d="M62 74c4 6 4 12 2 18M62 80l7 5M62 80l-7 5"/>
      <path d="M50 84v26" opacity=".25"/>
      <path d="M18 106c4-10 8-14 10-16M82 106c-4-10-8-14-10-16" opacity=".45"/>
      ${star(18, 54, 2)}${star(82, 54, 2)}`,

    the_chariot: `
      <path d="M30 42h40l-6 26H36z" opacity=".45"/>
      <path d="M34 50h32" opacity=".4"/>
      ${star(50, 54, 2.5)}
      <rect x="30" y="76" width="40" height="24" rx="2"/>
      <path d="M24 76h52" opacity=".5"/>
      <circle cx="50" cy="114" r="16"/><circle cx="50" cy="114" r="5"/>
      ${rays(50, 114, 6, 15, 8, 0)}
      <path d="M22 94c-6 4-8 10-6 16M78 94c6 4 8 10 6 16" opacity=".6"/>
      <path d="M28 88l-4-8h8zM72 88l4-8h-8z" opacity=".55"/>
      ${star(24, 36, 2)}${star(76, 36, 2)}`,

    strength: `
      <circle cx="41" cy="32" r="6.5"/><circle cx="59" cy="32" r="6.5"/>
      <path d="M47 37c3 3 7 3 10 0" opacity=".5"/>
      <circle cx="50" cy="88" r="24"/>
      ${rays(50, 88, 25, 31, 14, 0.1)}
      <circle cx="42" cy="83" r="2"/><circle cx="58" cy="83" r="2"/>
      <path d="M50 89l-4 5h8zM44 102c4 3 8 3 12 0" opacity=".8"/>
      <path d="M24 62c8 3 12 10 12 18M76 62c-8 3-12 10-12 18" opacity=".4"/>
      ${star(16, 44, 2)}${star(84, 44, 2)}`,

    the_hermit: `
      <path d="M38 126c-2-30 4-48 12-48s14 18 12 48"/>
      <circle cx="50" cy="66" r="7"/>
      <path d="M43 60c2-8 12-8 14 0" opacity=".5"/>
      <path d="M62 52v52" opacity=".45"/>
      <path d="M70 48l10 10-10 10-10-10z"/>
      <circle cx="70" cy="58" r="4"/>
      ${rays(70, 58, 12, 17, 8, 0.4)}
      <path d="M30 126h40" opacity=".4"/>
      ${star(30, 42, 2.3)}${star(82, 30, 1.7)}`,

    wheel_of_fortune: `
      <circle cx="50" cy="78" r="38"/><circle cx="50" cy="78" r="30"/><circle cx="50" cy="78" r="10"/>
      ${rays(50, 78, 10, 37, 12, 0)}
      <circle cx="50" cy="40" r="3" fill="currentColor" stroke="none"/>
      <path d="M24 34c6-4 12-4 16 0M60 34c4-4 10-4 16 0" opacity=".5"/>
      <path d="M18 126h64" opacity=".3"/>
      ${star(50, 78, 3)}
      ${star(14, 58, 2)}${star(86, 98, 2)}`,

    justice: `
      <path d="M50 24v98"/><path d="M42 34h16"/><circle cx="50" cy="26" r="4"/>
      <path d="M26 58h48"/>
      <path d="M26 58l-8 20h16zM74 58l-8 20h16z" opacity=".8"/>
      <path d="M18 78c2 6 14 6 16 0M66 78c2 6 14 6 16 0" opacity=".5"/>
      <path d="M40 112h20M46 112v-8h8v8" opacity=".5"/>
      <path d="M30 44v76M70 44v76" opacity=".3"/>
      ${star(50, 46, 2.2)}`,

    the_hanged_man: `
      <path d="M26 30h48M42 30v12"/>
      <path d="M42 42c0 8 8 8 8 16" opacity=".7"/>
      <circle cx="50" cy="64" r="5"/>
      <path d="M50 69l-8 22 16-4z"/>
      <path d="M44 84l-10 10M56 87l10 8" />
      <path d="M34 96h-6M66 95h6" opacity=".5"/>
      <path d="M38 60a12 12 0 1 1 24 0" opacity=".4"/>
      <path d="M26 126h48" opacity=".35"/>
      ${star(72, 48, 2)}${star(26, 112, 2)}`,

    death: `
      <path d="M30 124c2-28 14-48 34-58"/>
      <path d="M64 66c12 2 20 12 18 24-6-2-10-8-12-14-2 6-6 10-12 12 2-8 4-16 6-22z"/>
      <circle cx="50" cy="46" r="12" opacity=".5"/>${rays(50, 46, 13, 18, 8, 0.2)}
      <path d="M32 100c6-6 12-6 18 0 6-6 12-6 18 0" opacity=".5"/>
      <path d="M50 94l4 5 6-2-2 6 4 5-6 1-3 6-4-5-6 2 2-6-4-5 6-1z" opacity=".75"/>
      ${star(20, 52, 2)}${star(80, 40, 2)}`,

    temperance: `
      <circle cx="50" cy="28" r="9"/>${rays(50, 28, 12, 17, 8, 0.3)}
      <path d="M28 62l12-6 4 10-12 6zM68 62l-12-6-4 10 12 6z" opacity=".9"/>
      <path d="M44 66c4 10 8 16 12 22M56 66c-4 10-8 16-12 22" opacity=".5"/>
      <path d="M40 88c8 6 12 6 20 0" opacity=".6"/>
      <path d="M24 106c8-4 14 4 22 0s14 4 22 0 14 4 22 0" opacity=".45"/>
      <path d="M24 116c8-4 14 4 22 0s14 4 22 0 14 4 22 0" opacity=".3"/>
      <path d="M34 66v-8M66 66v-8" opacity=".4"/>
      ${star(22, 40, 2)}${star(78, 40, 2)}`,

    the_devil: `
      <path d="M34 44c-8-6-10-16-4-20 6 4 8 10 8 16M66 44c8-6 10-16 4-20-6 4-8 10-8 16" opacity=".8"/>
      <circle cx="50" cy="82" r="28"/>
      <path d="M50 62l14 34H36z"/>
      <path d="M50 108l14-34H36z" opacity=".55"/>
      <path d="M40 94h20" opacity=".5"/>
      <circle cx="50" cy="82" r="4" fill="currentColor" stroke="none" opacity=".7"/>
      <path d="M22 62c-4 6-4 12 0 18m56-18c4 6 4 12 0 18" opacity=".4"/>
      <circle cx="22" cy="88" r="4"/><circle cx="78" cy="88" r="4"/>
      <path d="M26 90c4 6 4 12 0 18m48-18c-4 6-4 12 0 18" opacity=".3"/>
      ${star(20, 36, 2)}${star(80, 36, 2)}`,

    the_tower: `
      <path d="M26 30l8 20-10 8 16 10-6 12" opacity=".55"/>
      <path d="M38 58h24v61H38z"/>
      <path d="M34 58l4-8h4v8h4v-8h4v8h4v-8h4l4 8" opacity=".9"/>
      <path d="M46 82h8v37h-8z" opacity=".55"/>
      <path d="M42 70h6M54 70h4M42 92h3M56 92h3M42 102h3M56 102h3" opacity=".4"/>
      <path d="M64 22l-8 16 10-2-6 18" fill="none"/>
      <path d="M76 40l4-4M80 48l6-2M72 34l2-6" opacity=".6"/>
      <path d="M28 120h48" opacity=".4"/>
      <path d="M50 52l3 5 5 2-5 2-3 5-2-5-5-2 5-2z" opacity=".65"/>`,

    the_star: `
      <path d="M50 22l6 20 20 6-20 6-6 20-6-20-20-6 20-6z"/>
      <path d="M50 38l3 10 10 3-10 3-3 10-3-10-10-3 10-3z" opacity=".5"/>
      ${star(24, 34, 2.4)}${star(78, 42, 1.8)}${star(32, 58, 1.5)}
      <path d="M34 92l-8 14h16zM66 92l-8 14h16z" opacity=".8"/>
      <path d="M30 106c-4 6-4 10 0 14M70 106c4 6 4 10 0 14" opacity=".5"/>
      <path d="M22 126c8-4 14 4 22 0s14 4 22 0 14 4 22 0" opacity=".35"/>
      ${star(50, 86, 2)}`,

    the_moon: `
      <path d="M58 20a18 18 0 1 0 2 33 14 14 0 1 1-2-33z"/>
      ${star(72, 30, 2)}${star(80, 48, 1.5)}${star(28, 28, 1.6)}
      <rect x="18" y="62" width="11" height="48"/><path d="M16 62l7-9 7 9" opacity=".7"/>
      <rect x="71" y="62" width="11" height="48"/><path d="M69 62l7-9 7 9" opacity=".7"/>
      <path d="M34 74c12 0 8 12 20 12s8 12 20 12" opacity=".55"/>
      <path d="M23 120c8-4 14 4 22 0s14 4 22 0 14 4 22 0" opacity=".4"/>
      ${dots([[40, 52], [60, 64], [88, 36], [12, 48]], 1.1, 0.45)}
      <path d="M50 126l2 6 2-6" opacity=".4"/>`,

    the_sun: `
      <circle cx="50" cy="52" r="19"/>
      ${rays(50, 52, 22, 31, 12, 0.2)}
      ${rays(50, 52, 23, 27, 12, 0.46)}
      <circle cx="43" cy="49" r="1.8"/><circle cx="57" cy="49" r="1.8"/>
      <path d="M43 58c4 4 10 4 14 0" opacity=".8"/>
      <path d="M30 108v18M30 114c-6-4-9-2-9-8 5-1 8 2 9 8zM30 118c6-4 9-2 9-8-5-1-8 2-9 8z" opacity=".8"/>
      <path d="M70 108v18M70 114c6-4 9-2 9-8-5-1-8 2-9 8zM70 118c-6-4-9-2-9-8 5-1 8 2 9 8z" opacity=".8"/>
      <path d="M20 126c8-4 14 4 22 0s14 4 22 0 14 4 22 0" opacity=".4"/>
      ${star(22, 34, 2)}${star(80, 28, 2.4)}`,

    judgement: `
      <path d="M30 112l34-52"/><path d="M62 58l16-6-2 16z" opacity=".7"/>
      <path d="M66 52c8-2 14 2 16 8M72 44c8 0 14 6 16 12" opacity=".7"/>
      <path d="M28 44c-6-4-6-10 0-14 6 4 6 10 0 14z" opacity=".5"/>
      <path d="M38 36c-4-6-4-12 0-16 4 4 4 10 0 16z" opacity=".35"/>
      <path d="M28 126c4-10 12-16 22-16s18 6 22 16" opacity=".55"/>
      <circle cx="50" cy="106" r="4" opacity=".6"/>
      <path d="M14 84h10M76 84h10" opacity=".4"/>
      ${star(84, 40, 2)}${star(24, 68, 2)}`,

    the_world: `
      <ellipse cx="50" cy="78" rx="27" ry="44"/>
      <path d="M50 26l6 18 18 6-18 6-6 18-6-18-18-6 18-6z" opacity=".8"/>
      <circle cx="50" cy="78" r="5"/>
      <path d="M50 60c8 6 8 30 0 36M50 60c-8 6-8 30 0 36" opacity=".5"/>
      <path d="M28 44c-4 6-4 12 0 18M72 44c4 6 4 12 0 18M28 94c-4 6-4 12 0 18M72 94c4 6 4 12 0 18" opacity=".5"/>
      <path d="M22 38l4-4 4 4-4 4zM74 38l4-4 4 4-4 4zM22 114l4-4 4 4-4 4zM74 114l4-4 4 4-4 4z" opacity=".45"/>
      ${star(50, 130, 2)}${star(50, 18, 2)}`,
  };

  const SUIT_SYMBOL = {
    wands: `<path d="M10 2v26"/><path d="M10 9C5 7 2 10 3 14c4 1 6-1 7-5zM10 16c5-2 8 1 7 5-4 1-6-1-7-5z"/><circle cx="10" cy="5" r="1.6" fill="currentColor" stroke="none"/>`,
    cups: `<path d="M3 7h14c0 9-3 13-7 13S3 16 3 7z"/><path d="M10 20v6M5 28h10"/><path d="M6 10c1 4 3 6 4 7" opacity=".4"/><circle cx="10" cy="12" r="1" fill="currentColor" stroke="none"/>`,
    swords: `<path d="M10 1v20"/><path d="M5 21h10"/><path d="M10 21v6"/><circle cx="10" cy="28" r="1.5"/><path d="M10 4l-2 4h4z" fill="currentColor" stroke="none"/>`,
    pentacles: `<circle cx="10" cy="15" r="9"/><path d="M10 7l2.4 7.4h7.8l-6.3 4.6 2.4 7.4-6.3-4.6-6.3 4.6 2.4-7.4L3 14.4h7.8z" opacity=".9"/>`,
  };

  const pipLayouts = {
    2: [[50, 46], [50, 104]],
    3: [[50, 38], [32, 102], [68, 102]],
    4: [[34, 48], [66, 48], [34, 102], [66, 102]],
    5: [[30, 42], [70, 42], [50, 75], [30, 108], [70, 108]],
    6: [[32, 40], [68, 40], [32, 75], [68, 75], [32, 110], [68, 110]],
    7: [[50, 34], [30, 60], [70, 60], [30, 88], [70, 88], [30, 116], [70, 116]],
    8: [[30, 38], [70, 38], [30, 64], [70, 64], [30, 90], [70, 90], [30, 116], [70, 116]],
    9: [[30, 38], [50, 38], [70, 38], [30, 74], [50, 74], [70, 74], [30, 110], [50, 110], [70, 110]],
    10: [[26, 38], [50, 38], [74, 38], [38, 64], [62, 64], [26, 90], [50, 90], [74, 90], [38, 116], [62, 116]],
  };

  const cornerFlourish = `
    <path d="M10 22c0-7 5-12 12-12M90 22c0-7-5-12-12-12M10 128c0 7 5 12 12 12M90 128c0 7-5 12-12 12" opacity=".22" stroke-width=".9"/>`;

  function minorArt(card) {
    const suit = card.suit;
    const rank = Number(card.rank);
    const glyph = SUIT_SYMBOL[suit];
    const accentDots = dots([[24, 26], [76, 26], [24, 124], [76, 124]], 0.9, 0.4);

    if (rank >= 11) {
      const crown = `
        <path d="M36 44l4-12 6 7 4-11 4 11 6-7 4 12z" opacity=".75"/>
        ${dots([[44, 36], [50, 30], [56, 36]], 0.9, 0.5)}
        <path d="M36 46h28" opacity=".45"/>`;
      const rankMark = rank === 11 ? `<path d="M50 118l3 4-3 4-3-4z" opacity=".7"/>`
        : rank === 12 ? `<path d="M44 122l6-10 6 10M44 122h12" opacity=".6"/>`
        : `<path d="M42 126l4-14h8l4 14M46 112h8" opacity=".6"/>`;
      const arch = `<path d="M28 118c0-38 9-58 22-58s22 20 22 58" opacity=".2"/>`;
      return svg(`
        ${cornerFlourish}${arch}${crown}
        <g transform="translate(50 84) scale(2.2) translate(-10 -15)">${g(glyph, 1.1)}</g>
        ${rankMark}${accentDots}
        <path d="M34 130h32" opacity=".25"/>
      `);
    }

    if (rank === 1) {
      return svg(`
        ${cornerFlourish}
        <circle cx="50" cy="78" r="34" opacity=".22" stroke-dasharray="2 4"/>
        ${rays(50, 78, 36, 44, 16, 0.1)}
        <g transform="translate(50 78) scale(3.4) translate(-10 -15)">${g(glyph, 1.1)}</g>
        ${star(50, 24, 2.6)}${star(50, 132, 2.2)}
        ${dots([[26, 46], [74, 46], [26, 110], [74, 110]], 1.1, 0.45)}
        <path d="M32 132h36" opacity=".2"/>
      `);
    }

    const points = pipLayouts[rank] || pipLayouts[5];
    const pips = points.map(([x, y]) =>
      `<g transform="translate(${x - 15} ${y - 22.5}) scale(1.5)">${g(glyph, 1.25)}</g>`).join('');
    return svg(`
      ${cornerFlourish}
      <path d="M20 136h60" opacity=".15"/>
      ${dots([[18, 18], [82, 18], [18, 132], [82, 132]], 0.8, 0.3)}
      ${pips}
      ${traceNumber(rank)}
    `);
  }

  function traceNumber(rank) {
    const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    return `<text x="50" y="145" text-anchor="middle" font-family="Cormorant Garamond, serif" font-size="6" fill="currentColor" opacity=".35" stroke="none">${roman[rank]}</text>`;
  }

  function artFor(card) {
    if (!card) return svg('');
    if (card.arcana === 'major') {
      return svg(g(MAJOR[card.id] || MAJOR.the_star, 1.15) + `<path d="M14 140h72" opacity=".14"/>`);
    }
    return minorArt(card);
  }

  window.TAROT = window.TAROT || {};
  window.TAROT.cardArt = artFor;
})();
