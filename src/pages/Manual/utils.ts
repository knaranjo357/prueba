import { MenuItemFull, CartItem } from "./types";

export const pad2 = (n: number) => String(n).padStart(2, "0");

export const makeNumeroFallback = () => {
  const d = new Date();
  return `p_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
};

export const toInt = (v: any) => {
  const n = parseInt(String(v ?? "").replace(/[^0-9\-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};

export const normalizeNote = (s: string) => {
  const raw = (s || "").trim();
  if (!raw) return "";
  return raw.replace(/^\(+/, "").replace(/\)+$/, "").trim();
};

export const norm = (s: string) => (s || "").trim().toLowerCase();

export const computeUnitPrice = (item: MenuItemFull, isTakeaway: boolean) => {
  const base = Number(item.valor) || 0;
  const extra = isTakeaway && item.para_llevar ? Number(item.precio_adicional_llevar) || 0 : 0;
  return base + extra;
};

export const groupBaseNameForPiquete = (name: string) =>
  (name || "").replace(/(\d{2,3}[.,]?\d{3})|\d{4,}$/g, "").trim();

export const splitOutsideParens = (s: string, separators = [";"]) => {
  const sepSet = new Set(separators);
  const out: string[] = [];
  let buf = "";
  let depth = 0;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);

    if (depth === 0 && sepSet.has(ch)) {
      if (buf.trim()) out.push(buf.trim());
      buf = "";
    } else {
      buf += ch;
    }
  }

  if (buf.trim()) out.push(buf.trim());
  return out;
};

export const splitByCommaOutsideParens = (s: string) => splitOutsideParens(s, [","]);

export const parseDetailsForView = (raw: string) => {
  if (!raw) return [];

  const itemStrings = splitOutsideParens(raw, [";", "|"])
    .map((x) => x.trim())
    .filter(Boolean);

  return itemStrings.map((itemStr) => {
    const parts = splitByCommaOutsideParens(itemStr).map((x) => x.trim());

    let quantity = 1;
    let name = "";
    let priceTotal = 0;

    if (parts.length >= 3) {
      quantity = parseInt(parts[0].replace(/^-/, ""), 10) || 1;
      name = parts.slice(1, parts.length - 1).join(", ").trim();
      priceTotal = toInt(parts[parts.length - 1]);
    } else if (parts.length === 2) {
      quantity = 1;
      name = parts[0];
      priceTotal = toInt(parts[1]);
    } else {
      name = parts[0] || "Item";
      priceTotal = 0;
    }

    return { quantity, name, priceTotal };
  });
};

export const serializeCartToDetalle = (items: CartItem[]) =>
  items
    .map((i) => {
      const note = normalizeNote(i.notes);
      const nameWithNote = note ? `${i.name} (${note})` : i.name;
      const lineTotal = (Number(i.priceUnit) || 0) * (Number(i.quantity) || 0);
      return `- ${i.quantity},${nameWithNote} ,${lineTotal};`;
    })
    .join("\n");

export const isTypingElement = (el: EventTarget | null) => {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = (node.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || (node as any).isContentEditable;
};
