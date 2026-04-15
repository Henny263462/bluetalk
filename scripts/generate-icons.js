const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const rootDir = path.resolve(__dirname, '..');
const sourceSvgPath = path.join(rootDir, 'website', 'public', 'favicon.svg');
const assetsDir = path.join(rootDir, 'assets');
const outputPngPath = path.join(assetsDir, 'icon.png');
const outputIcoPath = path.join(assetsDir, 'icon.ico');
const outputSvgPath = path.join(assetsDir, 'icon.svg');

const BACKGROUND = [0x08, 0x11, 0x1f, 0xff];
const ORB_START = [0x60, 0xa5, 0xfa, 0xff];
const ORB_END = [0x25, 0x63, 0xeb, 0xff];
const CORE = [0xf8, 0xfa, 0xfc, 0xff];
const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256];
const MASTER_SIZE = 512;
const SUPERSAMPLE = 4;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixColor(start, end, t) {
  return [
    Math.round(lerp(start[0], end[0], t)),
    Math.round(lerp(start[1], end[1], t)),
    Math.round(lerp(start[2], end[2], t)),
    255,
  ];
}

function pointInRoundedRect(x, y, size, radius) {
  const right = size - radius;
  const bottom = size - radius;

  if (x >= radius && x <= right) return y >= 0 && y <= size;
  if (y >= radius && y <= bottom) return x >= 0 && x <= size;

  const cx = x < radius ? radius : right;
  const cy = y < radius ? radius : bottom;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function renderSample(x, y, size) {
  const rectRadius = (10 / 32) * size;
  if (!pointInRoundedRect(x, y, size, rectRadius)) {
    return [0, 0, 0, 0];
  }

  const center = size / 2;
  const orbRadius = (8 / 32) * size;
  const coreRadius = (3 / 32) * size;
  const dx = x - center;
  const dy = y - center;
  const distanceSquared = dx * dx + dy * dy;

  if (distanceSquared <= coreRadius * coreRadius) {
    return CORE;
  }

  if (distanceSquared <= orbRadius * orbRadius) {
    const t = Math.max(0, Math.min(1, (x + y) / (size * 2)));
    return mixColor(ORB_START, ORB_END, t);
  }

  return BACKGROUND;
}

function renderIcon(size) {
  const buffer = Buffer.alloc(size * size * 4);
  const step = 1 / SUPERSAMPLE;
  const weight = 1 / (SUPERSAMPLE * SUPERSAMPLE);

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const sample = renderSample(px + (sx + 0.5) * step, py + (sy + 0.5) * step, size);
          r += sample[0] * weight;
          g += sample[1] * weight;
          b += sample[2] * weight;
          a += sample[3] * weight;
        }
      }

      const offset = (py * size + px) * 4;
      buffer[offset] = Math.round(r);
      buffer[offset + 1] = Math.round(g);
      buffer[offset + 2] = Math.round(b);
      buffer[offset + 3] = Math.round(a);
    }
  }

  return buffer;
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function encodePng(size, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * stride, y * stride + stride);
  }

  return Buffer.concat([
    signature,
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function encodeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(images.length * 16);
  let offset = header.length + directory.length;

  images.forEach((image, index) => {
    const entryOffset = index * 16;
    directory[entryOffset] = image.size === 256 ? 0 : image.size;
    directory[entryOffset + 1] = image.size === 256 ? 0 : image.size;
    directory[entryOffset + 2] = 0;
    directory[entryOffset + 3] = 0;
    directory.writeUInt16LE(1, entryOffset + 4);
    directory.writeUInt16LE(32, entryOffset + 6);
    directory.writeUInt32LE(image.buffer.length, entryOffset + 8);
    directory.writeUInt32LE(offset, entryOffset + 12);
    offset += image.buffer.length;
  });

  return Buffer.concat([header, directory, ...images.map((image) => image.buffer)]);
}

fs.mkdirSync(assetsDir, { recursive: true });
fs.copyFileSync(sourceSvgPath, outputSvgPath);

const masterPng = encodePng(MASTER_SIZE, renderIcon(MASTER_SIZE));
const ico = encodeIco(
  ICON_SIZES.map((size) => ({
    size,
    buffer: encodePng(size, renderIcon(size)),
  }))
);

fs.writeFileSync(outputPngPath, masterPng);
fs.writeFileSync(outputIcoPath, ico);

console.log(`Generated ${path.relative(rootDir, outputSvgPath)}, ${path.relative(rootDir, outputPngPath)}, and ${path.relative(rootDir, outputIcoPath)}`);
