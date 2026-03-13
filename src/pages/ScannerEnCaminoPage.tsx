import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Play,
  Square,
  Truck,
} from "lucide-react";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
  Html5QrcodeCameraScanConfig,
} from "html5-qrcode";

const ORDERS_API = "https://n8n.alliasoft.com/webhook/luis-res/pedidos";
const SCANNER_REGION_ID = "scanner-en-camino-reader";

type Order = {
  row_number: number;
  fecha?: string;
  nombre?: string;
  numero?: string | number;
  direccion?: string;
  "detalle pedido"?: string;
  detalle_pedido?: string;
  valor_restaurante?: number;
  valor_domicilio?: number;
  metodo_pago?: string;
  estado?: string;
};

type ScanLog = {
  id: string;
  at: string;
  code: string;
  rowNumber?: number;
  status: "ok" | "error" | "info";
  message: string;
};

const barcodeFormats = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
];

const formatTime = (date = new Date()) =>
  date.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const extractRowNumber = (raw: string): number | null => {
  const text = String(raw || "").trim();
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    const candidates = [
      parsed?.row_number,
      parsed?.id,
      parsed?.pedido_id,
      parsed?.pedido?.row_number,
      parsed?.pedido?.id,
    ];

    for (const value of candidates) {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch {}

  const onlyDigits = text.match(/^\d+$/);
  if (onlyDigits) {
    const n = Number(onlyDigits[0]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  const labeled = text.match(/(?:pedido|order|id|row_number)[^\d]{0,8}(\d{1,10})/i);
  if (labeled) {
    const n = Number(labeled[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  const anyNumber = text.match(/(\d{1,10})/);
  if (anyNumber) {
    const n = Number(anyNumber[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  return null;
};

const buildFullPayload = (order: Order, newStatus: string) => ({
  numero: order.numero ?? "",
  nombre: order.nombre ?? "",
  direccion: order.direccion ?? "",
  detalle_pedido: order["detalle pedido"] ?? order.detalle_pedido ?? "",
  valor_restaurante: order.valor_restaurante ?? 0,
  valor_domicilio: order.valor_domicilio ?? 0,
  metodo_pago: order.metodo_pago ?? "",
  estado: newStatus,
});

const ScannerEnCaminoPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [scannerActive, setScannerActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("Listo para escanear");
  const [logs, setLogs] = useState<ScanLog[]>([]);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processedRef = useRef<Map<string, number>>(new Map());
  const isStoppingRef = useRef(false);

  const ordersMap = useMemo(() => {
    const map = new Map<number, Order>();
    orders.forEach((order) => {
      const id = Number(order.row_number);
      if (Number.isFinite(id) && id > 0) map.set(id, order);
    });
    return map;
  }, [orders]);

  const pushLog = useCallback((entry: Omit<ScanLog, "id" | "at">) => {
    const row: ScanLog = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: formatTime(),
      ...entry,
    };
    setLogs((prev) => [row, ...prev].slice(0, 12));
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch(ORDERS_API);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
      setStatus("Pedidos actualizados");
    } catch (error) {
      console.error(error);
      setStatus("No se pudieron cargar los pedidos");
      pushLog({ code: "", status: "error", message: "Error cargando pedidos" });
    } finally {
      setLoadingOrders(false);
    }
  }, [pushLog]);

  const fetchCameras = useCallback(async () => {
    try {
      const list = await Html5Qrcode.getCameras();
      setCameras(list);
      if (!selectedCameraId && list.length) {
        const preferred =
          list.find((cam) => /back|rear|environment|trasera/i.test(cam.label)) ?? list[0];
        setSelectedCameraId(preferred.id);
      }
    } catch (error) {
      console.error(error);
      setStatus("No se pudo acceder a la cámara");
      pushLog({ code: "", status: "error", message: "No se encontraron cámaras" });
    }
  }, [pushLog, selectedCameraId]);

  useEffect(() => {
    fetchOrders();
    fetchCameras();
  }, [fetchOrders, fetchCameras]);

  const postStatusUpdate = useCallback(async (order: Order, newStatus: string) => {
    const payload = buildFullPayload(order, newStatus);
    const res = await fetch(ORDERS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }, []);

  const handleDecoded = useCallback(
    async (decodedText: string) => {
      if (busy) return;

      const key = String(decodedText || "").trim();
      if (!key) return;

      const now = Date.now();
      const last = processedRef.current.get(key) ?? 0;
      if (now - last < 2500) return;
      processedRef.current.set(key, now);

      const rowNumber = extractRowNumber(key);
      if (!rowNumber) {
        setStatus("Código leído sin ID válido");
        pushLog({ code: key, status: "error", message: "No pude extraer el número del pedido" });
        return;
      }

      const order = ordersMap.get(rowNumber);
      if (!order) {
        setStatus(`Pedido #${rowNumber} no encontrado`);
        pushLog({
          code: key,
          rowNumber,
          status: "error",
          message: `Pedido #${rowNumber} no existe en la lista actual`,
        });
        return;
      }

      if ((order.estado || "").toLowerCase().trim() === "en camino") {
        setStatus(`Pedido #${rowNumber} ya estaba en camino`);
        pushLog({
          code: key,
          rowNumber,
          status: "info",
          message: `Pedido #${rowNumber} ya estaba en camino`,
        });
        return;
      }

      setBusy(true);
      setStatus(`Actualizando pedido #${rowNumber}...`);

      try {
        await postStatusUpdate(order, "en camino");
        setOrders((prev) =>
          prev.map((item) =>
            Number(item.row_number) === rowNumber ? { ...item, estado: "en camino" } : item
          )
        );
        setStatus(`Pedido #${rowNumber} marcado como en camino`);
        pushLog({
          code: key,
          rowNumber,
          status: "ok",
          message: `Pedido #${rowNumber} actualizado a en camino`,
        });

        if (navigator.vibrate) navigator.vibrate(120);
      } catch (error) {
        console.error(error);
        setStatus(`Error actualizando pedido #${rowNumber}`);
        pushLog({
          code: key,
          rowNumber,
          status: "error",
          message: `Falló el POST del pedido #${rowNumber}`,
        });
      } finally {
        setBusy(false);
      }
    },
    [busy, ordersMap, postStatusUpdate, pushLog]
  );

  const stopScanner = useCallback(async () => {
    if (!scannerRef.current) return;
    if (isStoppingRef.current) return;

    isStoppingRef.current = true;
    try {
      const scanner = scannerRef.current;
      const state = scanner.getState?.();
      if (state === 2 || state === 3) {
        await scanner.stop();
      }
      await scanner.clear();
    } catch (error) {
      console.warn("No se pudo detener limpiamente el scanner", error);
    } finally {
      scannerRef.current = null;
      setScannerActive(false);
      isStoppingRef.current = false;
    }
  }, []);

  const startScanner = useCallback(async () => {
    if (!selectedCameraId || scannerActive) return;

    try {
      const scanner = new Html5Qrcode(SCANNER_REGION_ID, {
        formatsToSupport: barcodeFormats,
        verbose: false,
      });

      scannerRef.current = scanner;

      const config: Html5QrcodeCameraScanConfig = {
        fps: 10,
        qrbox: { width: 260, height: 160 },
        aspectRatio: 1.777778,
        disableFlip: false,
      };

      await scanner.start(
        selectedCameraId,
        config,
        (decodedText) => {
          handleDecoded(decodedText);
        },
        () => {}
      );

      setScannerActive(true);
      setStatus("Escáner activo");
    } catch (error) {
      console.error(error);
      setStatus("No se pudo iniciar el escáner");
      pushLog({ code: "", status: "error", message: "Error iniciando cámara" });
      await stopScanner();
    }
  }, [handleDecoded, pushLog, scannerActive, selectedCameraId, stopScanner]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-black text-slate-900">Escáner de despacho</h1>
              <p className="mt-1 text-sm text-slate-500">
                Escanea el QR o código de barras del pedido para cambiarlo a <span className="font-bold">en camino</span>.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={fetchOrders}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 font-bold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw size={16} className={loadingOrders ? "animate-spin" : ""} />
                Actualizar pedidos
              </button>

              {!scannerActive ? (
                <button
                  onClick={startScanner}
                  disabled={!selectedCameraId}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 font-bold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Play size={16} />
                  Iniciar escáner
                </button>
              ) : (
                <button
                  onClick={stopScanner}
                  className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-2 font-bold text-white hover:bg-rose-700"
                >
                  <Square size={16} />
                  Detener
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
                <Camera size={18} /> Cámara
              </div>

              <select
                value={selectedCameraId}
                onChange={(e) => setSelectedCameraId(e.target.value)}
                className="mb-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
              >
                {cameras.length === 0 ? (
                  <option value="">No hay cámaras disponibles</option>
                ) : (
                  cameras.map((cam) => (
                    <option key={cam.id} value={cam.id}>
                      {cam.label || `Cámara ${cam.id}`}
                    </option>
                  ))
                )}
              </select>

              <div className="overflow-hidden rounded-3xl border border-dashed border-slate-300 bg-slate-100">
                <div id={SCANNER_REGION_ID} className="min-h-[320px] w-full" />
              </div>

              <div className="mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">
                Estado: {busy ? "procesando..." : status}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
                <Truck size={18} /> Últimos eventos
              </div>

              <div className="space-y-2">
                {logs.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    Aún no hay lecturas.
                  </div>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className={`rounded-2xl border px-4 py-3 text-sm ${
                        log.status === "ok"
                          ? "border-emerald-200 bg-emerald-50"
                          : log.status === "error"
                          ? "border-rose-200 bg-rose-50"
                          : "border-amber-200 bg-amber-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-black text-slate-900">{log.message}</div>
                          <div className="mt-1 break-all text-xs text-slate-500">{log.code || "—"}</div>
                        </div>
                        <div className="shrink-0 text-xs font-bold text-slate-500">{log.at}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 text-sm font-bold text-slate-700">Resumen rápido</div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Pedidos cargados</div>
                  <div className="mt-1 text-3xl font-black text-slate-900">{orders.length}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Cámara seleccionada</div>
                  <div className="mt-1 text-sm font-black text-slate-900 break-words">
                    {cameras.find((c) => c.id === selectedCameraId)?.label || "Sin cámara"}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 text-sm font-bold text-slate-700">Cómo usar</div>
              <div className="space-y-3 text-sm text-slate-600">
                <div className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={16} />
                  <p>Abre la cámara y apunta al QR o código de barras del pedido.</p>
                </div>
                <div className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={16} />
                  <p>Si el pedido existe, se enviará un POST al webhook y el estado cambiará a <b>en camino</b>.</p>
                </div>
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 shrink-0 text-amber-600" size={16} />
                  <p>Para evitar duplicados, el mismo código se ignora durante unos segundos.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScannerEnCaminoPage;
