import React from 'react';
import { 
  Printer, 
  Save, 
  X, 
  MapPin, 
  Phone, 
  User, 
  CreditCard, 
  Clock, 
  ShoppingBasket, 
  Minus, 
  Plus, 
  Search,
  ArrowUpDown
} from 'lucide-react';

/** TIPOS */
export interface Order {
  row_number: number;
  fecha: string;
  nombre?: string;
  numero: string;
  direccion: string;
  "detalle pedido": string;
  valor_restaurante: number;
  valor_domicilio: number;
  metodo_pago: string;
  estado: string;
}

export type MenuItem = {
  id: number | string;
  nombre: string;
  valor: number;
  categorias: string[];
  disponible: boolean;
};

export type CartItem = {
  name: string;
  quantity: number;
  priceUnit: number;
};

/** HELPERS UI */
const money = (n: number) => `$${(n || 0).toLocaleString('es-CO')}`;
const cleanPhone = (raw: string) => raw.replace('@s.whatsapp.net', '').replace(/[^0-9+]/g, '');

const allowedStatuses = [
  'pidiendo', 'confirmado', 'impreso', 'preparando', 'en camino', 'entregado',
] as const;

const getStatusUI = (estado?: string) => {
  const s = (estado || '').toLowerCase().trim();
  if (s === 'pidiendo') return { card: 'bg-yellow-50 border-yellow-300 shadow-yellow-100', badge: 'bg-yellow-100 text-yellow-800 ring-1 ring-yellow-300' };
  if (s === 'confirmado') return { card: 'bg-orange-50 border-orange-300 shadow-orange-100', badge: 'bg-orange-100 text-orange-800 ring-1 ring-orange-300' };
  if (s === 'impreso') return { card: 'bg-blue-50 border-blue-300 shadow-blue-100', badge: 'bg-blue-100 text-blue-800 ring-1 ring-blue-300' };
  if (s === 'entregado') return { card: 'bg-green-50 border-green-300 shadow-green-100', badge: 'bg-green-100 text-green-800 ring-1 ring-green-300' };
  return { card: 'bg-white border-gray-200 shadow-gray-100', badge: 'bg-gray-100 text-gray-800 ring-1 ring-gray-300' };
};

// === LOGICA DE PARSEO ROBUSTA ===
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

const splitByCommaOutsideParens = (s: string): string[] => splitOutsideParens(s, [',']);

const parseDetailsForView = (raw: string) => {
  if (!raw) return [];
  const itemStrings = splitOutsideParens(raw, [';', '|']).map(x => x.trim()).filter(Boolean);
  
  return itemStrings.map(itemStr => {
    const parts = splitByCommaOutsideParens(itemStr).map(x => x.trim());
    
    let quantity = 1;
    let name = '';
    let priceTotal = 0;

    if (parts.length >= 3) {
      quantity = parseInt(parts[0].replace(/^-/, ''), 10) || 1;
      name = parts.slice(1, parts.length - 1).join(', ').trim();
      priceTotal = parseInt(parts[parts.length - 1], 10) || 0;
    } else if (parts.length === 2) {
      quantity = 1; 
      name = parts[0];
      priceTotal = parseInt(parts[1], 10) || 0;
    } else {
      name = parts[0] || 'Item';
    }

    const priceUnit = quantity > 0 ? Math.round(priceTotal / quantity) : 0;
    return { quantity, name, priceTotal, priceUnit };
  });
};

interface TarjetaPedidoProps {
  order: Order;
  isEditing: boolean;
  // Edit State
  editNombre: string; setEditNombre: (v: string) => void;
  editDireccion: string; setEditDireccion: (v: string) => void;
  editValorRest: number;
  editValorDom: number; setEditValorDom: (v: number) => void;
  editMetodoPago: string; setEditMetodoPago: (v: string) => void;
  cartItems: CartItem[]; setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
  // Menu / Actions
  menuSearch: string; setMenuSearch: (v: string) => void;
  menuCat: string; setMenuCat: (v: string) => void;
  filteredMenu: MenuItem[];
  categories: string[];
  addItemToCart: (item: MenuItem) => void;
  decreaseItem: (idx: number) => void;
  // Handlers
  onCancelEdit: () => void;
  onSaveEdit: (o: Order) => void;
  onStartEdit: (o: Order) => void;
  onPrint: (o: Order) => void;
  onStatusChange: (o: Order, status: string) => void;
}

const TarjetaPedido: React.FC<TarjetaPedidoProps> = ({
  order, isEditing,
  editNombre, setEditNombre, editDireccion, setEditDireccion,
  editValorRest, editValorDom, setEditValorDom, editMetodoPago, setEditMetodoPago,
  cartItems, setCartItems,
  menuSearch, setMenuSearch, menuCat, setMenuCat, filteredMenu, categories,
  addItemToCart, decreaseItem,
  onCancelEdit, onSaveEdit, onStartEdit, onPrint, onStatusChange
}) => {
  const phone = cleanPhone(order.numero);
  const ui = getStatusUI(order.estado);
  const total = (order.valor_restaurante || 0) + (order.valor_domicilio || 0);
  
  // === MODO EDICIÓN ===
  if (isEditing) {
    return (
      <div className="md:col-span-2 xl:col-span-3 bg-white border-2 border-gold rounded-xl shadow-2xl relative overflow-hidden ring-4 ring-gold/10 z-30">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gold"></div>
        
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50/50 sticky top-0 z-20">
           <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
             <span className="w-8 h-8 rounded-full bg-gold text-white flex items-center justify-center text-sm">#{order.row_number}</span>
             Editando
           </h3>
           <button onClick={onCancelEdit} className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-full transition-colors"><X size={24}/></button>
        </div>

        <div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-0">
          {/* Columna Izquierda */}
          <div className="order-1 lg:col-span-4 p-4 space-y-4 border-b lg:border-b-0 lg:border-r border-gray-100 bg-white">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Cliente</label>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-gold/20 focus-within:border-gold transition-all">
                <User size={18} className="text-gray-400"/>
                <input value={editNombre} onChange={e => setEditNombre(e.target.value)} className="bg-transparent w-full outline-none text-sm font-medium text-gray-700 break-words" placeholder="Nombre del cliente"/>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Dirección / Notas</label>
              <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-gold/20 focus-within:border-gold transition-all">
                <MapPin size={18} className="text-gray-400 mt-1"/>
                <textarea value={editDireccion} onChange={e => setEditDireccion(e.target.value)} className="bg-transparent w-full outline-none text-sm text-gray-700 resize-none break-words" rows={3} placeholder="Dirección de entrega y notas..."/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Pago</label>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                  <CreditCard size={16} className="text-gray-400"/>
                  <input value={editMetodoPago} onChange={e => setEditMetodoPago(e.target.value)} className="bg-transparent w-full outline-none text-sm text-gray-700" placeholder="Efectivo..."/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Domicilio ($)</label>
                <input type="number" value={editValorDom} onChange={e => setEditValorDom(parseInt(e.target.value || '0', 10))} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none font-medium text-right"/>
              </div>
            </div>
            <div className="pt-6 mt-2">
               <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100">
                 <div className="flex justify-between items-center text-sm text-gray-500 mb-1">
                   <span>Restaurante</span>
                   <span>{money(editValorRest)}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm text-gray-500 mb-3 border-b border-amber-200 pb-2">
                   <span>Domicilio</span>
                   <span>{money(editValorDom)}</span>
                 </div>
                 <div className="flex justify-between items-center text-xl font-bold text-gray-800">
                   <span>Total</span>
                   <span>{money(editValorRest + editValorDom)}</span>
                 </div>
               </div>
            </div>
          </div>

          {/* Columna Derecha */}
          <div className="order-2 lg:col-span-8 flex flex-col bg-gray-50/30">
            <div className="p-3 bg-white border-b border-gray-100 flex items-center justify-between shadow-sm z-10 sticky top-0 lg:static">
              <span className="font-bold text-gray-700 flex items-center gap-2 text-sm"><ShoppingBasket size={18} className="text-gold"/> Productos</span>
              <span className="text-xs font-bold bg-gold/10 text-gold px-2 py-1 rounded-md">{cartItems.length}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[300px] lg:max-h-none min-h-[150px]">
              {cartItems.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-gray-400 opacity-60">
                  <ShoppingBasket size={32} className="mb-2"/>
                  <p className="text-sm">Carrito vacío</p>
                </div>
              )}
              {cartItems.map((item, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 shadow-sm group hover:border-gold/30 transition-colors">
                   
                   {/* 1. Sección Texto (Nombre y Precio Unitario) + Botón Borrar Móvil */}
                   <div className="flex justify-between items-start w-full sm:w-auto sm:flex-1 sm:order-2">
                      <div className="min-w-0">
                         <p className="text-sm font-bold text-gray-800 break-words leading-tight">{item.name}</p>
                         <p className="text-xs text-gray-500 mt-1">{money(item.priceUnit)}</p>
                      </div>
                      {/* Botón borrar solo visible en celular (esquina superior derecha) */}
                      <button onClick={() => setCartItems(prev => prev.filter((_, i) => i !== idx))} className="sm:hidden text-gray-300 hover:text-red-500 p-1 -mr-1 -mt-1 shrink-0">
                         <X size={18}/>
                      </button>
                   </div>

                   {/* 2. Controles de Cantidad y Total (Abajo en Celular, Izquierda/Derecha en Desktop) */}
                   <div className="flex items-center justify-between w-full sm:w-auto sm:shrink-0 sm:order-1 gap-4">
                      {/* Stepper */}
                      <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50 h-8 shrink-0">
                         <button onClick={() => decreaseItem(idx)} className="w-8 h-full flex items-center justify-center hover:bg-red-50 text-gray-500 hover:text-red-500 rounded-l-lg transition-colors"><Minus size={14}/></button>
                         <span className="w-8 text-center font-bold text-sm bg-white h-full flex items-center justify-center border-x border-gray-200">{item.quantity}</span>
                         <button onClick={() => addItemToCart({ nombre: item.name, valor: item.priceUnit } as any)} className="w-8 h-full flex items-center justify-center hover:bg-green-50 text-gray-500 hover:text-green-500 rounded-r-lg transition-colors"><Plus size={14}/></button>
                      </div>
                      
                      {/* Total (Visible en Celular junto a los controles) */}
                      <div className="text-right sm:hidden">
                          <p className="text-sm font-bold text-gray-800">{money(item.quantity * item.priceUnit)}</p>
                      </div>
                   </div>

                   {/* 3. Total y Borrar (Solo Desktop) */}
                   <div className="hidden sm:flex items-center gap-3 text-right shrink-0 sm:order-3">
                     <p className="text-sm font-bold text-gray-800">{money(item.quantity * item.priceUnit)}</p>
                     <button onClick={() => setCartItems(prev => prev.filter((_, i) => i !== idx))} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0"><X size={16}/></button>
                   </div>

                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
              <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input value={menuSearch} onChange={e => setMenuSearch(e.target.value)} placeholder="Buscar..." className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none bg-gray-50 focus:bg-white transition-all"/>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-3 mb-1 scrollbar-hide">
                 {categories.map(c => (
                   <button key={c} onClick={() => setMenuCat(c)} className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap font-bold transition-colors ${menuCat === c ? 'bg-gray-800 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{c}</button>
                 ))}
              </div>
              <div className="h-60 lg:h-32 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 pr-1">
                 {filteredMenu.map(m => (
                   <button key={m.id} onClick={() => addItemToCart(m)} className="text-left bg-white border border-gray-200 p-2.5 rounded-xl hover:border-gold hover:shadow-md transition-all group flex flex-col justify-between h-full active:scale-95">
                     <p className="text-xs font-bold text-gray-700 line-clamp-2 group-hover:text-gold mb-1 break-words">{m.nombre}</p>
                     <p className="text-[10px] font-medium text-gray-500 bg-gray-50 inline-block px-1.5 py-0.5 rounded self-start">{money(m.valor)}</p>
                   </button>
                 ))}
              </div>
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100 pb-2 lg:pb-0">
                <button onClick={onCancelEdit} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors">Cancelar</button>
                <button onClick={() => onSaveEdit(order)} className="flex-1 lg:flex-none justify-center px-6 py-2.5 bg-gold hover:bg-gold/90 text-white rounded-xl font-bold shadow-lg shadow-gold/20 flex items-center gap-2 transform active:scale-95 transition-all"><Save size={18}/> Guardar</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // === MODO LECTURA ===
  const itemsPreview = parseDetailsForView(order["detalle pedido"]);
  
  return (
    <div 
      id={`pedido-${order.row_number}`} 
      className={`rounded-xl border-2 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${ui.card}`}
    >
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
         <div className="flex-1 w-full">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-sm font-bold text-gray-500 bg-white/50 px-2 py-0.5 rounded border border-gray-200/50">#{order.row_number}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${ui.badge}`}>{order.estado}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-900 font-black text-xl leading-tight mb-1">
               <span className="break-words">{order.nombre || 'Cliente'}</span>
               {phone && <a href={`https://wa.me/${phone}`} target="_blank" rel="noopener" className="text-green-500 hover:text-green-600 hover:bg-green-50 p-1.5 rounded-full transition-colors shrink-0" title="Abrir WhatsApp"><Phone size={18}/></a>}
            </div>
            <div className="flex flex-col gap-1 mt-2">
              <p className="text-sm text-gray-600 flex items-start gap-1.5 font-medium">
                <MapPin size={14} className="mt-0.5 shrink-0 text-gray-400"/> 
                <span className="break-words">{order.direccion || 'Sin dirección'}</span>
              </p>
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <Clock size={12}/> {order.fecha}
              </p>
            </div>
         </div>

         <div className="flex flex-col items-end gap-3 w-full sm:w-auto">
            <div className="bg-white/60 p-3 rounded-xl border border-gray-100/50 backdrop-blur-sm w-full sm:w-auto min-w-[140px]">
               <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
                 <span>Rest:</span>
                 <span>{money(order.valor_restaurante)}</span>
               </div>
               <div className="flex justify-between items-center text-xs text-gray-500 mb-1 pb-1 border-b border-gray-200/50">
                 <span>Dom:</span>
                 <span>{money(order.valor_domicilio)}</span>
               </div>
               <div className="flex justify-between items-center mt-1">
                 <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Total</span>
                 <span className="text-lg font-black text-gray-900 leading-none">{money(total)}</span>
               </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={() => onStartEdit(order)} className="flex-1 sm:flex-none justify-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm">Editar</button>
              <button onClick={() => onPrint(order)} className="flex-1 sm:flex-none justify-center px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-black flex items-center gap-2 shadow-md transform active:scale-95 transition-all"><Printer size={16}/> Imprimir</button>
            </div>
         </div>
      </div>

      {/* LISTADO DE ITEMS EN MODO LECTURA */}
      <div className="bg-white/60 rounded-xl border border-gray-200/60 p-1 overflow-hidden text-sm shadow-sm">
        {itemsPreview.length === 0 ? (
           <p className="text-center text-gray-400 text-xs py-2 italic">Sin detalles registrados</p>
        ) : (
          itemsPreview.map((item, idx) => (
            <div key={idx} className="flex justify-between items-start p-2 border-b border-dashed border-gray-200 last:border-0 hover:bg-white/80 transition-colors rounded-lg">
              <div className="flex gap-3 items-start overflow-hidden">
                <span className="font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md text-xs min-w-[28px] text-center shrink-0 mt-0.5">{item.quantity}</span>
                <span className="text-gray-800 font-medium break-words leading-tight">{item.name}</span>
              </div>
              <span className="text-gray-600 text-xs whitespace-nowrap font-bold tabular-nums shrink-0 ml-2">{money(item.priceTotal)}</span>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
         <div className="text-xs font-bold text-gray-500 bg-white/80 border border-gray-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1">
           <CreditCard size={12}/>
           {order.metodo_pago || '—'}
         </div>
         <div className="relative group">
           <select 
              value={order.estado} 
              onChange={(e) => onStatusChange(order, e.target.value)} 
              className="text-xs appearance-none bg-gray-100 hover:bg-gray-200 border border-transparent hover:border-gray-300 rounded-lg px-3 py-1.5 font-bold text-gray-600 cursor-pointer transition-all focus:ring-2 focus:ring-gold/50 outline-none pr-8"
           >
             {allowedStatuses.map(st => <option key={st} value={st}>{st}</option>)}
           </select>
           <ArrowUpDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none opacity-50"/>
         </div>
      </div>
    </div>
  );
};

export default TarjetaPedido;