'use strict';

// بيولّد رسومات SVG بسيطة وموحدة الشكل لكل منتج في public/images/products
// التشغيل: npm run images

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', 'images', 'products');

/* ------------------------------- ألوان -------------------------------- */

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
}
function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(A.map((x, i) => x + (B[i] - x) * t));
}
const lighten = (c, t) => mix(c, '#ffffff', t);
const darken = (c, t) => mix(c, '#000000', t);

/* ------------------------------ أيقونات ------------------------------- */

const icons = {
  mound(x, y) {
    return `
      <path d="M${x - 46} ${y + 26} C${x - 36} ${y - 6} ${x - 16} ${y - 26} ${x} ${y - 26} C${x + 16} ${y - 26} ${x + 36} ${y - 6} ${x + 46} ${y + 26} Z" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
      ${[[-20, 8], [-6, -8], [8, 4], [22, 14], [-28, 18], [4, 18], [14, -10], [-14, -2]]
        .map(([dx, dy]) => `<circle cx="${x + dx}" cy="${y + dy}" r="2.2" fill="#cbd5e1"/>`)
        .join('')}
      <path d="M${x + 30} ${y - 30} l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#fbbf24"/>`;
  },
  cubes(x, y) {
    const cube = (cx, cy, s) => `
      <polygon points="${cx},${cy - s} ${cx + s},${cy - s / 2} ${cx},${cy} ${cx - s},${cy - s / 2}" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5" stroke-linejoin="round"/>
      <polygon points="${cx - s},${cy - s / 2} ${cx},${cy} ${cx},${cy + s} ${cx - s},${cy + s / 2}" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.5" stroke-linejoin="round"/>
      <polygon points="${cx},${cy} ${cx + s},${cy - s / 2} ${cx + s},${cy + s / 2} ${cx},${cy + s}" fill="#cbd5e1" stroke="#94a3b8" stroke-width="1.5" stroke-linejoin="round"/>`;
    return cube(x, y - 8, 20) + cube(x - 21, y + 18, 20) + cube(x + 21, y + 18, 20);
  },
  grains(x, y, color = '#ffffff') {
    const pts = [
      [-30, -14, 30], [-8, -20, -20], [16, -14, 50], [34, -2, 10], [-36, 10, -40],
      [-14, 2, 70], [8, 4, -10], [28, 18, 40], [-22, 22, 15], [2, 24, -55], [20, -30, 0],
    ];
    return pts
      .map(([dx, dy, r]) => `<ellipse cx="${x + dx}" cy="${y + dy}" rx="10" ry="4.5" transform="rotate(${r} ${x + dx} ${y + dy})" fill="${color}" stroke="#cbd5e1" stroke-width="1.5"/>`)
      .join('');
  },
  longGrains(x, y) {
    const pts = [[-26, -16, 25], [0, -22, -15], [24, -12, 40], [-32, 8, -35], [-6, 2, 60], [20, 10, -5], [-16, 24, 10], [10, 26, -45]];
    return pts
      .map(([dx, dy, r]) => `<ellipse cx="${x + dx}" cy="${y + dy}" rx="14" ry="3.6" transform="rotate(${r} ${x + dx} ${y + dy})" fill="#fffbeb" stroke="#d6d3d1" stroke-width="1.5"/>`)
      .join('');
  },
  wheat(x, y) {
    let s = `<path d="M${x} ${y + 40} L${x} ${y - 38}" stroke="#b45309" stroke-width="3" stroke-linecap="round"/>`;
    for (let i = 0; i < 4; i++) {
      const yy = y - 26 + i * 16;
      s += `<ellipse cx="${x - 9}" cy="${yy}" rx="9" ry="5" transform="rotate(-35 ${x - 9} ${yy})" fill="#f59e0b"/>`;
      s += `<ellipse cx="${x + 9}" cy="${yy}" rx="9" ry="5" transform="rotate(35 ${x + 9} ${yy})" fill="#f59e0b"/>`;
    }
    s += `<ellipse cx="${x}" cy="${y - 40}" rx="5" ry="9" fill="#f59e0b"/>`;
    return s;
  },
  penne(x, y) {
    const tube = (cx, cy, r) => `
      <g transform="rotate(${r} ${cx} ${cy})">
        <polygon points="${cx - 24},${cy - 8} ${cx + 18},${cy - 8} ${cx + 26},${cy + 8} ${cx - 16},${cy + 8}" fill="#fbbf24" stroke="#d97706" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M${cx - 12} ${cy - 8} l8 16 M${cx} ${cy - 8} l8 16 M${cx + 12} ${cy - 8} l8 16" stroke="#d97706" stroke-width="1.2" opacity=".6"/>
      </g>`;
    return tube(x - 6, y - 20, -20) + tube(x + 8, y + 2, 15) + tube(x - 10, y + 24, -5);
  },
  noodles(x, y) {
    let s = '';
    for (let i = 0; i < 6; i++) {
      const yy = y - 24 + i * 10;
      s += `<path d="M${x - 38} ${yy} q10 -8 19 0 t19 0 t19 0 t19 0" fill="none" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>`;
    }
    return s;
  },
  shaker(x, y) {
    return `
      <path d="M${x - 24} ${y - 14} Q${x - 24} ${y - 40} ${x} ${y - 40} Q${x + 24} ${y - 40} ${x + 24} ${y - 14} Z" fill="#94a3b8"/>
      ${[-12, 0, 12].map((dx) => `<circle cx="${x + dx}" cy="${y - 26}" r="2.5" fill="#ffffff"/>`).join('')}
      <rect x="${x - 26}" y="${y - 14}" width="52" height="54" rx="10" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>
      <path d="M${x - 14} ${y + 6} l4 4 -4 4 -4 -4z M${x + 6} ${y + 18} l4 4 -4 4 -4 -4z M${x + 10} ${y} l3 3 -3 3 -3 -3z" fill="#7dd3fc"/>`;
  },
  lentils(x, y) {
    const pts = [[-28, -10], [-12, -18], [4, -14], [20, -18], [32, -4], [-34, 8], [-18, 4], [-2, 2], [14, 2], [28, 12], [-24, 22], [-8, 18], [8, 20], [22, 26], [-4, -30], [12, -30]];
    return pts.map(([dx, dy]) => `<ellipse cx="${x + dx}" cy="${y + dy}" rx="7.5" ry="6.5" fill="#fb923c" stroke="#ea580c" stroke-width="1.2"/>`).join('');
  },
  fava(x, y) {
    const pts = [[-22, -16, 20], [12, -20, -30], [-28, 12, -10], [4, 4, 40], [28, 6, 10], [-6, 28, -40], [22, 28, 25]];
    return pts
      .map(([dx, dy, r]) => `
        <g transform="rotate(${r} ${x + dx} ${y + dy})">
          <ellipse cx="${x + dx}" cy="${y + dy}" rx="14" ry="10" fill="#a16207" stroke="#713f12" stroke-width="1.5"/>
          <path d="M${x + dx + 8} ${y + dy - 5} q4 5 0 10" stroke="#422006" stroke-width="2" fill="none" stroke-linecap="round"/>
        </g>`)
      .join('');
  },
  whiteBeans(x, y) {
    const pts = [[-22, -16, 20], [12, -20, -30], [-28, 12, -10], [4, 4, 40], [28, 6, 10], [-6, 28, -40], [22, 28, 25]];
    return pts
      .map(([dx, dy, r]) => `<ellipse cx="${x + dx}" cy="${y + dy}" rx="14" ry="9" transform="rotate(${r} ${x + dx} ${y + dy})" fill="#fffbeb" stroke="#d6d3d1" stroke-width="1.8"/>`)
      .join('');
  },
  chickpeas(x, y) {
    const pts = [[-24, -16], [0, -22], [24, -14], [-32, 8], [-8, 2], [16, 6], [34, 14], [-18, 26], [6, 28]];
    return pts
      .map(([dx, dy]) => `
        <circle cx="${x + dx}" cy="${y + dy}" r="11" fill="#fcd34d" stroke="#d97706" stroke-width="1.5"/>
        <path d="M${x + dx + 2} ${y + dy - 10} q4 -3 6 1" stroke="#d97706" stroke-width="1.5" fill="none"/>`)
      .join('');
  },
  sunflower(x, y) {
    let s = '';
    for (let i = 0; i < 12; i++) {
      s += `<ellipse cx="${x}" cy="${y - 26}" rx="8" ry="16" transform="rotate(${i * 30} ${x} ${y})" fill="#facc15" stroke="#eab308" stroke-width="1"/>`;
    }
    return s + `<circle cx="${x}" cy="${y}" r="17" fill="#78350f"/><circle cx="${x}" cy="${y}" r="10" fill="#92400e"/>`;
  },
  corn(x, y) {
    let s = `<path d="M${x - 6} ${y + 40} Q${x - 40} ${y + 10} ${x - 26} ${y - 22} Q${x - 18} ${y + 8} ${x - 2} ${y + 30} Z" fill="#22c55e"/>`;
    s += `<ellipse cx="${x + 4}" cy="${y - 4}" rx="20" ry="38" fill="#facc15" stroke="#ca8a04" stroke-width="1.5"/>`;
    for (let i = -3; i <= 3; i++) s += `<line x1="${x - 14}" y1="${y - 4 + i * 9}" x2="${x + 22}" y2="${y - 4 + i * 9}" stroke="#ca8a04" stroke-width="1.2"/>`;
    s += `<line x1="${x + 4}" y1="${y - 40}" x2="${x + 4}" y2="${y + 32}" stroke="#ca8a04" stroke-width="1.2"/>`;
    s += `<path d="M${x + 10} ${y + 40} Q${x + 44} ${y + 10} ${x + 30} ${y - 18} Q${x + 24} ${y + 12} ${x + 8} ${y + 30} Z" fill="#16a34a"/>`;
    return s;
  },
  drop(x, y, color = '#f59e0b') {
    return `
      <path d="M${x} ${y - 38} C${x + 6} ${y - 22} ${x + 30} ${y} ${x + 30} ${y + 14} C${x + 30} ${y + 32} ${x + 16} ${y + 42} ${x} ${y + 42} C${x - 16} ${y + 42} ${x - 30} ${y + 32} ${x - 30} ${y + 14} C${x - 30} ${y} ${x - 6} ${y - 22} ${x} ${y - 38} Z" fill="${color}"/>
      <path d="M${x - 16} ${y + 14} q0 14 12 20" stroke="#ffffff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>`;
  },
  teacup(x, y) {
    return `
      <path d="M${x - 18} ${y - 22} q-8 -10 0 -18 M${x} ${y - 22} q-8 -10 0 -18 M${x + 18} ${y - 22} q-8 -10 0 -18" stroke="#94a3b8" stroke-width="3" fill="none" stroke-linecap="round"/>
      <ellipse cx="${x}" cy="${y + 30}" rx="44" ry="8" fill="#e2e8f0"/>
      <path d="M${x - 34} ${y - 12} H${x + 34} V${y + 4} Q${x + 34} ${y + 28} ${x} ${y + 28} Q${x - 34} ${y + 28} ${x - 34} ${y + 4} Z" fill="#ffffff" stroke="#b91c1c" stroke-width="2.5"/>
      <path d="M${x + 34} ${y - 4} q16 0 16 12 q0 12 -18 12" stroke="#b91c1c" stroke-width="5" fill="none"/>
      <ellipse cx="${x}" cy="${y - 12}" rx="34" ry="5" fill="#b45309"/>`;
  },
  teabag(x, y) {
    return `
      <path d="M${x} ${y - 40} V${y - 12}" stroke="#94a3b8" stroke-width="2"/>
      <path d="M${x} ${y - 40} q30 -4 34 16" stroke="#94a3b8" stroke-width="2" fill="none"/>
      <rect x="${x + 22}" y="${y - 26}" width="26" height="20" rx="3" fill="#dc2626"/>
      <path d="M${x - 24} ${y - 12} H${x + 24} L${x + 28} ${y + 34} Q${x + 28} ${y + 40} ${x + 22} ${y + 40} H${x - 22} Q${x - 28} ${y + 40} ${x - 28} ${y + 34} Z" fill="#fef3c7" stroke="#d6d3d1" stroke-width="2"/>
      <path d="M${x - 14} ${y + 8} q14 -10 28 0 q-14 22 -28 0z" fill="#16a34a"/>`;
  },
  leaf(x, y) {
    return `
      <path d="M${x - 34} ${y + 30} C${x - 40} ${y - 20} ${x - 4} ${y - 40} ${x + 36} ${y - 36} C${x + 38} ${y + 6} ${x + 8} ${y + 40} ${x - 34} ${y + 30} Z" fill="#22c55e"/>
      <path d="M${x - 30} ${y + 26} Q${x} ${y - 4} ${x + 30} ${y - 30}" stroke="#15803d" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M${x - 8} ${y + 4} l-6 -16 M${x + 6} ${y - 10} l-4 -14 M${x - 4} ${y + 2} l14 4 M${x + 10} ${y - 12} l14 2" stroke="#15803d" stroke-width="2" stroke-linecap="round"/>`;
  },
  coffeeBean(x, y) {
    const bean = (cx, cy, r) => `
      <g transform="rotate(${r} ${cx} ${cy})">
        <ellipse cx="${cx}" cy="${cy}" rx="18" ry="25" fill="#92400e" stroke="#451a03" stroke-width="2"/>
        <path d="M${cx} ${cy - 22} C${cx - 10} ${cy - 8} ${cx + 10} ${cy + 8} ${cx} ${cy + 22}" stroke="#451a03" stroke-width="3" fill="none"/>
      </g>`;
    return bean(x - 16, y + 2, -25) + bean(x + 18, y - 4, 25);
  },
  bubbles(x, y, color = '#38bdf8') {
    return [[-18, 8, 18], [16, -14, 14], [20, 20, 10], [-8, -26, 8], [-30, -12, 7]]
      .map(([dx, dy, r]) => `
        <circle cx="${x + dx}" cy="${y + dy}" r="${r}" fill="#ffffff" stroke="${color}" stroke-width="2.5"/>
        <path d="M${x + dx - r / 2} ${y + dy - r / 6} a${r / 2} ${r / 2} 0 0 1 ${r / 2.4} ${-r / 2.4}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round"/>`)
      .join('');
  },
  lemon(x, y) {
    return `
      <ellipse cx="${x - 6}" cy="${y + 6}" rx="30" ry="22" transform="rotate(-20 ${x - 6} ${y + 6})" fill="#facc15" stroke="#ca8a04" stroke-width="2"/>
      <path d="M${x + 18} ${y - 6} q10 -4 12 -10" stroke="#ca8a04" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M${x + 4} ${y - 20} q14 -18 30 -12 q-10 16 -30 12z" fill="#22c55e"/>
      <circle cx="${x + 26}" cy="${y + 22}" r="9" fill="#ffffff" stroke="#38bdf8" stroke-width="2"/>
      <circle cx="${x - 30}" cy="${y - 22}" r="7" fill="#ffffff" stroke="#38bdf8" stroke-width="2"/>`;
  },
  shirt(x, y) {
    return `
      <path d="M${x - 14} ${y - 34} Q${x} ${y - 24} ${x + 14} ${y - 34} L${x + 40} ${y - 22} L${x + 32} ${y - 2} L${x + 22} ${y - 6} V${y + 34} H${x - 22} V${y - 6} L${x - 32} ${y - 2} L${x - 40} ${y - 22} Z" fill="#ffffff" stroke="#3b82f6" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="${x + 30}" cy="${y + 24}" r="9" fill="#ffffff" stroke="#38bdf8" stroke-width="2"/>
      <circle cx="${x - 32}" cy="${y + 20}" r="6" fill="#ffffff" stroke="#38bdf8" stroke-width="2"/>
      <path d="M${x + 4} ${y + 2} l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#fbbf24"/>`;
  },
  lavender(x, y) {
    let s = `<path d="M${x - 10} ${y + 40} Q${x - 6} ${y} ${x - 16} ${y - 36} M${x + 8} ${y + 40} Q${x + 10} ${y} ${x + 18} ${y - 34}" stroke="#16a34a" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    for (let i = 0; i < 6; i++) {
      s += `<ellipse cx="${x - 15 + i * 0.6}" cy="${y - 34 + i * 9}" rx="6" ry="5" fill="#a78bfa"/>`;
      s += `<ellipse cx="${x + 17 - i * 1.4}" cy="${y - 32 + i * 9}" rx="6" ry="5" fill="#8b5cf6"/>`;
    }
    return s;
  },
  flower(x, y, color = '#f472b6') {
    let s = '';
    for (let i = 0; i < 5; i++) s += `<ellipse cx="${x}" cy="${y - 9}" rx="6" ry="9" transform="rotate(${i * 72} ${x} ${y})" fill="${color}"/>`;
    return s + `<circle cx="${x}" cy="${y}" r="5" fill="#fde047"/>`;
  },
  bag(x, y) {
    return `
      <path d="M${x - 16} ${y - 14} V${y - 24} a16 16 0 0 1 32 0 V${y - 14}" stroke="#16a34a" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M${x - 34} ${y - 14} H${x + 34} L${x + 30} ${y + 36} Q${x + 29} ${y + 42} ${x + 22} ${y + 42} H${x - 22} Q${x - 29} ${y + 42} ${x - 30} ${y + 36} Z" fill="#22c55e"/>
      <path d="M${x - 10} ${y + 12} l8 8 16 -16" stroke="#ffffff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  },
};

/* ------------------------------ الأشكال ------------------------------- */

function textLines(x, y, color, w = 84) {
  return `
    <rect x="${x - w / 2}" y="${y}" width="${w}" height="8" rx="4" fill="${color}" opacity=".55"/>
    <rect x="${x - w / 2 + 12}" y="${y + 15}" width="${w - 24}" height="6" rx="3" fill="${color}" opacity=".3"/>`;
}

const shapes = {
  bag(p) {
    const wide = p.wide ? 18 : 0;
    const L = 112 - wide;
    const R = 288 + wide;
    const main = p.color;
    const dark = darken(main, 0.22);
    let teeth = '';
    for (let x = L + 4; x < R - 4; x += 12) teeth += `L${x + 6} 70 L${x + 12} 80 `;
    const label = p.window
      ? `<rect x="138" y="152" width="124" height="118" rx="20" fill="#fffbeb" stroke="${lighten(main, 0.6)}" stroke-width="4"/>`
      : `<rect x="136" y="148" width="128" height="156" rx="18" fill="${p.label || '#ffffff'}"/>`;
    const lines = p.window ? textLines(200, 288, '#ffffff', 96) : textLines(200, 266, main);
    return `
      <path d="M${L + 4} 80 ${teeth} L${R - 4} 80 L${R - 4} 100 L${L + 4} 100 Z" fill="${dark}"/>
      <path d="M${L} 96 H${R} L${R + 10} 330 Q${R + 10} 348 ${R - 8} 348 H${L + 8} Q${L - 10} 348 ${L - 10} 330 Z" fill="${main}"/>
      <path d="M${R - 34} 96 H${R} L${R + 10} 330 Q${R + 10} 348 ${R - 8} 348 H${R - 26} Z" fill="#000000" opacity=".08"/>
      <path d="M${L + 14} 110 h10 l-6 220 h-10z" fill="#ffffff" opacity=".18"/>
      <rect x="${L}" y="96" width="${R - L}" height="10" fill="#000000" opacity=".06"/>
      ${label}
      ${icons[p.icon](200, p.window ? 210 : 206, p.iconColor)}
      ${lines}`;
  },
  box(p) {
    const main = p.color;
    const handle = p.handle
      ? `<path d="M170 106 V82 Q170 70 182 70 H234 Q246 70 246 82 V106" stroke="${darken(main, 0.35)}" stroke-width="10" fill="none" stroke-linecap="round"/>`
      : '';
    return `
      ${handle}
      <polygon points="112,128 152,104 312,104 272,128" fill="${lighten(main, 0.25)}"/>
      <polygon points="272,128 312,104 312,324 272,348" fill="${darken(main, 0.25)}"/>
      <rect x="112" y="128" width="160" height="220" rx="4" fill="${main}"/>
      <rect x="112" y="128" width="160" height="22" fill="#000000" opacity=".07"/>
      <rect x="130" y="164" width="124" height="146" rx="18" fill="${p.label || '#ffffff'}"/>
      ${icons[p.icon](192, 218, p.iconColor)}
      ${textLines(192, 270, main, 80)}`;
  },
  tissueBox(p) {
    const main = p.color;
    const flowers = [[124, 226], [254, 230], [140, 318], [262, 318], [200, 336]]
      .map(([x, y]) => icons.flower(x, y, '#ffffff'))
      .join('');
    return `
      <polygon points="92,206 128,182 318,182 282,206" fill="${lighten(main, 0.3)}"/>
      <polygon points="282,206 318,182 318,318 282,344" fill="${darken(main, 0.22)}"/>
      <rect x="92" y="206" width="190" height="138" rx="4" fill="${main}"/>
      <ellipse cx="205" cy="194" rx="58" ry="7" fill="${darken(main, 0.35)}"/>
      <path d="M160 196 C164 160 182 126 208 104 C214 132 242 154 252 196 Z" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
      <path d="M190 190 C194 160 204 136 210 120" stroke="#e2e8f0" stroke-width="2" fill="none"/>
      ${flowers}
      <rect x="152" y="246" width="86" height="56" rx="14" fill="#ffffff"/>
      ${icons.flower(176, 274, main)}
      <rect x="192" y="266" width="34" height="6" rx="3" fill="${main}" opacity=".6"/>
      <rect x="192" y="278" width="24" height="5" rx="2.5" fill="${main}" opacity=".35"/>`;
  },
  bottle(p) {
    const main = p.color;
    const cap = p.cap || darken(main, 0.3);
    const capShape = p.flip
      ? `<path d="M176 86 L184 58 H216 L224 86 Z" fill="${cap}"/><rect x="194" y="44" width="12" height="16" rx="3" fill="${darken(cap, 0.2)}"/>`
      : `<rect x="176" y="58" width="48" height="30" rx="7" fill="${cap}"/><rect x="176" y="74" width="48" height="4" fill="#000000" opacity=".12"/>`;
    return `
      ${capShape}
      <rect x="184" y="86" width="32" height="24" fill="${darken(main, 0.08)}"/>
      <path d="M184 108 C184 130 134 138 134 176 V322 Q134 348 160 348 H240 Q266 348 266 322 V176 C266 138 216 130 216 108 Z" fill="${main}"/>
      <path d="M244 160 C258 172 258 176 258 190 V320 Q258 336 244 340" stroke="#000000" stroke-width="14" opacity=".07" fill="none"/>
      <path d="M150 180 V320" stroke="#ffffff" stroke-width="9" stroke-linecap="round" opacity=".35"/>
      <rect x="148" y="194" width="104" height="122" rx="16" fill="${p.label || '#ffffff'}"/>
      ${icons[p.icon](200, 240, p.iconColor)}
      ${textLines(200, 284, darken(main, 0.3), 70)}`;
  },
  jug(p) {
    const main = p.color;
    const cap = p.cap || darken(main, 0.3);
    return `
      <rect x="194" y="70" width="46" height="28" rx="6" fill="${cap}"/>
      <path d="M150 112 H198 V96 H236 V112 H262 Q284 112 284 134 V326 Q284 348 262 348 H150 Q128 348 128 326 V134 Q128 112 150 112 Z" fill="${main}"/>
      <rect x="236" y="128" width="30" height="58" rx="15" fill="${p.tint}"/>
      <path d="M270 140 V330" stroke="#000000" stroke-width="12" opacity=".07"/>
      <path d="M144 136 V328" stroke="#ffffff" stroke-width="8" stroke-linecap="round" opacity=".3"/>
      <rect x="146" y="200" width="120" height="122" rx="16" fill="${p.label || '#ffffff'}"/>
      ${icons[p.icon](206, 246, p.iconColor)}
      ${textLines(206, 290, darken(main, 0.25), 74)}`;
  },
  tub(p) {
    const main = p.color;
    return `
      <path d="M124 186 H276 L264 330 Q262 348 244 348 H156 Q138 348 136 330 Z" fill="${main}"/>
      <path d="M248 186 H276 L264 330 Q262 348 244 348 H238 Z" fill="#000000" opacity=".08"/>
      <rect x="112" y="152" width="176" height="40" rx="12" fill="${p.lid}"/>
      <rect x="112" y="178" width="176" height="6" fill="#000000" opacity=".1"/>
      <rect x="150" y="212" width="100" height="112" rx="16" fill="${p.label || '#ffffff'}"/>
      ${icons[p.icon](200, 254, p.iconColor)}
      ${textLines(200, 300, darken(main, 0.3), 64)}`;
  },
  pouch(p) {
    const main = p.color;
    return `
      <path d="M126 104 H274 L286 328 Q288 348 266 348 H134 Q112 348 114 328 Z" fill="${main}"/>
      <rect x="126" y="96" width="148" height="20" rx="3" fill="${darken(main, 0.25)}"/>
      <path d="M130 124 H270" stroke="#ffffff" stroke-width="2" stroke-dasharray="6 6" opacity=".4"/>
      <path d="M248 116 L262 116 L274 328 Q275 342 262 344 Z" fill="#000000" opacity=".08"/>
      <circle cx="200" cy="148" r="8" fill="${darken(main, 0.3)}"/>
      <circle cx="200" cy="232" r="62" fill="${p.label || '#ffffff'}"/>
      ${icons[p.icon](200, 228, p.iconColor)}
      ${textLines(200, 306, '#ffffff', 90)}`;
  },
  canister(p) {
    const main = p.color;
    return `
      <rect x="138" y="118" width="124" height="230" rx="18" fill="${main}"/>
      <ellipse cx="200" cy="118" rx="62" ry="12" fill="${darken(main, 0.25)}"/>
      <path d="M200 106 L232 112 L222 122 Z" fill="#e2e8f0"/>
      <path d="M244 130 V338" stroke="#000000" stroke-width="14" opacity=".07"/>
      <path d="M152 134 V334" stroke="#ffffff" stroke-width="8" stroke-linecap="round" opacity=".3"/>
      <rect x="150" y="176" width="100" height="128" rx="16" fill="${p.label || '#ffffff'}"/>
      ${icons[p.icon](200, 226, p.iconColor)}
      ${textLines(200, 280, darken(main, 0.3), 64)}`;
  },
  rolls(p) {
    const main = p.color;
    const count = p.count || 3;
    const w = count === 3 ? 58 : 80;
    const gap = 6;
    const total = count * w + (count - 1) * gap;
    const startX = 200 - total / 2;
    let rollsBack = '';
    let rollsFront = '';
    for (let i = 0; i < count; i++) {
      const x = startX + i * (w + gap);
      if (count === 3) {
        rollsBack += `<rect x="${x + 6}" y="124" width="${w}" height="190" rx="8" fill="#f1f5f9"/><ellipse cx="${x + 6 + w / 2}" cy="124" rx="${w / 2}" ry="9" fill="#e2e8f0"/>`;
      }
      rollsFront += `
        <rect x="${x}" y="146" width="${w}" height="200" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
        <ellipse cx="${x + w / 2}" cy="146" rx="${w / 2}" ry="10" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>
        <ellipse cx="${x + w / 2}" cy="146" rx="${w / 6}" ry="4" fill="#cbd5e1"/>`;
    }
    return `
      ${rollsBack}
      ${rollsFront}
      <rect x="${startX - 8}" y="120" width="${total + 22}" height="234" rx="18" fill="${main}" opacity=".14"/>
      <rect x="${startX - 8}" y="232" width="${total + 22}" height="64" fill="${main}"/>
      <rect x="${startX + 8}" y="242" width="44" height="44" rx="12" fill="#ffffff"/>
      ${icons.flower(startX + 30, 264, main)}
      <rect x="${startX + 64}" y="252" width="${total - 70}" height="8" rx="4" fill="#ffffff" opacity=".85"/>
      <rect x="${startX + 64}" y="268" width="${(total - 70) * 0.6}" height="6" rx="3" fill="#ffffff" opacity=".6"/>`;
  },
  pocketPacks(p) {
    const colors = p.colors;
    let s = '';
    colors.forEach((c, i) => {
      const y = 272 - i * 64;
      const x = 112 + (i % 2) * 12;
      s += `
        <rect x="${x}" y="${y}" width="176" height="72" rx="18" fill="${c}"/>
        <rect x="${x}" y="${y + 54}" width="176" height="18" rx="9" fill="#000000" opacity=".08"/>
        <rect x="${x + 48}" y="${y + 20}" width="80" height="14" rx="7" fill="#ffffff"/>
        ${icons.flower(x + 26, y + 40, '#ffffff')}
        ${icons.flower(x + 150, y + 44, '#ffffff')}`;
    });
    const top = 272 - (colors.length - 1) * 64;
    const tx = 112 + ((colors.length - 1) % 2) * 12;
    s += `<path d="M${tx + 64} ${top + 26} C${tx + 70} ${top - 6} ${tx + 90} ${top - 20} ${tx + 100} ${top - 24} C${tx + 104} ${top - 4} ${tx + 112} ${top + 10} ${tx + 114} ${top + 26} Z" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>`;
    return s;
  },
};

/* ------------------------------ المنتجات ------------------------------ */

const products = [
  { id: 'sugar-1kg', shape: 'bag', color: '#2f7de1', icon: 'mound', label: '#eff6ff' },
  { id: 'sugar-cubes', shape: 'box', color: '#e11d48', icon: 'cubes', label: '#fff1f2' },
  { id: 'rice-1kg', shape: 'bag', color: '#16a34a', icon: 'grains', label: '#f0fdf4' },
  { id: 'rice-5kg', shape: 'bag', wide: true, color: '#c58b3a', icon: 'grains', label: '#fffbeb' },
  { id: 'rice-basmati', shape: 'bag', color: '#7c3aed', icon: 'longGrains', label: '#f5f3ff' },
  { id: 'flour-1kg', shape: 'bag', color: '#f59e0b', icon: 'wheat', label: '#ffffff' },
  { id: 'pasta-penne', shape: 'bag', window: true, color: '#dc2626', icon: 'penne' },
  { id: 'vermicelli', shape: 'bag', window: true, color: '#2563eb', icon: 'noodles' },
  { id: 'salt', shape: 'canister', color: '#0ea5e9', icon: 'shaker', label: '#f0f9ff' },
  { id: 'lentils-yellow', shape: 'bag', color: '#ea580c', icon: 'lentils', label: '#fff7ed' },
  { id: 'fava-beans', shape: 'bag', color: '#4d7c0f', icon: 'fava', label: '#f7fee7' },
  { id: 'white-beans', shape: 'bag', color: '#0f766e', icon: 'whiteBeans', label: '#f0fdfa' },
  { id: 'chickpeas', shape: 'pouch', color: '#b45309', icon: 'chickpeas', label: '#fffbeb' },
  { id: 'oil-sunflower', shape: 'bottle', color: '#facc15', cap: '#16a34a', icon: 'sunflower', label: '#ffffff' },
  { id: 'oil-corn', shape: 'bottle', color: '#fbbf24', cap: '#dc2626', icon: 'corn', label: '#ffffff' },
  { id: 'ghee', shape: 'tub', color: '#f59e0b', lid: '#15803d', icon: 'drop', label: '#ffffff' },
  { id: 'tea-loose', shape: 'box', color: '#b91c1c', icon: 'teacup', label: '#fff7ed' },
  { id: 'tea-bags', shape: 'box', color: '#facc15', icon: 'teabag', label: '#ffffff' },
  { id: 'green-tea', shape: 'box', color: '#15803d', icon: 'leaf', label: '#f0fdf4' },
  { id: 'coffee', shape: 'pouch', color: '#78350f', icon: 'coffeeBean', label: '#fef3c7' },
  { id: 'tissues-box', shape: 'tissueBox', color: '#38bdf8' },
  { id: 'tissues-pocket', shape: 'pocketPacks', color: '#f472b6', colors: ['#38bdf8', '#f472b6', '#34d399'] },
  { id: 'toilet-paper', shape: 'rolls', color: '#3b82f6', count: 3 },
  { id: 'kitchen-towels', shape: 'rolls', color: '#10b981', count: 2 },
  { id: 'dish-soap', shape: 'bottle', flip: true, color: '#84cc16', cap: '#facc15', icon: 'lemon', label: '#ffffff' },
  { id: 'laundry-powder', shape: 'box', handle: true, color: '#2563eb', icon: 'shirt', label: '#eff6ff' },
  { id: 'bleach', shape: 'jug', color: '#0284c7', cap: '#f8fafc', icon: 'drop', iconColor: '#38bdf8', label: '#ffffff' },
  { id: 'floor-cleaner', shape: 'jug', color: '#8b5cf6', cap: '#5b21b6', icon: 'lavender', label: '#f5f3ff' },
  { id: 'placeholder', shape: 'box', color: '#94a3b8', icon: 'bag', label: '#ffffff' },
];

function render(p) {
  const tint = lighten(p.color, 0.84);
  const spec = { ...p, tint };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <circle cx="200" cy="214" r="156" fill="${tint}"/>
  <ellipse cx="200" cy="352" rx="118" ry="12" fill="#0f172a" opacity=".08"/>
  ${shapes[p.shape](spec)}
</svg>
`.replace(/\n\s*\n/g, '\n');
}

fs.mkdirSync(OUT, { recursive: true });
for (const p of products) {
  fs.writeFileSync(path.join(OUT, `${p.id}.svg`), render(p));
}
console.log(`✅ اتعمل ${products.length} صورة في ${path.relative(process.cwd(), OUT)}`);
