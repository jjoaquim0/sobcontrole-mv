/**
 * Story 1.32 — Escritor ZIP mínimo (método STORE, sem compressão).
 *
 * Por que implementar em vez de importar uma biblioteca: o pacote do contador
 * contém CSVs pequenos e PDFs/imagens que já vêm comprimidos. Compressão
 * traria pouco ganho e uma dependência externa na Edge Function — que precisa
 * ser auditável e resolver offline. São ~100 linhas de formato estável desde
 * 1989, cobertas por teste.
 *
 * Referência: APPNOTE.TXT (PKWARE), seções 4.3.7 (local header), 4.3.12
 * (central directory) e 4.3.16 (end of central directory).
 */

export interface ZipEntry {
  name: string;
  data: Uint8Array;
  /** Data de modificação; usa época fixa quando ausente, para saída determinística. */
  date?: Date;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

export const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index += 1) {
    crc = CRC32_TABLE[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

/** Data/hora no formato MS-DOS usado pelo ZIP (2 bytes cada). */
const toDosDateTime = (date: Date): { time: number; date: number } => {
  const year = Math.max(1980, date.getUTCFullYear());
  return {
    time:
      (date.getUTCHours() << 11) |
      (date.getUTCMinutes() << 5) |
      Math.floor(date.getUTCSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
  };
};

class ByteWriter {
  private chunks: Uint8Array[] = [];
  private length = 0;

  push(bytes: Uint8Array): void {
    this.chunks.push(bytes);
    this.length += bytes.length;
  }

  u16(value: number): void {
    this.push(new Uint8Array([value & 0xff, (value >>> 8) & 0xff]));
  }

  u32(value: number): void {
    this.push(
      new Uint8Array([
        value & 0xff,
        (value >>> 8) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 24) & 0xff,
      ]),
    );
  }

  get size(): number {
    return this.length;
  }

  toUint8Array(): Uint8Array {
    const output = new Uint8Array(this.length);
    let offset = 0;
    for (const chunk of this.chunks) {
      output.set(chunk, offset);
      offset += chunk.length;
    }
    return output;
  }
}

export const createZip = (entries: ZipEntry[]): Uint8Array => {
  const encoder = new TextEncoder();
  const writer = new ByteWriter();
  const central: Array<{
    nameBytes: Uint8Array;
    crc: number;
    size: number;
    offset: number;
    time: number;
    date: number;
  }> = [];

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const checksum = crc32(entry.data);
    const { time, date } = toDosDateTime(entry.date ?? new Date(Date.UTC(1980, 0, 1)));
    const offset = writer.size;

    writer.u32(0x04034b50); // assinatura do local file header
    writer.u16(20); // versão mínima
    writer.u16(0x0800); // flag de nome em UTF-8
    writer.u16(0); // método STORE
    writer.u16(time);
    writer.u16(date);
    writer.u32(checksum);
    writer.u32(entry.data.length); // comprimido
    writer.u32(entry.data.length); // original
    writer.u16(nameBytes.length);
    writer.u16(0); // extra field
    writer.push(nameBytes);
    writer.push(entry.data);

    central.push({ nameBytes, crc: checksum, size: entry.data.length, offset, time, date });
  }

  const centralStart = writer.size;

  for (const item of central) {
    writer.u32(0x02014b50); // assinatura do central directory header
    writer.u16(20); // versão de criação
    writer.u16(20); // versão mínima
    writer.u16(0x0800);
    writer.u16(0);
    writer.u16(item.time);
    writer.u16(item.date);
    writer.u32(item.crc);
    writer.u32(item.size);
    writer.u32(item.size);
    writer.u16(item.nameBytes.length);
    writer.u16(0); // extra
    writer.u16(0); // comentário
    writer.u16(0); // disco
    writer.u16(0); // atributos internos
    writer.u32(0); // atributos externos
    writer.u32(item.offset);
    writer.push(item.nameBytes);
  }

  const centralSize = writer.size - centralStart;

  writer.u32(0x06054b50); // end of central directory
  writer.u16(0);
  writer.u16(0);
  writer.u16(central.length);
  writer.u16(central.length);
  writer.u32(centralSize);
  writer.u32(centralStart);
  writer.u16(0); // comentário

  return writer.toUint8Array();
};
