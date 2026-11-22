import { promises as fs } from 'node:fs';
import zlib from 'node:zlib';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: day };
}

/** 最小 ZIP 写入器：UTF-8 文件名，JPEG 直接存储，文本走 deflate。 */
export function createZip(filePath) {
  let handle = null;
  let offset = 0;
  const entries = [];

  async function open() {
    await fs.mkdir(filePath.replace(/[^/\\]+$/, ''), { recursive: true }).catch(() => {});
    handle = await fs.open(filePath, 'w');
  }

  async function add(name, data, { compress = false, mode = 0o644 } = {}) {
    if (!handle) await open();
    const nameBuf = Buffer.from(name.replace(/\\/g, '/'), 'utf8');
    const crc = crc32(data);
    const method = compress ? 8 : 0;
    const payload = compress ? zlib.deflateRawSync(data, { level: 6 }) : data;
    const { time, date } = dosTime();
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6);
    header.writeUInt16LE(method, 8);
    header.writeUInt16LE(time, 10);
    header.writeUInt16LE(date, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(payload.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(nameBuf.length, 26);
    header.writeUInt16LE(0, 28);
    await handle.write(header);
    await handle.write(nameBuf);
    await handle.write(payload);
    entries.push({ name: nameBuf, crc, method, csize: payload.length, usize: data.length, offset, time, date, mode });
    offset += header.length + nameBuf.length + payload.length;
    return { name, bytes: data.length };
  }

  async function addFile(name, file, options) {
    return add(name, await fs.readFile(file), options);
  }

  async function close() {
    if (!handle) await open();
    const start = offset;
    for (const entry of entries) {
      const header = Buffer.alloc(46);
      header.writeUInt32LE(0x02014b50, 0);
      header.writeUInt16LE(0x031e, 4);
      header.writeUInt16LE(20, 6);
      header.writeUInt16LE(0x0800, 8);
      header.writeUInt16LE(entry.method, 10);
      header.writeUInt16LE(entry.time, 12);
      header.writeUInt16LE(entry.date, 14);
      header.writeUInt32LE(entry.crc, 16);
      header.writeUInt32LE(entry.csize, 20);
      header.writeUInt32LE(entry.usize, 24);
      header.writeUInt16LE(entry.name.length, 28);
      header.writeUInt16LE(0, 30);
      header.writeUInt16LE(0, 32);
      header.writeUInt16LE(0, 34);
      header.writeUInt16LE(0, 36);
      header.writeUInt32LE((entry.mode << 16) >>> 0, 38);
      header.writeUInt32LE(entry.offset, 42);
      await handle.write(header);
      await handle.write(entry.name);
      offset += header.length + entry.name.length;
    }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(offset - start, 12);
    end.writeUInt32LE(start, 16);
    end.writeUInt16LE(0, 20);
    await handle.write(end);
    await handle.close();
    handle = null;
    return { entries: entries.length, bytes: offset + 22 };
  }

  return { add, addFile, close };
}
