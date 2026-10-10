// Code-drawn interface artwork; not a generated illustration or traced mascot.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const directory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets/phase-f');
const palette = ['163D2E', 'F47B2A', '9B4309', 'FFF7E9'];
const rgb = hex => [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
const fixed = k => ({ a: 0, k });
const animated = (points, ballistic = false) => ({ a: 1, k: points.map(([t, s], index) => ({ t, s, ...(index < points.length - 1 ? (s.every((value, channel) => value === points[index + 1][1][channel]) ? { h: 1 } : { e: points[index + 1][1], i: { x: [ballistic ? .667 : .3], y: [1] }, o: { x: [ballistic ? .333 : .16], y: [ballistic ? 0 : 1] } }) : {}) })) });
const layers = Array.from({ length: 24 }, (_, index) => {
  const color = palette[index % palette.length];
  const direction = (index / 23 - .5) * 2;
  const velocity = 190 + (index * 47 % 150);
  const start = [512 + (index % 3 - 1) * 9, 170, 0];
  const position = frame => {
    const t = frame / 72;
    return [start[0] + direction * velocity * t * 1.55, start[1] - (190 + index % 4 * 40) * t + 1120 * t * t, 0];
  };
  let shape;
  if (index % 3 === 0) shape = { ty: 'rc', d: 1, p: fixed([0, 0]), s: fixed([13 + index % 4 * 2, 25]), r: fixed(5), nm: 'Rounded confetti' };
  else if (index % 3 === 1) shape = { ty: 'el', d: 1, p: fixed([0, 0]), s: fixed([14, 14]), nm: 'Dot' };
  else {
    const v = [[0, -16], [4, -4], [16, 0], [4, 4], [0, 16], [-4, 4], [-16, 0], [-4, -4]];
    shape = { ty: 'sh', ks: fixed({ c: true, v, i: v.map(() => [0, 0]), o: v.map(() => [0, 0]) }), nm: 'Four point sparkle' };
  }
  const shapes = [shape, { ty: 'fl', c: fixed(rgb(color)), o: fixed(100), r: 1, nm: `#${color}` }];
  if (color === 'FFF7E9') shapes.push({ ty: 'st', c: fixed(rgb('163D2E')), o: fixed(100), w: fixed(2), lc: 2, lj: 2, ml: 4, nm: 'Forest outline on cream' });
  return { ddd: 0, ind: index + 1, ty: 4, nm: `Confetti ${index + 1}`, sr: 1,
    ks: { a: fixed([0, 0, 0]), p: animated([0, 12, 24, 36, 48, 60, 72].map(frame => [frame, position(frame)]), true),
      s: fixed([100, 100, 100]), r: animated([[0, [index * 13]], [72, [index * 13 + (index % 2 ? 270 : -240)]]]),
      o: animated([[0, [0]], [3, [100]], [48, [100]], [70, [0]], [72, [0]]]) },
    ao: 0, shapes, ip: 0, op: 70, st: 0, bm: 0 };
});
const animation = { v: '5.12.2', fr: 60, ip: 0, op: 72, w: 1024, h: 1024, nm: 'Catera confetti', ddd: 0, assets: [], layers, markers: [] };
await fs.mkdir(directory, { recursive: true });
const json = JSON.stringify(animation);
if (Buffer.byteLength(json) >= 150 * 1024) throw new Error('Confetti exceeds the brief size limit');
await fs.writeFile(path.join(directory, 'confetti.json'), json + '\n');
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toFile(path.join(directory, 'confetti-last-frame.png'));
console.log(`confetti.json: ${Buffer.byteLength(json)} bytes, 24 vector layers, 60fps, 1.2s; transparent last-frame poster`);
