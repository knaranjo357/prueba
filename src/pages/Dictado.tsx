// src/pages/Dictado.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Mic,
  Square,
  Send,
  Trash2,
  Wand2,
  Loader2,
  RefreshCw,
  AudioLines,
  Printer,
  ArrowUpDown,
} from 'lucide-react';

/** ===== Tipos ===== */
type Clip = {
  id: string;
  blob: Blob;
  url: string;
  mime: string;
  size: number;
  durationSec?: number;
  createdAt: number;
};

type DictadoResponse = {
  tempId: string;
  transcripcion?: string;
  items?: Array<{
    sku?: string;
    nombre: string;
    qty: number;
    notas?: string;
    precio?: number;
  }>;
  total?: number;
  estado?: string;
  extra?: any;
};

/** Registros que vienen de /pedidos/dictado */
interface DictadoOrder {
  row_number: number;
  id_pedido?: string; // HHMMSS (opcional, pero lo reenviamos si viene)
  fecha: string;
  nombre?: string;
  numero: string;
  direccion: string;
  'detalle pedido': string;
  valor_restaurante: number;
  valor_domicilio: number;
  metodo_pago: string;
  estado: string;
}

/** ===== Config ===== */
const ENDPOINTS = {
  // Audio → n8n (puede seguir siendo el webhook que ya usas)
  audioDictado:
    'https://n8n.alliasoft.com/webhook/luisres/pedidos/dictado',
  correccion:
    'https://n8n.alliasoft.com/webhook/luisres/pedidos/correccion',
  correccionAudio:
    'https://n8n.alliasoft.com/webhook/luisres/pedidos/correccion_audio',

  // Lista de dictados (DB espejo)
  dictadoList: 'https://n8n.alliasoft.com/webhook/luisres/pedidos/dictado',

  // Modificar dictado
  dictadoModificar:
    'https://n8n.alliasoft.com/webhook/luis-res/pedidos/dictado/modificar',
} as const;

const BINARY_FIELD = 'audio';
const TARGET_SR = 48000;
const TARGET_CH = 1;
const MAX_PREVIEW_SEC = 60 * 30;

// Mesas rápidas y almacenamiento de meseros
const DEFAULT_MESAS = Array.from({ length: 20 }, (_, i) => `M${i + 1}`);
const EXTRA_MESAS = ['BARRA', 'DOMICILIO'];
const MESA_OPTIONS = [...DEFAULT_MESAS, ...EXTRA_MESAS];
const MESEROS_STORAGE_KEY = 'dictado_meseros_luisres_v1';

/** ===== Utilidades generales ===== */
const pickMimeType = () => {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const t of candidates) {
    // @ts-ignore
    if (
      window.MediaRecorder &&
      MediaRecorder.isTypeSupported &&
      MediaRecorder.isTypeSupported(t)
    )
      return t;
  }
  return '';
};

const fmtBytes = (b: number) =>
  b < 1024
    ? `${b} B`
    : b < 1024 * 1024
    ? `${(b / 1024).toFixed(1)} KB`
    : `${(b / 1024 / 1024).toFixed(1)} MB`;

const secToClock = (s?: number) =>
  s == null
    ? '—'
    : `${Math.floor(s / 60)}`.padStart(2, '0') +
      ':' +
      `${Math.floor(s % 60)}`.padStart(2, '0');

/** ===== WAV encoder (16-bit PCM) ===== */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const frames = buffer.length;

  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numCh; ch++) channelData.push(buffer.getChannelData(ch));

  const samples = frames * numCh;
  const pcm = new Int16Array(samples);
  let o = 0;
  for (let i = 0; i < frames; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      let v = channelData[ch][i];
      v = Math.max(-1, Math.min(1, v));
      pcm[o++] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
  }

  const blockAlign = numCh * 2;
  const byteRate = sr * blockAlign;
  const dataSize = pcm.length * 2;
  const ab = new ArrayBuffer(44 + dataSize);
  const dv = new DataView(ab);

  let p = 0;
  const ws = (s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(p++, s.charCodeAt(i));
  };
  const w32 = (v: number) => {
    dv.setUint32(p, v, true);
    p += 4;
  };
  const w16 = (v: number) => {
    dv.setUint16(p, v, true);
    p += 2;
  };

  ws('RIFF');
  w32(36 + dataSize);
  ws('WAVE');
  ws('fmt ');
  w32(16);
  w16(1);
  w16(numCh);
  w32(sr);
  w32(byteRate);
  w16(blockAlign);
  w16(16);
  ws('data');
  w32(dataSize);
  for (let i = 0; i < pcm.length; i++) dv.setInt16(p + i * 2, pcm[i], true);

  return new Blob([ab], { type: 'audio/wav' });
}

/** Downmix + resample vía OfflineAudioContext */
async function resampleBuffer(
  src: AudioBuffer,
  targetSR = TARGET_SR,
  targetCH = TARGET_CH,
): Promise<AudioBuffer> {
  const length = Math.ceil(src.duration * targetSR);
  const offline = new OfflineAudioContext(targetCH, length, targetSR);
  const source = offline.createBufferSource();
  source.buffer = src;
  source.connect(offline.destination);
  source.start();
  return offline.startRendering();
}

async function decodeBlobToBuffer(
  blob: Blob,
  ac: AudioContext,
): Promise<AudioBuffer> {
  const ab = await blob.arrayBuffer();
  return await new Promise<AudioBuffer>((resolve, reject) => {
    ac.decodeAudioData(ab.slice(0), resolve, reject);
  });
}

/** Concatena clips → WAV */
async function concatAsWav(
  clips: Clip[],
): Promise<{ blob: Blob; durationSec: number }> {
  if (!clips.length) throw new Error('No hay clips para combinar.');
  const ac = new AudioContext({ sampleRate: TARGET_SR });
  const processed: AudioBuffer[] = [];
  for (const c of [...clips].reverse()) {
    const buf = await decodeBlobToBuffer(c.blob, ac);
    const r = await resampleBuffer(buf, TARGET_SR, TARGET_CH);
    processed.push(r);
  }
  const totalFrames = processed.reduce((s, b) => s + b.length, 0);
  const out = new AudioBuffer({
    numberOfChannels: TARGET_CH,
    sampleRate: TARGET_SR,
    length: totalFrames,
  });
  let offset = 0;
  for (const b of processed) {
    out.getChannelData(0).set(b.getChannelData(0), offset);
    offset += b.length;
  }
  const wav = audioBufferToWavBlob(out);
  return { blob: wav, durationSec: out.length / out.sampleRate };
}

/** ===== Helpers para impresión estilo ESC/POS + HTML ===== */
const COLS = 42;
const repeat = (ch: string, n: number) =>
  Array(Math.max(0, n))
    .fill(ch)
    .join('');
const padRight = (s: string, n: number) =>
  s.length >= n ? s.slice(0, n) : s + repeat(' ', n - s.length);
const center = (s: string) => {
  const len = Math.min(s.length, COLS);
  const left = Math.floor((COLS - len) / 2);
  return repeat(' ', Math.max(0, left)) + s.slice(0, COLS);
};
const money = (n: number) => `$${(n || 0).toLocaleString('es-CO')}`;

const sanitizeForTicket = (s: string): string =>
  (s || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();

const wrapText = (text: string, width: number): string[] => {
  const rawTokens = (text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!rawTokens.length) return [''];
  const tokens: string[] = [];
  for (const t of rawTokens) {
    if (t.length <= width) tokens.push(t);
    else {
      for (let i = 0; i < t.length; i += width) tokens.push(t.slice(i, i + width));
    }
  }
  const lines: string[] = [];
  let line = '';
  for (const tok of tokens) {
    if (!line.length) line = tok;
    else if ((line + ' ' + tok).length <= width) line += ' ' + tok;
    else {
      lines.push(line);
      line = tok;
    }
  }
  if (line) lines.push(line);
  return lines;
};

const wrapLabelValue = (label: string, value: string): string[] => {
  const prefix = `${label}: `;
  const valueWidth = Math.max(0, COLS - prefix.length);
  const vLines = wrapText(value || '', valueWidth);
  if (!vLines.length) return [padRight(prefix, COLS)];
  const out: string[] = [];
  out.push(padRight(prefix + vLines[0], COLS));
  const indent = repeat(' ', prefix.length);
  for (let i = 1; i < vLines.length; i++)
    out.push(padRight(indent + vLines[i], COLS));
  return out;
};

const totalLine = (label: string, amount: number): string => {
  const right = money(amount);
  const leftWidth = COLS - right.length - 1;
  return padRight(label, leftWidth) + ' ' + right;
};

const parseMoneyToInt = (s: string): number => {
  const n = parseInt((s || '').replace(/[^0-9\-]/g, ''), 10);
  return isNaN(n) ? 0 : n;
};

const splitOutsideParens = (s: string, separators = [';']): string[] => {
  const sepSet = new Set(separators);
  const out: string[] = [];
  let buf = '';
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && sepSet.has(ch)) {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
};

const splitByCommaOutsideParens = (s: string): string[] =>
  splitOutsideParens(s, [',']);

const parseDetails = (raw: string) => {
  if (!raw) return [];
  const itemStrings = splitOutsideParens(raw, [';', '|'])
    .map((x) => x.trim())
    .filter(Boolean);
  return itemStrings.map((itemStr) => {
    const parts = splitByCommaOutsideParens(itemStr)
      .map((x) => x.trim())
      .filter(Boolean);
    let quantity = '';
    let name = '';
    let priceNum = 0;
    if (parts.length >= 3) {
      quantity = parts[0].replace(/^-/, '').trim() || '1';
      name = parts.slice(1, parts.length - 1).join(', ').trim();
      priceNum = parseMoneyToInt(parts[parts.length - 1]);
    } else if (parts.length === 2) {
      quantity = '1';
      name = parts[0];
      priceNum = parseMoneyToInt(parts[1]);
    } else {
      quantity = '1';
      name = parts[0] || '';
      priceNum = 0;
    }
    const qMatch = quantity.match(/-?\d+/);
    if (qMatch) quantity = String(Math.abs(parseInt(qMatch[0], 10)));
    else quantity = '1';
    return { quantity, name, priceNum };
  });
};

const formatItemBlock = (
  qty: string,
  name: string,
  priceNum: number,
): string[] => {
  const price = money(priceNum);
  const qtyLabel = qty ? `${qty} ` : '';
  const rightWidth = price.length + 1;
  const leftWidth = COLS - rightWidth;
  const leftText = (qtyLabel + (name || '')).trim();
  const leftLines = wrapText(leftText, leftWidth);
  const out: string[] = [];
  const firstLeft = padRight(leftLines[0] || '', leftWidth);
  out.push(firstLeft + ' ' + price);
  const indent = repeat(' ', qtyLabel.length || 0);
  for (let i = 1; i < leftLines.length; i++)
    out.push(padRight(indent + leftLines[i], COLS));
  return out;
};

/** ===== ESC/POS + RawBT ===== */
const bytesToBase64 = (bytes: number[]): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

// Mapa CP1252 usando escapes Unicode (evita problemas de encoding)
const cp1252Map: Record<string, number> = {
  '\u00C1': 0xc1, // Á
  '\u00C9': 0xc9, // É
  '\u00CD': 0xcd, // Í
  '\u00D3': 0xd3, // Ó
  '\u00DA': 0xda, // Ú
  '\u00DC': 0xdc, // Ü
  '\u00D1': 0xd1, // Ñ
  '\u00E1': 0xe1, // á
  '\u00E9': 0xe9, // é
  '\u00ED': 0xed, // í
  '\u00F3': 0xf3, // ó
  '\u00FA': 0xfa, // ú
  '\u00FC': 0xfc, // ü
  '\u00F1': 0xf1, // ñ
  '\u20AC': 0x80, // €
  '\u00A3': 0xa3, // £
  '\u00A5': 0xa5, // ¥
  '\u00A2': 0xa2, // ¢
  '\u00B0': 0xb0, // °
  '\u00BF': 0xbf, // ¿
  '\u00A1': 0xa1, // ¡
  '\u201C': 0x93, // “
  '\u201D': 0x94, // ”
  '\u2018': 0x91, // ‘
  '\u2019': 0x92, // ’
  '\u2014': 0x97, // —
  '\u2013': 0x96, // –
  '\u2026': 0x85, // …
};

const asciiFallback: Record<string, string> = {
  '\u201C': '"',
  '\u201D': '"',
  '\u2018': "'",
  '\u2019': "'",
  '\u2014': '-',
  '\u2013': '-',
  '\u2026': '...',
  '\u20AC': 'EUR',
};

const encodeCP1252 = (str: string): number[] => {
  const bytes: number[] = [];
  for (const ch of str) {
    const code = ch.codePointAt(0)!;
    if (code <= 0x7f) {
      bytes.push(code);
      continue;
    }
    if (cp1252Map[ch] !== undefined) {
      bytes.push(cp1252Map[ch]);
      continue;
    }
    const basic = ch
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (basic.length === 1 && basic.charCodeAt(0) <= 0x7f) {
      bytes.push(basic.charCodeAt(0));
      continue;
    }
    if (asciiFallback[ch]) {
      for (const c of asciiFallback[ch])
        bytes.push(c.charCodeAt(0));
      continue;
    }
    bytes.push(0x3f); // '?'
  }
  return bytes;
};

const TICKET_FONT_PX = 16;
const DETAILS_FONT_PX = 18;
const LINE_HEIGHT = 1.32;

const GENERAL_HEIGHT_MULT = 1;
const DETAILS_HEIGHT_MULT = 2;
const GENERAL_WIDTH_MULT = 1;
const DETAILS_WIDTH_MULT = 1;

const buildEscposFromLines = (lines: string[]): number[] => {
  const bytes: number[] = [];
  bytes.push(0x1b, 0x40); // init
  bytes.push(0x1b, 0x74, 0x10); // codepage 16 = CP1252
  bytes.push(0x1b, 0x61, 0x00); // left
  bytes.push(0x1d, 0x21, 0x01); // doble altura
  const body = lines.join('\n') + '\n';
  bytes.push(...encodeCP1252(body));
  bytes.push(0x0a, 0x0a, 0x0a);
  bytes.push(0x1d, 0x56, 0x00); // corte
  return bytes;
};

const isAndroid = (): boolean =>
  typeof navigator !== 'undefined' &&
  /Android/i.test(navigator.userAgent || '');

const sendToRawBT = async (ticketLines: string[]): Promise<void> => {
  if (!isAndroid())
    throw new Error(
      'Esta impresión directa requiere Android con RawBT instalado.',
    );
  const escposBytes = buildEscposFromLines(ticketLines);
  const base64 = bytesToBase64(escposBytes);
  const url = `rawbt:base64,${base64}`;
  try {
    (window as any).location.href = url;
    return;
  } catch {}
  try {
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  } catch {}
  throw new Error(
    'No se pudo invocar RawBT. Verifica que RawBT esté instalado y el servicio activo.',
  );
};

const makeSizeByte = (heightMul = 1, widthMul = 1): number =>
  ((Math.max(1, widthMul) - 1) << 4) | (Math.max(1, heightMul) - 1);

const buildEscposTicket = (
  normalBefore: string[],
  detailLines: string[],
  normalAfter: string[],
): number[] => {
  const bytes: number[] = [];
  const enc = (arr: string[]) =>
    encodeCP1252(arr.join('\n') + '\n');

  // Init
  bytes.push(0x1b, 0x40);
  bytes.push(0x1b, 0x74, 0x10);
  bytes.push(0x1b, 0x61, 0x00);

  // General
  bytes.push(
    0x1d,
    0x21,
    makeSizeByte(GENERAL_HEIGHT_MULT, GENERAL_WIDTH_MULT),
  );
  bytes.push(...enc(normalBefore));

  // Detalles (más grandes)
  bytes.push(
    0x1d,
    0x21,
    makeSizeByte(DETAILS_HEIGHT_MULT, DETAILS_WIDTH_MULT),
  );
  bytes.push(...enc(detailLines));

  // De nuevo general
  bytes.push(
    0x1d,
    0x21,
    makeSizeByte(GENERAL_HEIGHT_MULT, GENERAL_WIDTH_MULT),
  );
  bytes.push(...enc(normalAfter));

  bytes.push(0x0a, 0x0a, 0x0a);
  bytes.push(0x1d, 0x56, 0x00);
  return bytes;
};

const sendToRawBTSections = async (
  normalBefore: string[],
  detailLines: string[],
  normalAfter: string[],
): Promise<void> => {
  if (!isAndroid())
    throw new Error(
      'Esta impresión directa requiere Android con RawBT instalado.',
    );
  const escposBytes = buildEscposTicket(
    normalBefore,
    detailLines,
    normalAfter,
  );
  const base64 = bytesToBase64(escposBytes);
  const url = `rawbt:base64,${base64}`;
  try {
    (window as any).location.href = url;
    return;
  } catch {}
  try {
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  } catch {}
  throw new Error(
    'No se pudo invocar RawBT. Verifica que RawBT esté instalado y el servicio activo.',
  );
};

/** ===== Estados permitidos ===== */
const allowedStatuses = [
  'pidiendo',
  'confirmado',
  'impreso',
  'preparando',
  'en camino',
  'entregado',
] as const;

const getStatusUI = (estado?: string) => {
  const s = (estado || '').toLowerCase().trim();
  if (s === 'pidiendo') {
    return {
      card: 'bg-yellow-50 border-yellow-200',
      badge: 'bg-yellow-100 text-yellow-800',
    };
  }
  if (s === 'confirmado') {
    return {
      card: 'bg-orange-50 border-orange-200',
      badge: 'bg-orange-100 text-orange-800',
    };
  }
  return {
    card: 'bg-green-100 border-green-300',
    badge: 'bg-green-200 text-green-900',
  };
};

/** ===== Payload para modificar dictado ===== */
const buildDictadoPayload = (
  o: DictadoOrder,
  override?: Partial<DictadoOrder>,
) => {
  const merged = { ...o, ...(override || {}) };
  return {
    row_number: merged.row_number,
    id_pedido: (merged as any).id_pedido ?? '',
    fecha: merged.fecha ?? '',
    nombre: merged.nombre ?? '',
    numero: merged.numero ?? '',
    direccion: merged.direccion ?? '',
    detalle_pedido: merged['detalle pedido'] ?? '',
    valor_restaurante: merged.valor_restaurante ?? 0,
    valor_domicilio: merged.valor_domicilio ?? 0,
    metodo_pago: merged.metodo_pago ?? '',
    estado: merged.estado ?? '',
  };
};

const postDictadoModificar = async (
  o: DictadoOrder,
  override?: Partial<DictadoOrder>,
) => {
  const payload = buildDictadoPayload(o, override);
  const response = await fetch(ENDPOINTS.dictadoModificar, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
};

/** ===== Componente principal ===== */
const Dictado: React.FC = () => {
  /** ===== Meta comanda (grabación) ===== */
  const [restauranteId, setRestauranteId] = useState('LUISRES');
  const [mesaId, setMesaId] = useState('');
  const [meseroId, setMeseroId] = useState('');
  const [lang, setLang] = useState<'es-CO' | 'es-MX' | 'es-ES'>('es-CO');
  const [meserosGuardados, setMeserosGuardados] = useState<string[]>([]);

  // Grabación
  const [micReady, setMicReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<number | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Flujo backend (respuesta inmediata del agente)
  const [sending, setSending] = useState(false);
  const [respuesta, setRespuesta] = useState<DictadoResponse | null>(null);
  const [editedTranscripcion, setEditedTranscripcion] = useState('');
  const [loadingCorreccion, setLoadingCorreccion] = useState(false);

  // Corrección por voz
  const [recCorr, setRecCorr] = useState(false);
  const corrChunksRef = useRef<BlobPart[]>([]);
  const corrRecRef = useRef<MediaRecorder | null>(null);
  const corrStreamRef = useRef<MediaStream | null>(null);
  const [corrClip, setCorrClip] = useState<Clip | null>(null);

  // Preview combinado
  const [combinedUrl, setCombinedUrl] = useState<string | null>(null);
  const [combinedInfo, setCombinedInfo] = useState<{
    size: number;
    durationSec: number;
  } | null>(null);

  const canEnviar = useMemo(
    () =>
      clips.length > 0 &&
      !sending &&
      !!mesaId.trim() &&
      !!meseroId.trim(),
    [clips.length, sending, mesaId, meseroId],
  );

  /** ===== Listado de dictados (DB espejo) ===== */
  const [dictadoOrders, setDictadoOrders] = useState<DictadoOrder[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterPayment, setFilterPayment] = useState<string>('todos');
  const [sortBy, setSortBy] = useState<'fecha' | 'row_number'>('row_number');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Edición
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editNumero, setEditNumero] = useState('');
  const [editDireccion, setEditDireccion] = useState('');
  const [editDetalle, setEditDetalle] = useState('');
  const [editValorRest, setEditValorRest] = useState(0);
  const [editValorDom, setEditValorDom] = useState(0);
  const [editMetodoPago, setEditMetodoPago] = useState('');

  /** ===== Meseros guardados (localStorage) ===== */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(MESEROS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setMeserosGuardados(parsed.filter((x) => typeof x === 'string'));
        }
      }
    } catch {
      // ignorar
    }
  }, []);

  const registrarMesero = useCallback((nombre: string) => {
    const clean = nombre.trim();
    if (!clean) return;
    setMeserosGuardados((prev) => {
      if (prev.includes(clean)) return prev;
      const updated = [clean, ...prev].slice(0, 8);
      try {
        window.localStorage.setItem(
          MESEROS_STORAGE_KEY,
          JSON.stringify(updated),
        );
      } catch {
        // ignorar
      }
      return updated;
    });
  }, []);

  /** ===== Permisos micrófono ===== */
  const ensureMic = useCallback(async () => {
    try {
      if (streamRef.current) {
        setMicReady(true);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      setMicReady(true);
    } catch {
      setErrorMsg(
        'No se pudo acceder al micrófono. Otorga permisos y vuelve a intentar.',
      );
      setMicReady(false);
    }
  }, []);

  useEffect(() => {
    void ensureMic();
  }, [ensureMic]);

  useEffect(
    () => () => {
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {}
      try {
        corrStreamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {}
      clips.forEach((c) => URL.revokeObjectURL(c.url));
      if (combinedUrl) URL.revokeObjectURL(combinedUrl);
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  /** ===== Timer grabación ===== */
  const startTimer = () => {
    setTimer(0);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(
      () => setTimer((prev) => prev + 1),
      1000,
    );
  };
  const stopTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  /** ===== Start / stop grabación principal ===== */
  const startRecording = async () => {
    setErrorMsg('');
    if (!micReady) await ensureMic();
    if (!streamRef.current) {
      setErrorMsg('Micrófono no disponible.');
      return;
    }
    const mimeType = pickMimeType();
    const rec = new MediaRecorder(
      streamRef.current,
      mimeType ? { mimeType } : undefined,
    );
    chunksRef.current = [];
    rec.ondataavailable = (e: any) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstart = () => {
      setRecording(true);
      startTimer();
    };
    rec.onstop = async () => {
      stopTimer();
      setRecording(false);
      const blob = new Blob(chunksRef.current, {
        type: rec.mimeType || 'audio/webm',
      });
      const url = URL.createObjectURL(blob);
      const id = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const clip: Clip = {
        id,
        blob,
        url,
        mime: blob.type || 'audio/webm',
        size: blob.size,
        createdAt: Date.now(),
      };
      try {
        const a = new Audio(url);
        await new Promise<void>((res, rej) => {
          a.onloadedmetadata = () => res();
          a.onerror = () => rej(new Error('No metadata'));
        });
        clip.durationSec = isFinite(a.duration) ? a.duration : undefined;
      } catch {}
      setClips((prev) => {
        if (combinedUrl) {
          URL.revokeObjectURL(combinedUrl);
          setCombinedUrl(null);
          setCombinedInfo(null);
        }
        return [clip, ...prev];
      });
    };
    recRef.current = rec;
    rec.start();
  };

  const stopRecording = () => {
    try {
      recRef.current?.stop();
    } catch {}
  };

  /** Eliminar clip */
  const deleteClip = (id: string) => {
    setClips((prev) => {
      const c = prev.find((x) => x.id === id);
      if (c) URL.revokeObjectURL(c.url);
      return prev.filter((x) => x.id !== id);
    });
    if (combinedUrl) {
      URL.revokeObjectURL(combinedUrl);
      setCombinedUrl(null);
      setCombinedInfo(null);
    }
  };

  /** Construir WAV combinado */
  const buildCombinedWav = useCallback(async (): Promise<Blob> => {
    const { blob, durationSec } = await concatAsWav(clips);
    if (combinedUrl) URL.revokeObjectURL(combinedUrl);
    const url = URL.createObjectURL(blob);
    setCombinedUrl(url);
    setCombinedInfo({
      size: blob.size,
      durationSec: Math.min(durationSec, MAX_PREVIEW_SEC),
    });
    return blob;
  }, [clips, combinedUrl]);

  /** Enviar dictado (audio + meta) */
  const enviarDictado = async () => {
    if (!clips.length || !mesaId.trim() || !meseroId.trim()) return;
    registrarMesero(meseroId);
    setSending(true);
    setErrorMsg('');
    try {
      let combinedBlob: Blob | null = null;
      try {
        combinedBlob = await buildCombinedWav();
      } catch (e: any) {
        console.warn(
          'Falló combinación en cliente, enviando 1er clip como fallback:',
          e?.message,
        );
      }

      // ID de pedido HHMMSS
      const now = new Date();
      const hh = `${now.getHours()}`.padStart(2, '0');
      const mm = `${now.getMinutes()}`.padStart(2, '0');
      const ss = `${now.getSeconds()}`.padStart(2, '0');
      const id_pedido = `${hh}${mm}${ss}`;

      const fd = new FormData();
      fd.append('restauranteId', restauranteId);
      fd.append('mesaId', mesaId.trim());
      fd.append('meseroId', meseroId.trim());
      fd.append('lang', lang);
      fd.append('id_pedido', id_pedido);

      if (combinedBlob) {
        fd.append(BINARY_FIELD, combinedBlob, 'pedido.wav');
      } else {
        const first = clips[clips.length - 1];
        fd.append(BINARY_FIELD, first.blob, 'pedido.wav');
      }

      const res = await fetch(ENDPOINTS.audioDictado, {
        method: 'POST',
        body: fd,
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DictadoResponse;
      setRespuesta(json);
      setEditedTranscripcion(json.transcripcion || '');

      // Tras enviar, recargar lista de dictados
      fetchDictadoOrders();
      setTimeout(() => {
        const el = document.getElementById('dictado-resumen');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } catch (e: any) {
      setErrorMsg(e?.message || 'No se pudo enviar la comanda.');
    } finally {
      setSending(false);
    }
  };

  /** Corrección por TEXTO (sobre tempId) */
  const aplicarCorreccionTexto = async () => {
    if (!respuesta?.tempId) return;
    setLoadingCorreccion(true);
    setErrorMsg('');
    try {
      const body = {
        tempId: respuesta.tempId,
        cambios: { transcripcion: editedTranscripcion },
      };
      const res = await fetch(ENDPOINTS.correccion, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DictadoResponse;
      setRespuesta(json);
      setEditedTranscripcion(json.transcripcion || '');
    } catch (e: any) {
      setErrorMsg(e?.message || 'No se pudo aplicar la corrección.');
    } finally {
      setLoadingCorreccion(false);
    }
  };

  /** Corrección por VOZ (tempId + audio) */
  const startRecCorr = async () => {
    setErrorMsg('');
    try {
      if (!corrStreamRef.current) {
        corrStreamRef.current =
          await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
          });
      }
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(
        corrStreamRef.current!,
        mimeType ? { mimeType } : undefined,
      );
      corrChunksRef.current = [];
      rec.ondataavailable = (e: any) => {
        if (e.data && e.data.size > 0) corrChunksRef.current.push(e.data);
      };
      rec.onstart = () => setRecCorr(true);
      rec.onstop = () => {
        setRecCorr(false);
        const blob = new Blob(corrChunksRef.current, {
          type: rec.mimeType || 'audio/webm',
        });
        const url = URL.createObjectURL(blob);
        const id = `corr-${Date.now()}`;
        setCorrClip({
          id,
          blob,
          url,
          mime: blob.type,
          size: blob.size,
          createdAt: Date.now(),
        });
      };
      corrRecRef.current = rec;
      rec.start();
    } catch {
      setErrorMsg('No se pudo iniciar la grabación de corrección.');
    }
  };
  const stopRecCorr = () => {
    try {
      corrRecRef.current?.stop();
    } catch {}
  };

  const enviarCorreccionAudio = async () => {
    if (!respuesta?.tempId || !corrClip) return;
    setLoadingCorreccion(true);
    setErrorMsg('');
    try {
      const fd = new FormData();
      fd.append('tempId', respuesta.tempId);
      fd.append(BINARY_FIELD, corrClip.blob, 'correccion.wav');
      const res = await fetch(ENDPOINTS.correccionAudio, {
        method: 'POST',
        body: fd,
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DictadoResponse;
      setRespuesta(json);
      setEditedTranscripcion(json.transcripcion || '');
      URL.revokeObjectURL(corrClip.url);
      setCorrClip(null);
    } catch (e: any) {
      setErrorMsg(e?.message || 'No se pudo enviar la corrección por audio.');
    } finally {
      setLoadingCorreccion(false);
    }
  };

  /** ===== Listado de dictados: fetch periódico ===== */
  const fetchDictadoOrders = useCallback(async () => {
    try {
      const response = await fetch(ENDPOINTS.dictadoList, {
        cache: 'no-store',
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setDictadoOrders(data as DictadoOrder[]);
      }
    } catch (e) {
      console.error('Error fetching dictado orders:', e);
    }
  }, []);

  useEffect(() => {
    fetchDictadoOrders();
    const interval = setInterval(fetchDictadoOrders, 20000);
    return () => clearInterval(interval);
  }, [fetchDictadoOrders]);

  /** Entrar a editar un dictado */
  const startEdit = (o: DictadoOrder) => {
    setEditingId(o.row_number);
    setEditNombre(o.nombre || '');
    setEditNumero(o.numero || '');
    setEditDireccion(o.direccion || '');
    setEditDetalle(o['detalle pedido'] || '');
    setEditValorRest(o.valor_restaurante || 0);
    setEditValorDom(o.valor_domicilio || 0);
    setEditMetodoPago(o.metodo_pago || '');
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (o: DictadoOrder) => {
    const updated: DictadoOrder = {
      ...o,
      nombre: editNombre,
      numero: editNumero,
      direccion: editDireccion,
      'detalle pedido': editDetalle,
      valor_restaurante: editValorRest,
      valor_domicilio: editValorDom,
      metodo_pago: editMetodoPago,
    };
    setDictadoOrders((prev) =>
      prev.map((x) => (x.row_number === o.row_number ? updated : x)),
    );
    try {
      await postDictadoModificar(o, {
        nombre: editNombre,
        numero: editNumero,
        direccion: editDireccion,
        'detalle pedido': editDetalle,
        valor_restaurante: editValorRest,
        valor_domicilio: editValorDom,
        metodo_pago: editMetodoPago,
      });
      setEditingId(null);
    } catch (e) {
      console.error(e);
      alert('No se pudo guardar los cambios en dictado.');
      fetchDictadoOrders();
      setEditingId(null);
    }
  };

  // Auto-cálculo valor_restaurante al editar detalle
  useEffect(() => {
    if (editingId === null) return;
    const sum = parseDetails(editDetalle).reduce(
      (acc, it) => acc + (it.priceNum || 0),
      0,
    );
    setEditValorRest(sum);
  }, [editDetalle, editingId]);

  /** Actualizar solo estado del dictado */
  const updateOrderEstado = async (
    order: DictadoOrder,
    newStatus: string,
  ) => {
    const updated = { ...order, estado: newStatus };
    setDictadoOrders((prev) =>
      prev.map((o) => (o.row_number === order.row_number ? updated : o)),
    );
    try {
      await postDictadoModificar(order, { estado: newStatus });
    } catch (error) {
      console.error('Error updating dictado status:', error);
      setDictadoOrders((prev) =>
        prev.map((o) => (o.row_number === order.row_number ? order : o)),
      );
      alert('No se pudo actualizar el estado. Intenta nuevamente.');
    }
  };

  /** Impresión de un pedido dictado */
  const printDictadoOrder = async (order: DictadoOrder) => {
    const nombre = sanitizeForTicket(order.nombre || 'Cliente');
    const numero = order.numero || '';
    const items = parseDetails(order['detalle pedido'] || '');
    const subtotal = order.valor_restaurante || 0;
    const domicilio = order.valor_domicilio || 0;
    const total = subtotal + domicilio;

    const before: string[] = [];
    const detail: string[] = [];
    const after: string[] = [];

    before.push(repeat('=', COLS));
    before.push(center('LUIS RES'));
    before.push(center('Cra 37 #109-24'));
    before.push(center('Floridablanca - Caldas'));
    before.push(repeat('=', COLS));
    before.push(
      padRight(`PEDIDO #${order.row_number}`, COLS),
    );
    if (order.id_pedido) {
      before.push(
        padRight(`ID: ${order.id_pedido}`, COLS),
      );
    }
    before.push(
      ...wrapLabelValue(
        'Fecha',
        sanitizeForTicket(order.fecha || ''),
      ),
    );
    before.push(...wrapLabelValue('Nombre', nombre));
    before.push(
      ...wrapLabelValue('Mesa / Número', numero),
    );
    before.push(
      ...wrapLabelValue(
        'Dirección',
        sanitizeForTicket(order.direccion || ''),
      ),
    );
    before.push(repeat('-', COLS));

    detail.push(center('DETALLE DEL PEDIDO'));
    detail.push(repeat('-', COLS));
    items.forEach(({ quantity, name, priceNum }) => {
      const block = formatItemBlock(
        quantity || '1',
        sanitizeForTicket(name),
        priceNum,
      );
      block.forEach((l) => detail.push(l));
    });
    detail.push(repeat('-', COLS));

    after.push(totalLine('Subtotal', subtotal));
    after.push(totalLine('Domicilio', domicilio));
    after.push(totalLine('TOTAL', total));
    after.push('');
    after.push(
      ...wrapLabelValue(
        'Método de pago',
        sanitizeForTicket(order.metodo_pago || ''),
      ),
    );
    after.push(
      ...wrapLabelValue(
        'Estado',
        sanitizeForTicket(order.estado || ''),
      ),
    );
    after.push(repeat('=', COLS));
    after.push(center('¡Gracias por su compra!'));
    after.push(repeat('=', COLS));

    // ANDROID → ESC/POS
    if (isAndroid()) {
      try {
        await sendToRawBTSections(before, detail, after);
        const updated = { ...order, estado: 'impreso' as string };
        setDictadoOrders((prev) =>
          prev.map((o) =>
            o.row_number === order.row_number ? updated : o,
          ),
        );
        await postDictadoModificar(order, { estado: 'impreso' });
        return;
      } catch (e1: any) {
        console.warn(
          'ESC/POS secciones falló, probando simple:',
          e1?.message,
        );
      }
      try {
        const allLines = [...before, ...detail, ...after];
        await sendToRawBT(allLines);
        const updated = { ...order, estado: 'impreso' as string };
        setDictadoOrders((prev) =>
          prev.map((o) =>
            o.row_number === order.row_number ? updated : o,
          ),
        );
        await postDictadoModificar(order, { estado: 'impreso' });
        return;
      } catch (e2: any) {
        console.warn(
          'ESC/POS simple falló, usando ventana navegador:',
          e2?.message,
        );
      }
    }

    // PC / fallback HTML
    const esc = (s: string) =>
      (s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const itemsHtml = items
      .map(
        ({ quantity, name, priceNum }) => `
      <div class="row item">
        <div class="qty">${esc(quantity || '1')}</div>
        <div class="name">${esc(sanitizeForTicket(name))}</div>
        <div class="price">${esc(money(priceNum))}</div>
      </div>
    `,
      )
      .join('');

    const innerHtml = `
      <div class="ticket">
        <div class="header">
          <div class="h1">LUIS RES</div>
          <div class="h2">Cra 37 #109-24</div>
          <div class="h2">Floridablanca - Caldas</div>
        </div>

        <div class="hr"></div>

        <div class="meta">
          <div class="kv"><span class="k">PEDIDO</span><span class="v">#${
            order.row_number
          }</span></div>
          ${
            order.id_pedido
              ? `<div class="kv"><span class="k">ID</span><span class="v">${esc(
                  order.id_pedido,
                )}</span></div>`
              : ''
          }
          <div class="kv"><span class="k">Fecha</span><span class="v">${esc(
            order.fecha || '',
          )}</span></div>
          <div class="kv"><span class="k">Nombre</span><span class="v">${esc(
            nombre,
          )}</span></div>
          <div class="kv"><span class="k">Mesa / Número</span><span class="v">${esc(
            numero,
          )}</span></div>
          <div class="kv"><span class="k">Dirección</span><span class="v">${esc(
            order.direccion || '',
          )}</span></div>
        </div>

        <div class="hr"></div>

        <div class="section-title">DETALLE DEL PEDIDO</div>

        <div class="items">
          ${itemsHtml}
        </div>

        <div class="hr"></div>

        <div class="totals">
          <div class="row"><span>Subtotal</span><span class="val">${esc(
            money(subtotal),
          )}</span></div>
          <div class="row"><span>Domicilio</span><span class="val">${esc(
            money(domicilio),
          )}</span></div>
          <div class="row strong"><span>TOTAL</span><span class="val">${esc(
            money(total),
          )}</span></div>
        </div>

        <div class="extra">
          <div class="kv"><span class="k">Método de pago</span><span class="v">${esc(
            order.metodo_pago || '',
          )}</span></div>
          <div class="kv"><span class="k">Estado</span><span class="v">${esc(
            order.estado || '',
          )}</span></div>
        </div>

        <div class="hr"></div>

        <div class="footer">¡Gracias por su compra!</div>
      </div>
    `;

    const fullHtml = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <title>Pedido #${order.row_number}</title>
          <style>
            @media print { @page { size: 80mm auto; margin: 0; } }
            * { box-sizing: border-box; }
            html, body { margin: 0; padding: 0; }
            body {
              font-family: "Courier New", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
              font-variant-numeric: tabular-nums;
              -webkit-print-color-adjust: exact; print-color-adjust: exact;
            }
            .ticket { width: 72mm; margin: 0; padding: 2mm; }

            :root {
              --fs-general: ${TICKET_FONT_PX}px;
              --fs-items: ${DETAILS_FONT_PX}px;
              --lh: ${LINE_HEIGHT};
            }

            .hr { border-top: 1px solid #000; margin: 2mm 0; }

            .header { text-align: center; line-height: var(--lh); }
            .header .h1 { font-size: var(--fs-items); font-weight: 700; }
            .header .h2 { font-size: var(--fs-general); }

            .meta, .extra {
              display: grid;
              row-gap: 1mm;
              font-size: var(--fs-general);
              line-height: var(--lh);
            }
            .kv {
              display: grid;
              grid-template-columns: auto 1fr;
              column-gap: 2mm;
              align-items: baseline;
            }
            .kv .k { white-space: nowrap; font-weight: 600; }
            .kv .v { overflow-wrap: anywhere; word-break: break-word; }

            .section-title {
              text-align: center;
              font-size: var(--fs-items);
              font-weight: 600;
              line-height: var(--lh);
              margin: 1mm 0;
            }

            .items {
              display: grid;
              row-gap: 1mm;
              font-size: var(--fs-items);
              line-height: var(--lh);
            }
            .row.item {
              display: grid;
              grid-template-columns: auto 1fr min-content;
              column-gap: 2mm;
              align-items: start;
            }
            .qty { white-space: nowrap; }
            .name { overflow-wrap: anywhere; word-break: break-word; }
            .price { white-space: nowrap; text-align: right; }

            .totals {
              display: grid;
              row-gap: 1mm;
              font-size: var(--fs-general);
              line-height: var(--lh);
            }
            .totals .row {
              display: grid;
              grid-template-columns: 1fr min-content;
              column-gap: 2mm;
              align-items: baseline;
            }
            .totals .row .val { white-space: nowrap; text-align: right; }
            .totals .row.strong { font-weight: 800; }

            .footer {
              text-align: center;
              font-size: var(--fs-general);
              line-height: var(--lh);
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          ${innerHtml}
          <script>
            try {
              window.onload = function() {
                if (typeof window.print === 'function') {
                  window.print();
                  setTimeout(function() { window.close(); }, 600);
                }
              }
            } catch (e) {}
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=380,height=700');
    if (printWindow) {
      printWindow.document.write(fullHtml);
      printWindow.document.close();
      try {
        const updated = { ...order, estado: 'impreso' as string };
        setDictadoOrders((prev) =>
          prev.map((o) =>
            o.row_number === order.row_number ? updated : o,
          ),
        );
        await postDictadoModificar(order, { estado: 'impreso' });
      } catch (e) {
        console.error('No se pudo marcar como impreso (fallback):', e);
      }
    }
  };

  /** Filtros / orden dictados */
  const statusOptions = useMemo(() => {
    const setVals = new Set<string>();
    dictadoOrders.forEach((o) => {
      if (o?.estado) setVals.add(o.estado);
    });
    return ['todos', ...Array.from(setVals)];
  }, [dictadoOrders]);

  const paymentOptions = useMemo(() => {
    const setVals = new Set<string>();
    dictadoOrders.forEach((o) => {
      if (o?.metodo_pago) setVals.add(o.metodo_pago);
    });
    return ['todos', ...Array.from(setVals)];
  }, [dictadoOrders]);

  const filteredDictadoOrders = useMemo(() => {
    const byFilters = dictadoOrders.filter((order) => {
      const statusMatch =
        filterStatus === 'todos' || order.estado === filterStatus;
      const paymentMatch =
        filterPayment === 'todos' ||
        order.metodo_pago === filterPayment;
      return statusMatch && paymentMatch;
    });

    const sorted = [...byFilters].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'fecha') {
        const aT = new Date(a.fecha).getTime() || 0;
        const bT = new Date(b.fecha).getTime() || 0;
        cmp = aT - bT;
      } else {
        const aN = a.row_number ?? 0;
        const bN = b.row_number ?? 0;
        cmp = aN - bN;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [
    dictadoOrders,
    filterStatus,
    filterPayment,
    sortBy,
    sortDir,
  ]);

  /** ===== UI ===== */
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header sticky */}
      <div className="bg-white/80 backdrop-blur border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">
              Dictado de Pedidos
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setClips([]);
                  setRespuesta(null);
                  setEditedTranscripcion('');
                  if (combinedUrl) {
                    URL.revokeObjectURL(combinedUrl);
                    setCombinedUrl(null);
                    setCombinedInfo(null);
                  }
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm flex items-center gap-2 text-sm"
                title="Limpiar sesión de dictado"
              >
                <RefreshCw size={16} />
                Limpiar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Config rápida */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-gray-900">
              ¿Quién toma el pedido y en qué mesa?
            </h2>
            <p className="text-xs text-gray-500">
              Completa <span className="font-medium">mesero</span> y{' '}
              <span className="font-medium">mesa</span> para habilitar
              el envío.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mesero */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Mesero/a
              </label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={meseroId}
                onChange={(e) => setMeseroId(e.target.value)}
                onBlur={(e) => registrarMesero(e.target.value)}
                placeholder="Ej: Andrea"
              />
              {meserosGuardados.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {meserosGuardados.map((nombre) => (
                    <button
                      type="button"
                      key={nombre}
                      onClick={() => setMeseroId(nombre)}
                      className="px-2.5 py-1 rounded-full bg-gray-100 text-xs text-gray-700 border border-gray-200 hover:bg-gray-200"
                    >
                      {nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mesa */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Mesa / DOMICILIO
              </label>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {MESA_OPTIONS.map((mesa) => (
                  <button
                    type="button"
                    key={mesa}
                    onClick={() => setMesaId(mesa)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs border transition ${
                      mesaId === mesa
                        ? 'bg-gold text-white border-gold'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {mesa}
                  </button>
                ))}
              </div>
              <input
                className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={mesaId}
                onChange={(e) =>
                  setMesaId(e.target.value.toUpperCase())
                }
                placeholder="Ej: M12, TERRAZA 2, DOMICILIO…"
              />
            </div>
          </div>

          {/* Fila secundaria: restaurante + idioma */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Restaurante
              </label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={restauranteId}
                onChange={(e) => setRestauranteId(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Idioma
              </label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={lang}
                onChange={(e) =>
                  setLang(e.target.value as 'es-CO' | 'es-MX' | 'es-ES')
                }
              >
                <option value="es-CO">es-CO</option>
                <option value="es-MX">es-MX</option>
                <option value="es-ES">es-ES</option>
              </select>
            </div>
            <div className="hidden md:flex items-end text-xs text-gray-500">
              <p>
                Sugerencia:{' '}
                <span className="font-medium">
                  1) Escoge mesa & mesero · 2) Pulsa y dicta · 3) Envía
                  y revisa en la lista de dictados.
                </span>
              </p>
            </div>
          </div>

          {errorMsg && (
            <p className="mt-3 text-sm text-red-600">{errorMsg}</p>
          )}
        </div>

        {/* Grabación */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between md:gap-3 gap-2 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Grabar pedido (push-to-talk)
              </h2>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100">
                  Mesa:{' '}
                  <span className="ml-1 font-semibold text-gray-800">
                    {mesaId || 'sin seleccionar'}
                  </span>
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100">
                  Mesero:{' '}
                  <span className="ml-1 font-semibold text-gray-800">
                    {meseroId || '—'}
                  </span>
                </span>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              Duración del clip:{' '}
              <span className="font-mono">
                {secToClock(recording ? timer : undefined)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <button
              onPointerDown={startRecording}
              onPointerUp={stopRecording}
              onPointerCancel={stopRecording}
              onMouseDown={(e) => e.preventDefault()}
              disabled={!micReady}
              className={`rounded-full w-28 h-28 flex items-center justify-center text-white font-semibold shadow-sm transition
                ${
                  recording
                    ? 'bg-red-600 ring-4 ring-red-200'
                    : 'bg-gold hover:bg-gold/90'
                } disabled:opacity-50`}
              title={
                recording
                  ? 'Grabando… suelta para detener'
                  : 'Mantén presionado para grabar'
              }
            >
              {recording ? <Square size={36} /> : <Mic size={36} />}
            </button>

            <div className="text-sm text-gray-500 max-w-md">
              Mantén presionado para grabar y suelta para terminar.
              Puedes crear <strong>varios clips</strong>; al enviar se{' '}
              <strong>unirán en un solo audio</strong> para el agente.
            </div>
          </div>

          {/* Lista de clips */}
          <div className="mt-6">
            <h3 className="font-medium text-gray-900 mb-2">
              Clips grabados ({clips.length})
            </h3>
            {clips.length === 0 ? (
              <p className="text-sm text-gray-500">
                Aún no hay clips. Graba el primer pedido.
              </p>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {clips.map((c) => (
                  <div
                    key={c.id}
                    className="border border-gray-200 rounded-lg p-3 bg-gray-50 flex items-center gap-3"
                  >
                    <audio controls src={c.url} className="flex-1" />
                    <div className="text-xs text-gray-600 min-w-[120px]">
                      <div>{c.mime.replace('audio/', '')}</div>
                      <div>
                        {fmtBytes(c.size)} •{' '}
                        {secToClock(c.durationSec)}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteClip(c.id)}
                      className="border border-gray-300 rounded-lg p-2 bg-white hover:bg-gray-50"
                      title="Eliminar clip"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview de audio combinado */}
          {clips.length > 1 && (
            <div className="mt-6 border border-amber-200 rounded-lg p-4 bg-amber-50">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <AudioLines
                    size={18}
                    className="text-amber-600"
                  />
                  <h4 className="font-semibold text-amber-800">
                    Audio combinado (preview)
                  </h4>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await buildCombinedWav();
                    } catch (e: any) {
                      setErrorMsg(
                        e?.message || 'No se pudo combinar',
                      );
                    }
                  }}
                  className="border border-amber-300 rounded-lg px-3 py-1.5 bg-white text-amber-800 hover:bg-amber-100 text-sm"
                >
                  Generar preview
                </button>
              </div>
              {combinedUrl ? (
                <div className="flex items-center gap-3">
                  <audio
                    controls
                    src={combinedUrl}
                    className="flex-1"
                  />
                  <div className="text-xs text-amber-800 min-w-[120px]">
                    {combinedInfo && (
                      <div>
                        {fmtBytes(combinedInfo.size)} •{' '}
                        {secToClock(combinedInfo.durationSec)}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-amber-800">
                  Pulsa “Generar preview” para escuchar cómo quedará
                  la unión.
                </p>
              )}
            </div>
          )}

          <div className="mt-6">
            <button
              onClick={enviarDictado}
              disabled={!canEnviar}
              className="bg-gold hover:bg-gold/90 text-white px-4 py-2 rounded-lg font-medium shadow-sm disabled:opacity-50 flex items-center gap-2 text-sm"
              title="Enviar al webhook de dictado"
            >
              {sending ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Send size={16} />
              )}
              Enviar comanda
            </button>
            {clips.length > 0 &&
              (!mesaId.trim() || !meseroId.trim()) && (
                <p className="mt-1 text-xs text-gray-500">
                  Selecciona{' '}
                  <span className="font-medium">mesa</span> y{' '}
                  <span className="font-medium">mesero</span> para
                  habilitar el envío.
                </p>
              )}
          </div>
        </div>

        {/* Resumen / Correcciones del último dictado (SIN confirmar pedido aquí) */}
        {respuesta && (
          <div
            id="dictado-resumen"
            className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Resumen propuesto (último dictado)
              </h2>
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                Vista previa
              </span>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  Transcripción / Notas del pedido (editable)
                </label>
                <textarea
                  value={editedTranscripcion}
                  onChange={(e) =>
                    setEditedTranscripcion(e.target.value)
                  }
                  rows={8}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Ej: 2 Bandejas Paisa (sin cebolla), 1 Limonada de coco, 1 Jugo de mango…"
                />
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={aplicarCorreccionTexto}
                    disabled={loadingCorreccion}
                    className="border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm flex items-center gap-2 disabled:opacity-50 text-sm"
                  >
                    {loadingCorreccion ? (
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />
                    ) : (
                      <Wand2 size={16} />
                    )}
                    Aplicar modificación (texto)
                  </button>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Ítems detectados
                </p>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2">
                          Cant.
                        </th>
                        <th className="text-left px-3 py-2">
                          Producto
                        </th>
                        <th className="text-left px-3 py-2">
                          Notas
                        </th>
                        <th className="text-right px-3 py-2">
                          Precio
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(respuesta.items || []).map((it, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2">
                            {it.qty ?? 1}
                          </td>
                          <td className="px-3 py-2 break-words">
                            {it.nombre}
                          </td>
                          <td className="px-3 py-2 break-words">
                            {it.notas || '—'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {typeof it.precio === 'number'
                              ? `$${it.precio.toLocaleString(
                                  'es-CO',
                                )}`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 text-right text-sm text-gray-700">
                  Total estimado:{' '}
                  <strong>
                    $
                    {(respuesta.total || 0).toLocaleString(
                      'es-CO',
                    )}
                  </strong>
                </div>

                {/* Corrección por voz */}
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-2">
                    Corrección por voz (opcional)
                  </p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onPointerDown={startRecCorr}
                      onPointerUp={stopRecCorr}
                      onPointerCancel={stopRecCorr}
                      className={`rounded-full w-16 h-16 flex items-center justify-center text-white transition ${
                        recCorr
                          ? 'bg-red-600 ring-4 ring-red-200'
                          : 'bg-gray-800 hover:bg-gray-700'
                      }`}
                      title={
                        recCorr
                          ? 'Grabando corrección… suelta para detener'
                          : 'Mantén para grabar corrección'
                      }
                    >
                      {recCorr ? (
                        <Square size={22} />
                      ) : (
                        <Mic size={22} />
                      )}
                    </button>

                    {corrClip ? (
                      <div className="flex items-center gap-3 flex-wrap">
                        <audio
                          controls
                          src={corrClip.url}
                          className="max-w-[260px]"
                        />
                        <button
                          onClick={enviarCorreccionAudio}
                          disabled={loadingCorreccion}
                          className="bg-gold hover:bg-gold/90 text-white px-3 py-2 rounded-lg font-medium shadow-sm flex items-center gap-2 disabled:opacity-50 text-sm"
                        >
                          {loadingCorreccion ? (
                            <Loader2
                              size={16}
                              className="animate-spin"
                            />
                          ) : (
                            <Send size={16} />
                          )}
                          Enviar corrección
                        </button>
                        <button
                          onClick={() => {
                            URL.revokeObjectURL(corrClip.url);
                            setCorrClip(null);
                          }}
                          className="border border-gray-300 rounded-lg p-2 bg-white"
                          title="Eliminar corrección"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">
                        Graba un clip corto con la corrección (ej.
                        “cambiar limonada por jugo de mango”).
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== Lista de pedidos dictados (DB espejo) ===== */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          {/* Barra de filtros */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              Pedidos dictados (tabla espejo)
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm text-sm"
              >
                {statusOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === 'todos'
                      ? 'Todos los estados'
                      : opt}
                  </option>
                ))}
              </select>

              <select
                value={filterPayment}
                onChange={(e) => setFilterPayment(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm text-sm"
              >
                {paymentOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === 'todos'
                      ? 'Todos los pagos'
                      : opt}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(e.target.value as
                      | 'fecha'
                      | 'row_number')
                  }
                  className="border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm text-sm"
                >
                  <option value="fecha">
                    Ordenar por fecha
                  </option>
                  <option value="row_number">
                    Ordenar por N° de pedido
                  </option>
                </select>
                <button
                  onClick={() =>
                    setSortDir((prev) =>
                      prev === 'asc' ? 'desc' : 'asc',
                    )
                  }
                  className="border border-gray-300 rounded-lg px-3 py-2 flex items-center gap-2 bg-white shadow-sm text-sm"
                  title={`Orden ${
                    sortDir === 'asc'
                      ? 'ascendente'
                      : 'descendente'
                  }`}
                >
                  <ArrowUpDown size={16} />
                  {sortDir === 'asc' ? 'Asc' : 'Desc'}
                </button>

                <button
                  onClick={fetchDictadoOrders}
                  className="bg-gold hover:bg-gold/90 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm text-sm"
                >
                  <RefreshCw size={16} />
                  Actualizar
                </button>
              </div>
            </div>
          </div>

          {/* Cards de pedidos dictados */}
          {filteredDictadoOrders.length === 0 ? (
            <p className="text-sm text-gray-500">
              No hay pedidos dictados aún en la tabla espejo.
            </p>
          ) : (
            <div className="grid gap-4">
              {filteredDictadoOrders.map((order) => {
                const parsed = parseDetails(
                  order['detalle pedido'] || '',
                );
                const total =
                  (order.valor_restaurante || 0) +
                  (order.valor_domicilio || 0);
                const isEditing =
                  editingId === order.row_number;
                const ui = getStatusUI(order.estado);

                return (
                  <div
                    key={order.row_number}
                    className={`rounded-lg shadow-sm border p-4 ${ui.card}`}
                  >
                    <div className="flex items-start justify-between mb-4 gap-3">
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900">
                          Pedido #{order.row_number}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {order.fecha}
                        </p>
                        {order.id_pedido && (
                          <p className="text-xs text-gray-500">
                            ID pedido:{' '}
                            <span className="font-mono">
                              {order.id_pedido}
                            </span>
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${ui.badge}`}
                        >
                          {order.estado}
                        </span>
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                          {order.metodo_pago || '—'}
                        </span>

                        {!isEditing ? (
                          <button
                            onClick={() => startEdit(order)}
                            className="border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm text-sm"
                          >
                            Editar
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => saveEdit(order)}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg font-medium shadow-sm text-sm"
                            >
                              Guardar
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm text-sm"
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="min-w-0">
                        {!isEditing ? (
                          <>
                            <p className="font-medium text-gray-900 break-words">
                              {order.nombre || '—'}
                            </p>
                            <p className="text-sm text-gray-600 break-words">
                              Mesa / Número: {order.numero}
                            </p>
                            <p className="text-sm text-gray-600 break-words">
                              {order.direccion}
                            </p>
                          </>
                        ) : (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">
                                Mesa / Número
                              </label>
                              <input
                                value={editNumero}
                                onChange={(e) =>
                                  setEditNumero(
                                    e.target.value,
                                  )
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">
                                Nombre
                              </label>
                              <input
                                value={editNombre}
                                onChange={(e) =>
                                  setEditNombre(
                                    e.target.value,
                                  )
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">
                                Dirección
                              </label>
                              <textarea
                                value={editDireccion}
                                onChange={(e) =>
                                  setEditDireccion(
                                    e.target.value,
                                  )
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                rows={2}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        {!isEditing ? (
                          <>
                            <p className="text-sm text-gray-600 mb-2">
                              Detalle del pedido:
                            </p>

                            <div className="bg-gray-50 p-3 rounded-lg text-sm border border-gray-200">
                              <div className="grid grid-cols-12 gap-x-2">
                                {parsed.map(
                                  (
                                    {
                                      quantity,
                                      name,
                                      priceNum,
                                    },
                                    index,
                                  ) => (
                                    <React.Fragment
                                      key={index}
                                    >
                                      <div className="col-span-2 whitespace-nowrap">
                                        {quantity}
                                      </div>
                                      <div className="col-span-7 break-words">
                                        {name}
                                      </div>
                                      <div className="col-span-3 text-right tabular-nums">
                                        $
                                        {priceNum.toLocaleString(
                                          'es-CO',
                                        )}
                                      </div>
                                    </React.Fragment>
                                  ),
                                )}
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <label className="block text-sm text-gray-600 mb-2">
                              Detalle del pedido (auto-recalcula
                              restaurante)
                            </label>
                            <textarea
                              value={editDetalle}
                              onChange={(e) =>
                                setEditDetalle(
                                  e.target.value,
                                )
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              rows={4}
                              placeholder="Ej: 2, Piquete lomo de cerdo, 18500; 1, Limonada, 6000"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Suma automática:{' '}
                              <strong>
                                $
                                {editValorRest.toLocaleString(
                                  'es-CO',
                                )}
                              </strong>
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-4 flex-wrap">
                        {!isEditing ? (
                          <>
                            <span className="font-bold text-gray-900">
                              TOTAL:{' '}
                              $
                              {total.toLocaleString(
                                'es-CO',
                              )}
                            </span>
                            <span className="text-sm text-gray-600">
                              Restaurante:{' '}
                              $
                              {order.valor_restaurante.toLocaleString(
                                'es-CO',
                              )}
                            </span>
                            {order.valor_domicilio > 0 && (
                              <span className="text-sm text-gray-600">
                                Domicilio:{' '}
                                $
                                {order.valor_domicilio.toLocaleString(
                                  'es-CO',
                                )}
                              </span>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-3 flex-wrap">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">
                                Valor restaurante (auto)
                              </label>
                              <input
                                type="number"
                                value={editValorRest}
                                onChange={(e) =>
                                  setEditValorRest(
                                    parseInt(
                                      e.target.value ||
                                        '0',
                                      10,
                                    ),
                                  )
                                }
                                className="w-40 px-3 py-2 border border-gray-300 rounded-md"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">
                                Valor domicilio
                              </label>
                              <input
                                type="number"
                                value={editValorDom}
                                onChange={(e) =>
                                  setEditValorDom(
                                    parseInt(
                                      e.target.value ||
                                        '0',
                                      10,
                                    ),
                                  )
                                }
                                className="w-40 px-3 py-2 border border-gray-300 rounded-md"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">
                                Método de pago
                              </label>
                              <input
                                value={editMetodoPago}
                                onChange={(e) =>
                                  setEditMetodoPago(
                                    e.target.value,
                                  )
                                }
                                className="w-48 px-3 py-2 border border-gray-300 rounded-md"
                                placeholder="Efectivo / Transferencia / ..."
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            printDictadoOrder(order)
                          }
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm text-sm"
                        >
                          <Printer size={16} />
                          Imprimir
                        </button>

                        {/* Estado editable */}
                        <select
                          value={order.estado}
                          onChange={(e) =>
                            updateOrderEstado(
                              order,
                              e.target.value,
                            )
                          }
                          className="border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm text-sm"
                        >
                          {allowedStatuses.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dictado;
