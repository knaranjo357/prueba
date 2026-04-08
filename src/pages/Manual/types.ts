export type MenuItemFull = {
  row_number?: number;
  id: number | string;
  disponible: boolean;
  nombre: string;
  descripcion?: string;
  precio_adicional_llevar?: number;
  servicios?: string[];
  categorias: string[];
  para_llevar?: boolean;
  valor: number;
};

export type CartItem = {
  id: string;
  name: string;
  quantity: number;
  baseValor: number;
  extraLlevar: number;
  priceUnit: number;
  notes: string;
};

export type DomicilioRow = {
  row_number?: number;
  barrio: string;
  precio: number;
};

export type ToastType = { type: "success" | "error" | "info"; msg: string } | null;

export type Mode = "mesa" | "llevar" | "recoger";

export type GroupType = "almuerzo" | "piquete" | "single";
export type MenuGroup = { id: string; type: GroupType; title: string; items: MenuItemFull[] };
