// src/pages/DictadoPage.tsx
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
} from 'lucide-react';

// IMPORTANTE: Importamos la Tarjeta reutilizable
import TarjetaPedido, { Order, CartItem, MenuItem } from './TarjetaPedido';

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

// Extendemos o compatibilizamos con el tipo Order de TarjetaPedido
interface DictadoOrder extends Order {
  // Propiedades específicas si las hubiera, pero Order cubre la mayoría.
  // En Dictado: 'nombre' = Mesero, 'direccion' = Mesa, 'numero' = ID Pedido
}

// PROPS: Recibimos el nombre del usuario logueado en Admin
interface DictadoProps {
  meseroName: string; 
}

/** ===== Config ===== */
const ENDPOINTS = {
  audioDictado: 'https://n8n.alliasoft.com/webhook/luisres/pedidos/dictado',
  correccion: 'https://n8n.alliasoft.com/webhook/luisres/pedidos/correccion',
  dictadoList: 'https://n8n.alliasoft.com/webhook/luisres/pedidos/dictado',
  dictadoModificar: 'https://n8n.alliasoft.com/webhook/luis-res/pedidos/dictado/modificar',
  menu: 'https://n8n.alliasoft.com/webhook/luis-res/menu',
} as const;

const BINARY_FIELD = 'audio';
const TARGET_SR = 48000;
const TARGET_CH = 1;

const DEFAULT_MESAS = Array.from({ length: 12 }, (_, i) => `M${i + 1}`);
const EXTRA_MESAS = ['BARRA', 'DOMICILIO'];
const MESA_OPTIONS = [...DEFAULT_MESAS, ...EXTRA_MESAS];

/** ===== Utilidades Audio / Formato para Impresión ===== */
// NOTA: Mantenemos helpers de impresión aquí porque la impresión de Dictado
// es ligeramente diferente a la de Domicilios (Muestra Mesero/Mesa), 
// aunque reutilicemos la Tarjeta visual.

const pickMimeType = () => {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  for (const t of candidates) {
    // @ts-ignore
    if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
};

const secToClock = (s?: number) =>
  s == null ? '—' : `${Math.floor(s / 60)}`.padStart(2, '0') + ':' + `${Math.floor(s % 60)}`.padStart(2, '0');

const formatPrice = (val: number) => `$${(val || 0).toLocaleString('es-CO')}`;

/* --- Audio Encoding Helpers (WAV) --- */
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
  const ws = (s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(p++, s.charCodeAt(i)); };
  const w32 = (v: number) => { dv.setUint32(p, v, true); p += 4; };
  const w16 = (v: number) => { dv.setUint16(p, v, true); p += 2; };
  ws('RIFF'); w32(36 + dataSize); ws('WAVE'); ws('fmt '); w32(16); w16(1); w16(numCh); w32(sr); w32(byteRate); w16(blockAlign); w16(16); ws('data'); w32(dataSize);
  for (let i = 0; i < pcm.length; i++) dv.setInt16(p + i * 2, pcm[i], true);
  return new Blob([ab], { type: 'audio/wav' });
}

async function resampleBuffer(src: AudioBuffer, targetSR = TARGET_SR, targetCH = TARGET_CH): Promise<AudioBuffer> {
  const length = Math.ceil(src.duration * targetSR);
  const offline = new OfflineAudioContext(targetCH, length, targetSR);
  const source = offline.createBufferSource();
  source.buffer = src;
  source.connect(offline.destination);
  source.start();
  return offline.startRendering();
}

async function decodeBlobToBuffer(blob: Blob, ac: AudioContext): Promise<AudioBuffer> {
  const ab = await blob.arrayBuffer();
  return await new Promise<AudioBuffer>((resolve, reject) => {
    ac.decodeAudioData(ab.slice(0), resolve, reject);
  });
}

async function concatAsWav(clips: Clip[]): Promise<{ blob: Blob; durationSec: number }> {
  if (!clips.length) throw new Error('No hay clips para combinar.');
  const ac = new AudioContext({ sampleRate: TARGET_SR });
  const processed: AudioBuffer[] = [];
  for (const c of [...clips].reverse()) {
    const buf = await decodeBlobToBuffer(c.blob, ac);
    const r = await resampleBuffer(buf, TARGET_SR, TARGET_CH);
    processed.push(r);
  }
  const totalFrames = processed.reduce((s, b) => s + b.length, 0);
  const out = new AudioBuffer({ numberOfChannels: TARGET_CH, sampleRate: TARGET_SR, length: totalFrames });
  let offset = 0;
  for (const b of processed) {
    out.getChannelData(0).set(b.getChannelData(0), offset);
    offset += b.length;
  }
  const wav = audioBufferToWavBlob(out);
  return { blob: wav, durationSec: out.length / out.sampleRate };
}

/* --- Parsing & Printing Utilities (Para función de Impresión Interna) --- */
const COLS = 42;
const repeat = (ch: string, n: number) => Array(Math.max(0, n)).fill(ch).join('');
const padRight = (s: string, n: number) => s.length >= n ? s.slice(0, n) : s + repeat(' ', n - s.length);
const center = (s: string) => {
  const len = Math.min(s.length, COLS);
  const left = Math.floor((COLS - len) / 2);
  return repeat(' ', Math.max(0, left)) + s.slice(0, COLS);
};
const money = (n: number) => `$${(n || 0).toLocaleString('es-CO')}`;
const sanitizeForTicket = (s: string): string => (s || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\t/g, ' ').trim();

const wrapText = (text: string, width: number): string[] => {
  const rawTokens = (text || '').trim().split(/\s+/).filter(Boolean);
  if (!rawTokens.length) return [''];
  const tokens: string[] = [];
  for (const t of rawTokens) {
    if (t.length <= width) tokens.push(t);
    else for (let i = 0; i < t.length; i += width) tokens.push(t.slice(i, i + width));
  }
  const lines: string[] = [];
  let line = '';
  for (const tok of tokens) {
    if (!line.length) line = tok;
    else if ((line + ' ' + tok).length <= width) line += ' ' + tok;
    else { lines.push(line); line = tok; }
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
  for (let i = 1; i < vLines.length; i++) out.push(padRight(indent + vLines[i], COLS));
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
    if (ch === '(') depth++; else if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && sepSet.has(ch)) { if (buf.trim()) out.push(buf.trim()); buf = ''; }
    else { buf += ch; }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
};

const splitByCommaOutsideParens = (s: string): string[] => splitOutsideParens(s, [',']);

const parseDetails = (raw: string) => {
  if (!raw) return [];
  const itemStrings = splitOutsideParens(raw, [';', '\n', '|']).map((x) => x.trim()).filter(Boolean);
  return itemStrings.map((itemStr) => {
    const cleanStr = itemStr.replace(/^-+\s*/, '').trim();
    const parts = splitByCommaOutsideParens(cleanStr).map((x) => x.trim()).filter(x => x !== '');
    let quantity = '1';
    let name = '';
    let priceNum = 0;
    if (parts.length >= 3) {
      quantity = parts[0];
      name = parts.slice(1, parts.length - 1).join(', '); 
      priceNum = parseMoneyToInt(parts[parts.length - 1]); 
    } else if (parts.length === 2) {
      if (/^\d+$/.test(parts[0])) { quantity = parts[0]; name = parts[1]; }
      else { name = parts[0]; priceNum = parseMoneyToInt(parts[1]); }
    } else {
      name = parts[0] || '';
    }
    const qMatch = quantity.match(/\d+/);
    if (qMatch) quantity = qMatch[0]; else quantity = '1';
    return { quantity, name, priceNum };
  });
};

const parseDetailsToCart = (raw: string): CartItem[] => {
  if (!raw) return [];
  const items = parseDetails(raw); 
  return items.map(i => {
    const qty = parseInt(i.quantity, 10) || 1;
    const total = i.priceNum;
    return {
      name: i.name,
      quantity: qty,
      priceUnit: qty > 0 ? Math.round(total / qty) : 0
    };
  });
};

const serializeCartToDetails = (items: CartItem[]): string => {
  return items
    .map(i => `- ${i.quantity}, ${i.name}, ${i.quantity * i.priceUnit}`)
    .join('; ');
};

const formatItemBlock = (qty: string, name: string, priceNum: number): string[] => {
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
  for (let i = 1; i < leftLines.length; i++) out.push(padRight(indent + leftLines[i], COLS));
  return out;
};

// RawBT / ESCPOS Logic
const bytesToBase64 = (bytes: number[]): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const cp1252Map: Record<string, number> = {
  '\u00C1': 0xc1, '\u00C9': 0xc9, '\u00CD': 0xcd, '\u00D3': 0xd3, '\u00DA': 0xda, '\u00DC': 0xdc, '\u00D1': 0xd1,
  '\u00E1': 0xe1, '\u00E9': 0xe9, '\u00ED': 0xed, '\u00F3': 0xf3, '\u00FA': 0xfa, '\u00FC': 0xfc, '\u00F1': 0xf1,
  '\u20AC': 0x80
};

const encodeCP1252 = (str: string): number[] => {
  const bytes: number[] = [];
  for (const ch of str) {
    const code = ch.codePointAt(0)!;
    if (code <= 0x7f) { bytes.push(code); continue; }
    if (cp1252Map[ch] !== undefined) { bytes.push(cp1252Map[ch]); continue; }
    bytes.push(0x3f); // '?'
  }
  return bytes;
};

const isAndroid = (): boolean => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');

const makeSizeByte = (heightMul = 1, widthMul = 1): number => ((Math.max(1, widthMul) - 1) << 4) | (Math.max(1, heightMul) - 1);

const buildEscposTicket = (normalBefore: string[], detailLines: string[], normalAfter: string[]): number[] => {
  const bytes: number[] = [];
  const enc = (arr: string[]) => encodeCP1252(arr.join('\n') + '\n');
  bytes.push(0x1b, 0x40); // init
  bytes.push(0x1b, 0x74, 0x10); // codepage 16
  bytes.push(0x1d, 0x21, makeSizeByte(1, 1)); // normal
  bytes.push(...enc(normalBefore));
  bytes.push(0x1d, 0x21, makeSizeByte(2, 1)); // doble altura
  bytes.push(...enc(detailLines));
  bytes.push(0x1d, 0x21, makeSizeByte(1, 1)); // normal
  bytes.push(...enc(normalAfter));
  bytes.push(0x0a, 0x0a, 0x0a);
  bytes.push(0x1d, 0x56, 0x00); // cut
  return bytes;
};

const sendToRawBTSections = async (normalBefore: string[], detailLines: string[], normalAfter: string[]): Promise<void> => {
  if (!isAndroid()) throw new Error('Solo Android (RawBT)');
  const escposBytes = buildEscposTicket(normalBefore, detailLines, normalAfter);
  const base64 = bytesToBase64(escposBytes);
  const url = `rawbt:base64,${base64}`;
  const a = document.createElement('a');
  a.href = url;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

/** ===== COMPONENTE PRINCIPAL ===== */
const Dictado: React.FC<DictadoProps> = ({ meseroName }) => {

  // --- APP STATE ---
  const [restauranteId] = useState('LUISRES');
  const [mesaId, setMesaId] = useState('');
  const [lang] = useState('es-CO');

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

  // Respuesta
  const [sending, setSending] = useState(false);
  const [respuesta, setRespuesta] = useState<DictadoResponse | null>(null);
  const [editedTranscripcion, setEditedTranscripcion] = useState('');
  const [loadingCorreccion, setLoadingCorreccion] = useState(false);

  // Lista de dictados
  const [dictadoOrders, setDictadoOrders] = useState<DictadoOrder[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [sortBy, setSortBy] = useState<'fecha' | 'row_number'>('row_number');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Edición (Compatible con TarjetaPedido)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState(''); // Mesero en este contexto
  const [editNumero, setEditNumero] = useState(''); // ID Pedido
  const [editDireccion, setEditDireccion] = useState(''); // Mesa
  const [editValorRest, setEditValorRest] = useState(0);
  const [editValorDom, setEditValorDom] = useState(0);
  const [editMetodoPago, setEditMetodoPago] = useState('');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  
  // MENU
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuSearch, setMenuSearch] = useState('');
  const [menuCat, setMenuCat] = useState('Todas');

  // --- INITIALIZATION ---
  useEffect(() => {
    ensureMic();
    return () => {
      try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
      clips.forEach((c) => URL.revokeObjectURL(c.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch periódico
  const fetchDictadoOrders = useCallback(async () => {
    try {
      const response = await fetch(ENDPOINTS.dictadoList, { cache: 'no-store' });
      const data = await response.json();
      if (Array.isArray(data)) setDictadoOrders(data as DictadoOrder[]);
    } catch (e) {
      console.error('Error fetching dictado orders:', e);
    }
  }, []);

  useEffect(() => {
    fetchDictadoOrders();
    const interval = setInterval(fetchDictadoOrders, 15000);
    return () => clearInterval(interval);
  }, [fetchDictadoOrders]);

  // Fetch Menu
  const fetchMenu = async () => {
    try {
      const res = await fetch(ENDPOINTS.menu);
      const data = await res.json();
      if (Array.isArray(data)) {
        setMenuItems(data.sort((a: any, b: any) => a.nombre.localeCompare(b.nombre)));
      }
    } catch (e) {
      console.error('Error menu', e);
    }
  };

  useEffect(() => {
    if (editingId !== null && menuItems.length === 0) {
      fetchMenu();
    }
  }, [editingId, menuItems.length]);

  /** ===== Grabación ===== */
  const ensureMic = async () => {
    try {
      if (streamRef.current) { setMicReady(true); return; }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      setMicReady(true);
    } catch {
      setMicReady(false);
    }
  };

  const startRecording = async () => {
    setErrorMsg('');
    if (!micReady) await ensureMic();
    if (!streamRef.current) return;
    const mimeType = pickMimeType();
    const rec = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (e: any) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
    rec.onstart = () => { setRecording(true); setTimer(0); timerRef.current = window.setInterval(() => setTimer(t => t + 1), 1000); };
    rec.onstop = async () => {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecording(false);
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
      const url = URL.createObjectURL(blob);
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const a = new Audio(url);
      let dur = 0;
      a.onloadedmetadata = () => { dur = a.duration; };
      const clip: Clip = { id, blob, url, mime: blob.type, size: blob.size, createdAt: Date.now(), durationSec: dur };
      setClips((prev) => [clip, ...prev]);
    };
    recRef.current = rec;
    rec.start();
  };

  const stopRecording = () => { try { recRef.current?.stop(); } catch {} };
  const deleteClip = (id: string) => setClips(prev => prev.filter(x => x.id !== id));

  /** ===== Enviar Dictado ===== */
  const enviarDictado = async () => {
    if (!clips.length || !mesaId.trim()) return;
    setSending(true);
    setErrorMsg('');
    try {
      const { blob } = await concatAsWav(clips);
      const now = new Date();
      const id_pedido = `${now.getHours()}${now.getMinutes()}${now.getSeconds()}`;
      const fd = new FormData();
      fd.append('restauranteId', restauranteId);
      fd.append('mesaId', mesaId.trim());
      fd.append('meseroId', meseroName);
      fd.append('lang', lang);
      fd.append('id_pedido', id_pedido);
      fd.append(BINARY_FIELD, blob, 'pedido.wav');

      const res = await fetch(ENDPOINTS.audioDictado, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Error enviando audio');
      const json = await res.json();
      setRespuesta(json);
      setEditedTranscripcion(json.transcripcion || '');
      fetchDictadoOrders();
      setTimeout(() => document.getElementById('resumen')?.scrollIntoView({ behavior: 'smooth' }), 200);
    } catch (e: any) {
      setErrorMsg('Error al enviar: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  const aplicarCorreccionTexto = async () => {
    if (!respuesta?.tempId) return;
    setLoadingCorreccion(true);
    try {
      const res = await fetch(ENDPOINTS.correccion, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempId: respuesta.tempId, cambios: { transcripcion: editedTranscripcion } }),
      });
      const json = await res.json();
      setRespuesta(json);
    } finally {
      setLoadingCorreccion(false);
    }
  };

  /** ===== Edición (Adaptadores para TarjetaPedido) ===== */
  const startEdit = (o: Order) => {
    // Casteamos 'o' como DictadoOrder para acceder a propiedades específicas si es necesario
    // En TarjetaPedido, 'nombre' es editNombre. En Dictado, 'nombre' es Mesero.
    setEditingId(o.row_number);
    setEditNombre(o.nombre || ''); 
    setEditNumero(o.numero || ''); // ID Pedido
    setEditDireccion(o.direccion || ''); // Mesa
    setCartItems(parseDetailsToCart(o['detalle pedido'] || ''));
    setEditValorRest(o.valor_restaurante || 0);
    setEditValorDom(o.valor_domicilio || 0);
    setEditMetodoPago(o.metodo_pago || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setCartItems([]);
  };

  const addItemToCart = (menuItem: MenuItem) => {
    setCartItems(prev => {
      const exists = prev.find(i => i.name === menuItem.nombre);
      if (exists) return prev.map(i => i.name === menuItem.nombre ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { name: menuItem.nombre, quantity: 1, priceUnit: menuItem.valor }];
    });
  };

  const decreaseItem = (index: number) => {
    setCartItems(prev => {
      const item = prev[index];
      if (item.quantity > 1) {
        const copy = [...prev];
        copy[index] = { ...item, quantity: item.quantity - 1 };
        return copy;
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  useEffect(() => {
    if (editingId !== null) {
      const total = cartItems.reduce((sum, item) => sum + (item.quantity * item.priceUnit), 0);
      setEditValorRest(total);
    }
  }, [cartItems, editingId]);

  const saveEdit = async (o: Order) => {
    const detailString = serializeCartToDetails(cartItems);
    // Map back to DictadoOrder structure
    const updated: Partial<DictadoOrder> = {
      nombre: editNombre,       // Mesero
      numero: editNumero,       // ID Pedido (Asegúrate que TarjetaPedido te permite editar numero, si no, usa el valor original)
      direccion: editDireccion, // Mesa
      'detalle_pedido': detailString, // Nota: TarjetaPedido usa 'detalle pedido' (con espacio) usualmente, asegurate de la consistencia
      valor_restaurante: editValorRest,
      valor_domicilio: editValorDom,
      metodo_pago: editMetodoPago,
    };
    
    // Mapeo para consistencia local
    const dictadoOrderUpdate = { ...o, ...updated, "detalle_pedido": detailString } as DictadoOrder;

    setDictadoOrders(prev => prev.map(x => x.row_number === o.row_number ? dictadoOrderUpdate : x));
    setEditingId(null);

    try {
      await fetch(ENDPOINTS.dictadoModificar, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dictadoOrderUpdate),
      });
    } catch (e) {
      alert('Error guardando cambios');
      fetchDictadoOrders();
    }
  };

  const updateOrderEstado = async (order: Order, newStatus: string) => {
    const updated = { ...order, estado: newStatus } as DictadoOrder;
    setDictadoOrders((prev) => prev.map((o) => (o.row_number === order.row_number ? updated : o)));
    try {
      await fetch(ENDPOINTS.dictadoModificar, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...order, estado: newStatus }),
      });
    } catch {
      alert('Error actualizando estado');
    }
  };

  /** ===== IMPRESIÓN ESPECÍFICA DE DICTADO ===== */
  // Esta función se pasa a TarjetaPedido. 
  // Se mantiene aquí porque el formato de Ticket de Dictado (Mesa/Mesero) es distinto al de Domicilios.
  const printDictadoOrder = async (order: Order) => {
    const mesero = sanitizeForTicket(order.nombre || 'Sin Mesero'); 
    const rawNumero = order.numero || '';
    const numeroPedido = rawNumero.replace(/^p_/, ''); 
    const mesa = sanitizeForTicket(order.direccion || 'Barra'); // En Dictado, direccion es Mesa

    // Usamos 'detalle_pedido' o 'detalle pedido' según venga del objeto Order
    const detalleRaw = order['detalle pedido'] || (order as any)['detalle_pedido'] || '';
    const items = parseDetails(detalleRaw);
    
    const subtotal = order.valor_restaurante || 0;
    const domicilio = order.valor_domicilio || 0;
    const total = subtotal + domicilio;

    const before: string[] = [];
    const detail: string[] = [];
    const after: string[] = [];

    // --- CABECERA ---
    before.push(repeat('=', COLS));
    before.push(center('LUIS RES'));
    before.push(center('Cra 37 #109-24'));
    before.push(center('Floridablanca - Caldas'));
    before.push(repeat('=', COLS));
    
    before.push(padRight(`PEDIDO INT: #${order.row_number}`, COLS));
    before.push(padRight(`ID TICKET:  ${numeroPedido}`, COLS)); 
    
    before.push(repeat('-', COLS));
    before.push(...wrapLabelValue('Fecha', sanitizeForTicket(order.fecha || '')));
    before.push(...wrapLabelValue('Mesa', mesa));
    before.push(...wrapLabelValue('Mesero', mesero));
    before.push(repeat('-', COLS));

    // --- DETALLE ---
    detail.push(center('DETALLE DEL PEDIDO'));
    detail.push(repeat(' ', COLS)); 
    
    items.forEach(({ quantity, name, priceNum }) => {
      const block = formatItemBlock(quantity || '1', sanitizeForTicket(name), priceNum);
      block.forEach((l) => detail.push(l));
    });
    detail.push(repeat('-', COLS));

    // --- TOTALES ---
    after.push(totalLine('Subtotal', subtotal));
    if (domicilio > 0) {
      after.push(totalLine('Para llevar/Dom', domicilio));
    }
    
    after.push(repeat('-', COLS));
    after.push(totalLine('TOTAL A PAGAR', total));
    after.push('');
    
    after.push(...wrapLabelValue('Método de pago', sanitizeForTicket(order.metodo_pago || '')));
    after.push(repeat('=', COLS));
    after.push(center('¡Gracias por su visita!'));
    after.push(repeat('=', COLS));

    // RawBT (Android)
    if (isAndroid()) {
      try {
        await sendToRawBTSections(before, detail, after);
        updateOrderEstado(order, 'impreso');
        return;
      } catch (e) {
        console.warn('Fallo RawBT', e);
      }
    }

    // Fallback HTML
    const itemsHtml = items.map(({ quantity, name, priceNum }) => `
      <div class="row item">
        <div class="qty">${quantity}</div>
        <div class="name">${name}</div>
        <div class="price">${money(priceNum)}</div>
      </div>`).join('');

    const fullHtml = `
      <!doctype html><html><head><meta charset="utf-8"/><style>
      @media print { @page { size: 80mm auto; margin: 0; } }
      body { font-family: monospace; font-size: 12px; } .ticket { width: 72mm; padding: 2mm; }
      .header, .footer { text-align: center; } 
      .hr { border-top: 1px dashed #000; margin: 2mm 0; }
      .double-hr { border-top: 2px solid #000; margin: 2mm 0; }
      .row { display: flex; justify-content: space-between; } 
      .item { display: grid; grid-template-columns: 20px 1fr auto; gap: 5px; }
      .qty { white-space: nowrap; font-weight:bold; } .price { text-align: right; }
      .info { margin-bottom: 5px; }
      </style></head><body><div class="ticket">
      
      <div class="header">
        <b style="font-size:16px">LUIS RES</b><br>Cra 37 #109-24<br>Floridablanca
      </div>
      <div class="double-hr"></div>
      
      <div class="info">
        <b>PEDIDO #${numeroPedido}</b> (Int: ${order.row_number})<br>
        Fecha: ${order.fecha}<br>
        <b>MESA: ${mesa}</b><br>
        Mesero: ${mesero}
      </div>

      <div class="hr"></div>
      ${itemsHtml}
      <div class="hr"></div>
      
      <div class="row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
      ${domicilio > 0 ? `<div class="row"><span>Recargo/Dom</span><span>${money(domicilio)}</span></div>` : ''}
      <div class="row" style="font-size:14px; font-weight:bold; margin-top:5px;">
        <span>TOTAL</span><span>${money(total)}</span>
      </div>
      
      <div class="hr"></div>
      <div class="footer">Forma de pago: ${order.metodo_pago}<br><br>Gracias por su visita</div>
      </div><script>window.onload=function(){window.print();setTimeout(window.close,500);}</script></body></html>
    `;
    const w = window.open('', '_blank', 'width=380,height=600');
    if (w) { w.document.write(fullHtml); w.document.close(); updateOrderEstado(order, 'impreso'); }
  };

  /** ===== Menu Filter ===== */
  const filteredMenu = useMemo(() => {
    return menuItems.filter(item => {
      const matchSearch = item.nombre.toLowerCase().includes(menuSearch.toLowerCase());
      const matchCat = menuCat === 'Todas' || item.categorias.includes(menuCat);
      return matchSearch && matchCat;
    });
  }, [menuItems, menuSearch, menuCat]);

  const categories = useMemo(() => {
    const s = new Set<string>(['Todas']);
    menuItems.forEach(i => i.categorias.forEach(c => s.add(c)));
    return Array.from(s).sort();
  }, [menuItems]);

  /** ===== Render: MAIN APP ===== */
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 px-4 py-3 shadow-sm">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Pedidos Mesa</h1>
            <p className="text-xs text-gray-500">Mesero: <span className="font-bold text-amber-600">{meseroName}</span></p>
          </div>
          <div className="flex gap-2">
             {/* Botón de resetear la grabación/propuesta actual */}
             <button onClick={() => { setClips([]); setRespuesta(null); }} className="p-2 text-gray-600 bg-gray-100 rounded-full hover:bg-gray-200" title="Limpiar Dictado Actual"><RefreshCw size={18} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        
        {/* GRABACIÓN */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
          <div className="mb-6">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Mesa / Ubicación</label>
            <div className="flex flex-wrap gap-2">
              {MESA_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMesaId(m)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all select-none touch-manipulation ${mesaId === m ? 'bg-amber-500 text-white shadow-md scale-105' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {m}
                </button>
              ))}
              <input placeholder="Otra..." value={mesaId} onChange={e => setMesaId(e.target.value.toUpperCase())} className="px-4 py-2 rounded-lg text-sm border border-gray-200 focus:border-amber-500 outline-none w-24" />
            </div>
          </div>
          <div className="flex flex-col items-center justify-center bg-gray-50 rounded-2xl py-8 border border-dashed border-gray-300">
            <button
              onPointerDown={startRecording} onPointerUp={stopRecording} onPointerCancel={stopRecording}
              className={`w-32 h-32 rounded-full flex items-center justify-center shadow-lg transition-all select-none touch-manipulation ${recording ? 'bg-red-500 scale-110 ring-8 ring-red-200' : 'bg-amber-500 hover:bg-amber-600'}`}
              disabled={!micReady}
            >
              {recording ? <Square size={40} className="text-white" /> : <Mic size={40} className="text-white" />}
            </button>
            <div className="mt-4 text-center">
               <p className={`font-mono text-xl ${recording ? 'text-red-600 font-bold' : 'text-gray-400'}`}>{secToClock(recording ? timer : clips.reduce((acc,c)=>acc+(c.durationSec||0),0))}</p>
            </div>
            {clips.length > 0 && (
              <div className="mt-6 w-full max-w-md space-y-2 px-4">
                {clips.map((clip, idx) => (
                   <div key={clip.id} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                      <div className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-xs text-gray-500 font-bold">{idx+1}</div>
                      <audio src={clip.url} controls className="h-8 flex-1" />
                      <button onClick={() => deleteClip(clip.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                   </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-6">
            <button onClick={enviarDictado} disabled={sending || !mesaId || clips.length === 0} className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold shadow-md hover:bg-black disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all">
              {sending ? <Loader2 className="animate-spin" /> : <Send size={20} />}
              {sending ? 'Procesando...' : 'Enviar Pedido'}
            </button>
            {!mesaId && clips.length > 0 && <p className="text-center text-red-500 text-xs mt-2">Debes seleccionar una mesa</p>}
          </div>
        </div>

        {/* RESUMEN PREVIO (PROPUESTA) */}
        {respuesta && (
          <div id="resumen" className="bg-white rounded-xl shadow-sm border border-green-200 p-4 md:p-6 relative overflow-hidden">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Wand2 className="text-green-600" size={20} />Propuesta de Pedido</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-500 uppercase">Transcripción</label>
                <textarea className="w-full p-3 text-sm border border-gray-200 rounded-lg bg-gray-50 h-32" value={editedTranscripcion} onChange={(e) => setEditedTranscripcion(e.target.value)} />
                <button onClick={aplicarCorreccionTexto} disabled={loadingCorreccion} className="text-xs flex items-center gap-1 text-amber-600 hover:text-amber-700 font-medium">{loadingCorreccion ? <Loader2 className="animate-spin" size={12}/> : <RefreshCw size={12}/>} Re-procesar texto</button>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Ítems Detectados</label>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Cant</th><th className="px-3 py-2 text-left">Producto</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {(respuesta.items || []).map((it, i) => (
                        <tr key={i}><td className="px-3 py-2 font-bold">{it.qty}</td><td className="px-3 py-2">{it.nombre}</td><td className="px-3 py-2 text-right">{formatPrice(it.precio || 0)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-right mt-2 font-bold text-lg text-gray-800">Total: {formatPrice(respuesta.total || 0)}</div>
              </div>
            </div>
          </div>
        )}

        {/* LISTA DE PEDIDOS REUSANDO TARJETA PEDIDO */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
             <h2 className="text-xl font-bold text-gray-800">Pedidos Activos</h2>
             <div className="flex items-center gap-2 text-sm">
               <span className="text-gray-500 hidden md:inline">Filtrar:</span>
               <select className="bg-white border border-gray-200 rounded-lg py-1 px-2" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                 <option value="todos">Todos</option>
                 <option value="pidiendo">Pidiendo</option>
                 <option value="confirmado">Confirmado</option>
                 <option value="impreso">Impreso</option>
               </select>
               <button onClick={fetchDictadoOrders} className="bg-amber-500 text-white p-2 rounded-lg hover:bg-amber-600"><RefreshCw size={16}/></button>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {dictadoOrders
              .filter(o => filterStatus === 'todos' || o.estado === filterStatus)
              .sort((a,b) => sortBy === 'row_number' ? (sortDir === 'asc' ? a.row_number - b.row_number : b.row_number - a.row_number) : 0)
              .map((dictadoOrder) => {
                // Convertimos 'detalle_pedido' a 'detalle pedido' si es necesario para compatibilidad con el tipo Order
                const orderForCard = {
                  ...dictadoOrder,
                  "detalle pedido": dictadoOrder['detalle_pedido'] || dictadoOrder['detalle pedido']
                } as unknown as Order;

                return (
                  <TarjetaPedido
                    key={dictadoOrder.row_number}
                    order={orderForCard}
                    isEditing={editingId === dictadoOrder.row_number}
                    
                    // State Edición
                    editNombre={editNombre} setEditNombre={setEditNombre}
                    editDireccion={editDireccion} setEditDireccion={setEditDireccion}
                    editValorRest={editValorRest}
                    editValorDom={editValorDom} setEditValorDom={setEditValorDom}
                    editMetodoPago={editMetodoPago} setEditMetodoPago={setEditMetodoPago}
                    cartItems={cartItems} setCartItems={setCartItems}
                    
                    // Menú y Filtros
                    menuSearch={menuSearch} setMenuSearch={setMenuSearch}
                    menuCat={menuCat} setMenuCat={setMenuCat}
                    filteredMenu={filteredMenu} categories={categories}
                    addItemToCart={addItemToCart} decreaseItem={decreaseItem}
                    
                    // Acciones
                    onCancelEdit={cancelEdit}
                    onSaveEdit={() => saveEdit(orderForCard)}
                    onStartEdit={() => startEdit(orderForCard)}
                    onPrint={() => printDictadoOrder(orderForCard)}
                    onStatusChange={updateOrderEstado}
                  />
                );
              })}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dictado;