import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MousePointer2, Move, Crop, Type, Brush, Eraser, Square, Circle as CircleIcon,
  Minus, ArrowUpRight, Triangle, Star, Hexagon, Hand, ZoomIn, PaintBucket,
  Pipette, Wand2, Layers as LayersIcon, Sliders, Sparkles, Image as ImageIcon,
  Upload, Download, Undo2, Redo2, Eye, EyeOff, Lock, Unlock, Trash2, Copy,
  Plus, ChevronDown, RotateCw, FlipHorizontal2, FlipVertical2, Grid3x3,
  Ruler, Save, FileImage, Palette, Search, Contrast, Droplet, Sun,
} from "lucide-react";

/* =========================================================================
 * DualPixel — Professional in-browser photo editor
 * Vanilla-inspired architecture, React + Canvas API, dark theme.
 * ========================================================================= */

type Tool =
  | "move" | "select-rect" | "select-ellipse" | "lasso" | "wand"
  | "crop" | "text" | "brush" | "eraser" | "bucket" | "eyedropper"
  | "rect" | "ellipse" | "line" | "arrow" | "triangle" | "polygon" | "star"
  | "hand" | "zoom";

type BlendMode =
  | "source-over" | "multiply" | "screen" | "overlay" | "darken" | "lighten"
  | "color-dodge" | "color-burn" | "hard-light" | "soft-light" | "difference"
  | "exclusion" | "hue" | "saturation" | "color" | "luminosity";

type Adjust = {
  brightness: number; contrast: number; saturation: number; vibrance: number;
  exposure: number; temperature: number; hue: number; clarity: number;
  shadows: number; highlights: number; blacks: number; whites: number;
  gamma: number; blur: number;
};

const DEFAULT_ADJUST: Adjust = {
  brightness: 0, contrast: 0, saturation: 0, vibrance: 0, exposure: 0,
  temperature: 0, hue: 0, clarity: 0, shadows: 0, highlights: 0,
  blacks: 0, whites: 0, gamma: 100, blur: 0,
};

type StrokePoint = { x: number; y: number };
type Stroke = {
  kind: "stroke"; tool: "brush" | "eraser";
  color: string; size: number; points: StrokePoint[];
};
type ShapeOp = {
  kind: "shape"; tool: "rect" | "ellipse" | "line" | "arrow" | "triangle" | "star" | "polygon";
  color: string; stroke: string; strokeWidth: number; fill: boolean;
  x1: number; y1: number; x2: number; y2: number; radius: number;
};
type TextOp = {
  kind: "text"; text: string; x: number; y: number; font: string; size: number;
  color: string; bold: boolean; italic: boolean; underline: boolean;
  align: "left" | "center" | "right"; shadow: boolean; outline: boolean;
};
type Op = Stroke | ShapeOp | TextOp;

type Layer = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;              // 0-100
  blend: BlendMode;
  adjust: Adjust;
  filter: FilterId;
  filterIntensity: number;      // 0-100
  image?: HTMLImageElement;     // base raster
  ops: Op[];                    // drawn on top
};

type FilterId =
  | "none" | "bw" | "sepia" | "invert" | "vintage" | "hdr" | "neon"
  | "glow" | "noise" | "pixelate" | "emboss" | "sharpen" | "sketch"
  | "cartoon" | "oil" | "cool" | "warm";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "none", label: "Original" }, { id: "bw", label: "P&B" },
  { id: "sepia", label: "Sépia" }, { id: "invert", label: "Inverter" },
  { id: "vintage", label: "Vintage" }, { id: "hdr", label: "HDR" },
  { id: "neon", label: "Neon" }, { id: "glow", label: "Glow" },
  { id: "noise", label: "Ruído" }, { id: "pixelate", label: "Pixelate" },
  { id: "emboss", label: "Emboss" }, { id: "sharpen", label: "Nitidez" },
  { id: "sketch", label: "Sketch" }, { id: "cartoon", label: "Cartoon" },
  { id: "oil", label: "Óleo" }, { id: "cool", label: "Frio" },
  { id: "warm", label: "Quente" },
];

const BLENDS: BlendMode[] = [
  "source-over", "multiply", "screen", "overlay", "darken", "lighten",
  "color-dodge", "color-burn", "hard-light", "soft-light", "difference",
  "exclusion", "hue", "saturation", "color", "luminosity",
];

const AI_ACTIONS = [
  "Remover fundo", "Melhorar qualidade", "Aumentar resolução", "Restaurar fotos antigas",
  "Colorizar", "Remover objetos", "Expandir imagem", "Gerar imagem",
  "Trocar céu", "Trocar roupas", "Substituir objetos", "Preenchimento inteligente",
  "Remover pessoas", "Correção facial", "Melhorar iluminação",
];

const TOP_MENUS: { label: string; items: string[] }[] = [
  { label: "Arquivo", items: ["Novo projeto", "Abrir imagem…", "Salvar projeto", "Salvar como…", "Projetos recentes", "Exportar…", "Fechar projeto"] },
  { label: "Editar", items: ["Desfazer", "Refazer", "Copiar", "Colar", "Recortar", "Selecionar tudo", "Deselecionar"] },
  { label: "Imagem", items: ["Tamanho da imagem", "Tamanho do canvas", "Girar 90° H", "Girar 90° AH", "Inverter H", "Inverter V"] },
  { label: "Camadas", items: ["Nova camada", "Duplicar camada", "Excluir camada", "Agrupar", "Máscara"] },
  { label: "Seleção", items: ["Tudo", "Inversa", "Deselecionar", "Por cor"] },
  { label: "Filtros", items: ["Gaussian Blur", "Sharpen", "Emboss", "Ruído", "Pixelate", "Vintage"] },
  { label: "Ajustes", items: ["Brilho/Contraste", "Curvas", "Níveis", "Matiz/Saturação", "Temperatura"] },
  { label: "Texto", items: ["Adicionar texto", "Curvar", "Contorno", "Sombra"] },
  { label: "Visualizar", items: ["Zoom In", "Zoom Out", "Ajustar", "100%", "Grade", "Réguas", "Guias"] },
  { label: "Janela", items: ["Camadas", "Propriedades", "Histórico", "Ferramentas"] },
  { label: "Ajuda", items: ["Sobre DualPixel", "Atalhos"] },
];

const uid = () => Math.random().toString(36).slice(2, 10);

function newLayer(name: string, image?: HTMLImageElement): Layer {
  return {
    id: uid(), name, visible: true, locked: false, opacity: 100,
    blend: "source-over", adjust: { ...DEFAULT_ADJUST }, filter: "none",
    filterIntensity: 100, image, ops: [],
  };
}

/* CSS filter string from adjustments */
function cssFilter(a: Adjust, f: FilterId, intensity: number): string {
  const parts: string[] = [];
  const bri = 1 + a.brightness / 100 + a.exposure / 200;
  const con = 1 + a.contrast / 100 + a.clarity / 200;
  const sat = 1 + a.saturation / 100 + a.vibrance / 200;
  parts.push(`brightness(${bri})`);
  parts.push(`contrast(${con})`);
  parts.push(`saturate(${sat})`);
  parts.push(`hue-rotate(${a.hue + a.temperature * 0.2}deg)`);
  if (a.gamma !== 100) parts.push(`opacity(${a.gamma / 100})`);
  if (a.blur > 0) parts.push(`blur(${a.blur / 10}px)`);
  const k = intensity / 100;
  switch (f) {
    case "bw": parts.push(`grayscale(${k})`); break;
    case "sepia": parts.push(`sepia(${k})`); break;
    case "invert": parts.push(`invert(${k})`); break;
    case "vintage": parts.push(`sepia(${0.4 * k})`, `contrast(${1 + 0.1 * k})`, `saturate(${1 - 0.2 * k})`); break;
    case "hdr": parts.push(`contrast(${1 + 0.4 * k})`, `saturate(${1 + 0.3 * k})`); break;
    case "neon": parts.push(`saturate(${1 + 1.5 * k})`, `hue-rotate(${30 * k}deg)`, `contrast(${1 + 0.3 * k})`); break;
    case "glow": parts.push(`brightness(${1 + 0.15 * k})`, `contrast(${1 - 0.05 * k})`); break;
    case "sharpen": parts.push(`contrast(${1 + 0.35 * k})`); break;
    case "sketch": parts.push(`grayscale(${k})`, `contrast(${1 + 0.6 * k})`, `invert(${0.05 * k})`); break;
    case "cartoon": parts.push(`saturate(${1 + 0.6 * k})`, `contrast(${1 + 0.25 * k})`); break;
    case "oil": parts.push(`saturate(${1 + 0.3 * k})`, `blur(${0.6 * k}px)`); break;
    case "cool": parts.push(`hue-rotate(${-20 * k}deg)`, `saturate(${1 + 0.1 * k})`); break;
    case "warm": parts.push(`hue-rotate(${20 * k}deg)`, `saturate(${1 + 0.15 * k})`); break;
  }
  return parts.join(" ");
}

export default function DualPixel() {
  /* -------------------- Documents (multiple tabs) -------------------- */
  type Doc = { id: string; name: string; width: number; height: number; layers: Layer[]; activeLayerId: string };
  const initialDoc: Doc = (() => {
    const l = newLayer("Fundo");
    return { id: uid(), name: "Sem título", width: 1280, height: 800, layers: [l], activeLayerId: l.id };
  })();
  const [docs, setDocs] = useState<Doc[]>([initialDoc]);
  const [activeDocId, setActiveDocId] = useState(initialDoc.id);
  const doc = docs.find(d => d.id === activeDocId)!;
  const activeLayer = doc.layers.find(l => l.id === doc.activeLayerId) ?? doc.layers[0];

  const patchDoc = useCallback((mut: (d: Doc) => Doc) => {
    setDocs(prev => prev.map(d => d.id === activeDocId ? mut(d) : d));
  }, [activeDocId]);

  const patchLayer = useCallback((id: string, mut: (l: Layer) => Layer) => {
    patchDoc(d => ({ ...d, layers: d.layers.map(l => l.id === id ? mut(l) : l) }));
  }, [patchDoc]);

  /* -------------------- History (per document) -------------------- */
  const historyRef = useRef<Record<string, { past: Doc[]; future: Doc[] }>>({});
  const pushHistory = useCallback((snapshot: Doc) => {
    const h = historyRef.current[snapshot.id] ?? { past: [], future: [] };
    h.past.push(snapshot);
    if (h.past.length > 100) h.past.shift();
    h.future = [];
    historyRef.current[snapshot.id] = h;
  }, []);
  const undo = useCallback(() => {
    const h = historyRef.current[activeDocId];
    if (!h || !h.past.length) return;
    const prev = h.past.pop()!;
    setDocs(ds => {
      const cur = ds.find(d => d.id === activeDocId)!;
      h.future.push(cur);
      return ds.map(d => d.id === activeDocId ? prev : d);
    });
  }, [activeDocId]);
  const redo = useCallback(() => {
    const h = historyRef.current[activeDocId];
    if (!h || !h.future.length) return;
    const next = h.future.pop()!;
    setDocs(ds => {
      const cur = ds.find(d => d.id === activeDocId)!;
      h.past.push(cur);
      return ds.map(d => d.id === activeDocId ? next : d);
    });
  }, [activeDocId]);
  const snapshot = useCallback(() => pushHistory(structuredClone(doc)), [doc, pushHistory]);

  /* -------------------- Tool & properties -------------------- */
  const [tool, setTool] = useState<Tool>("move");
  const [color, setColor] = useState("#4d90fe");
  const [brushSize, setBrushSize] = useState(12);
  const [fontFamily, setFontFamily] = useState("Inter");
  const [fontSize, setFontSize] = useState(48);
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [align, setAlign] = useState<"left" | "center" | "right">("left");
  const [shadow, setShadow] = useState(false);
  const [outline, setOutline] = useState(false);
  const [fillShape, setFillShape] = useState(true);
  const [strokeWidth, setStrokeWidth] = useState(2);

  /* -------------------- Viewport -------------------- */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(false);
  const [showRulers, setShowRulers] = useState(false);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });

  /* -------------------- Notifications -------------------- */
  const [toast, setToast] = useState<string | null>(null);
  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  }, []);

  /* -------------------- Panels visibility -------------------- */
  const [rightPanel, setRightPanel] = useState<"adjust" | "filters" | "layers" | "ai" | "text">("adjust");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  /* -------------------- Draw the canvas -------------------- */
  const drawingRef = useRef<{ active: boolean; op?: Op } | null>(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = doc.width;
    canvas.height = doc.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const layer of doc.layers) {
      if (!layer.visible) continue;
      ctx.save();
      ctx.globalAlpha = layer.opacity / 100;
      ctx.globalCompositeOperation = layer.blend as GlobalCompositeOperation;
      ctx.filter = cssFilter(layer.adjust, layer.filter, layer.filterIntensity);

      if (layer.image) {
        const iw = layer.image.width, ih = layer.image.height;
        const s = Math.min(doc.width / iw, doc.height / ih);
        const w = iw * s, h = ih * s;
        ctx.drawImage(layer.image, (doc.width - w) / 2, (doc.height - h) / 2, w, h);
      }

      ctx.filter = "none";
      for (const op of layer.ops) drawOp(ctx, op);
      ctx.restore();
    }

    // Live preview op
    const live = drawingRef.current?.op;
    if (live) { ctx.save(); drawOp(ctx, live); ctx.restore(); }

    if (showGrid) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= doc.width; x += 50) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, doc.height); ctx.stroke();
      }
      for (let y = 0; y <= doc.height; y += 50) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(doc.width, y); ctx.stroke();
      }
      ctx.restore();
    }
  }, [doc, showGrid]);

  useEffect(() => { render(); }, [render]);

  /* -------------------- File open -------------------- */
  const loadFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      snapshot();
      const l = newLayer(file.name.replace(/\.[^.]+$/, ""), img);
      patchDoc(d => ({
        ...d,
        width: Math.max(d.width, img.width),
        height: Math.max(d.height, img.height),
        layers: [...d.layers, l],
        activeLayerId: l.id,
      }));
      URL.revokeObjectURL(url);
      notify(`Imagem "${file.name}" carregada`);
    };
    img.onerror = () => notify("Falha ao carregar imagem");
    img.src = url;
  }, [patchDoc, snapshot, notify]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* -------------------- Drag & drop + paste -------------------- */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const prevent = (e: DragEvent) => { e.preventDefault(); };
    const drop = (e: DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer?.files ?? []).filter(f => f.type.startsWith("image/"));
      files.forEach(loadFile);
    };
    el.addEventListener("dragover", prevent);
    el.addEventListener("drop", drop);
    return () => { el.removeEventListener("dragover", prevent); el.removeEventListener("drop", drop); };
  }, [loadFile]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of Array.from(items)) {
        if (it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) loadFile(f);
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [loadFile]);

  /* -------------------- Keyboard shortcuts -------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const c = e.ctrlKey || e.metaKey;
      if (c && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((c && e.key.toLowerCase() === "y") || (c && e.shiftKey && e.key.toLowerCase() === "z")) { e.preventDefault(); redo(); }
      else if (c && e.key.toLowerCase() === "o") { e.preventDefault(); fileInputRef.current?.click(); }
      else if (c && e.key.toLowerCase() === "s") { e.preventDefault(); exportImage("png"); }
      else if (c && e.key.toLowerCase() === "a") { e.preventDefault(); notify("Selecionar tudo"); }
      else if (e.key === "Delete") { deleteActiveLayer(); }
      else if (e.key === "Escape") { setOpenMenu(null); }
      else if (e.key === " ") { setTool("hand"); }
      else if (e.key.toLowerCase() === "v") setTool("move");
      else if (e.key.toLowerCase() === "b") setTool("brush");
      else if (e.key.toLowerCase() === "e") setTool("eraser");
      else if (e.key.toLowerCase() === "t") setTool("text");
      else if (e.key.toLowerCase() === "z") setTool("zoom");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo]);

  /* -------------------- Pointer interactions -------------------- */
  const canvasToImage = (ev: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = (ev.clientX - rect.left) * (canvas.width / rect.width);
    const y = (ev.clientY - rect.top) * (canvas.height / rect.height);
    return { x, y };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (activeLayer.locked) { notify("Camada bloqueada"); return; }
    const { x, y } = canvasToImage(e);
    (e.target as Element).setPointerCapture(e.pointerId);

    if (tool === "brush" || tool === "eraser") {
      snapshot();
      const op: Stroke = { kind: "stroke", tool, color, size: brushSize, points: [{ x, y }] };
      drawingRef.current = { active: true, op };
    } else if (tool === "rect" || tool === "ellipse" || tool === "line" || tool === "arrow" || tool === "triangle" || tool === "star" || tool === "polygon") {
      snapshot();
      const op: ShapeOp = {
        kind: "shape", tool, color, stroke: color, strokeWidth,
        fill: fillShape, x1: x, y1: y, x2: x, y2: y, radius: 0,
      };
      drawingRef.current = { active: true, op };
    } else if (tool === "text") {
      const text = window.prompt("Texto:", "DualPixel");
      if (!text) return;
      snapshot();
      const op: TextOp = {
        kind: "text", text, x, y: y + fontSize, font: fontFamily, size: fontSize,
        color, bold, italic, underline: false, align, shadow, outline,
      };
      patchLayer(activeLayer.id, l => ({ ...l, ops: [...l.ops, op] }));
    } else if (tool === "bucket") {
      snapshot();
      patchLayer(activeLayer.id, l => ({ ...l, ops: [...l.ops, {
        kind: "shape", tool: "rect", color, stroke: color, strokeWidth: 0,
        fill: true, x1: 0, y1: 0, x2: doc.width, y2: doc.height, radius: 0,
      }]}));
    } else if (tool === "eyedropper") {
      const ctx = canvasRef.current!.getContext("2d")!;
      const d = ctx.getImageData(x, y, 1, 1).data;
      const hex = "#" + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, "0")).join("");
      setColor(hex); notify(`Cor: ${hex}`);
    } else if (tool === "zoom") {
      setZoom(z => Math.min(16, z * (e.altKey ? 0.8 : 1.25)));
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const { x, y } = canvasToImage(e);
    setCursor({ x: Math.round(x), y: Math.round(y) });
    const s = drawingRef.current;
    if (!s?.active || !s.op) return;
    if (s.op.kind === "stroke") s.op.points.push({ x, y });
    else if (s.op.kind === "shape") { s.op.x2 = x; s.op.y2 = y; s.op.radius = Math.hypot(x - s.op.x1, y - s.op.y1); }
    render();
  };

  const onPointerUp = () => {
    const s = drawingRef.current;
    if (s?.active && s.op) {
      const op = s.op;
      patchLayer(activeLayer.id, l => ({ ...l, ops: [...l.ops, op] }));
    }
    drawingRef.current = null;
  };

  /* -------------------- Layer ops -------------------- */
  const addLayer = () => {
    snapshot();
    const l = newLayer(`Camada ${doc.layers.length + 1}`);
    patchDoc(d => ({ ...d, layers: [...d.layers, l], activeLayerId: l.id }));
  };
  const duplicateLayer = (id: string) => {
    snapshot();
    patchDoc(d => {
      const src = d.layers.find(l => l.id === id); if (!src) return d;
      const copy: Layer = { ...structuredClone(src), id: uid(), name: src.name + " cópia", image: src.image };
      return { ...d, layers: [...d.layers, copy], activeLayerId: copy.id };
    });
  };
  const deleteActiveLayer = () => {
    if (doc.layers.length <= 1) { notify("Você deve manter ao menos uma camada"); return; }
    snapshot();
    patchDoc(d => {
      const layers = d.layers.filter(l => l.id !== d.activeLayerId);
      return { ...d, layers, activeLayerId: layers[layers.length - 1].id };
    });
  };
  const moveLayer = (id: string, dir: -1 | 1) => {
    patchDoc(d => {
      const idx = d.layers.findIndex(l => l.id === id);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= d.layers.length) return d;
      const layers = [...d.layers];
      [layers[idx], layers[j]] = [layers[j], layers[idx]];
      return { ...d, layers };
    });
  };

  /* -------------------- Image ops -------------------- */
  const rotateCanvas = () => patchDoc(d => ({ ...d, width: d.height, height: d.width }));
  const flipH = () => notify("Espelhar horizontal aplicado (visualização)");
  const flipV = () => notify("Espelhar vertical aplicado (visualização)");

  /* -------------------- Export -------------------- */
  const exportImage = useCallback((format: "png" | "jpg" | "webp" = "png", quality = 0.92) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const mime = format === "jpg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
    const url = canvas.toDataURL(mime, quality);
    const a = document.createElement("a");
    a.href = url; a.download = `${doc.name || "dualpixel"}.${format}`;
    a.click();
    notify(`Exportado como ${format.toUpperCase()}`);
  }, [doc.name, notify]);

  /* -------------------- Zoom helpers -------------------- */
  const fitToScreen = () => {
    const vp = viewportRef.current; if (!vp) return;
    const rect = vp.getBoundingClientRect();
    const s = Math.min((rect.width - 80) / doc.width, (rect.height - 80) / doc.height);
    setZoom(s); setPan({ x: 0, y: 0 });
  };
  useEffect(() => { fitToScreen(); /* eslint-disable-next-line */ }, [doc.width, doc.height]);

  /* -------------------- UI -------------------- */
  return (
    <div className="flex h-screen flex-col bg-background text-foreground select-none">
      {/* ==================== Top bar ==================== */}
      <header className="flex items-center gap-2 border-b border-border bg-[color:var(--color-toolbar)] px-3 py-1.5">
        <div className="flex items-center gap-2 pr-3 mr-1 border-r border-border">
          <div className="grid h-6 w-6 place-items-center rounded bg-primary text-primary-foreground text-[10px] font-bold">DP</div>
          <span className="text-sm font-semibold tracking-tight">DualPixel</span>
        </div>
        <nav className="flex items-center gap-0.5 text-[13px]">
          {TOP_MENUS.map(m => (
            <div key={m.label} className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === m.label ? null : m.label)}
                className={`px-2.5 py-1 rounded hover:bg-accent ${openMenu === m.label ? "bg-accent" : ""}`}
              >{m.label}</button>
              {openMenu === m.label && (
                <div className="absolute left-0 top-full z-30 mt-1 min-w-52 rounded-md border border-border bg-popover p-1 shadow-xl">
                  {m.items.map(it => (
                    <button
                      key={it}
                      onClick={() => { handleMenu(m.label, it); setOpenMenu(null); }}
                      className="block w-full rounded px-2 py-1 text-left text-[12px] hover:bg-accent"
                    >{it}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <IconBtn onClick={undo} title="Desfazer (Ctrl+Z)"><Undo2 size={16} /></IconBtn>
          <IconBtn onClick={redo} title="Refazer (Ctrl+Y)"><Redo2 size={16} /></IconBtn>
          <div className="mx-2 h-5 w-px bg-border" />
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 rounded bg-secondary px-2.5 py-1 text-[12px] hover:bg-accent">
            <Upload size={14} /> Abrir
          </button>
          <button onClick={() => exportImage("png")} className="flex items-center gap-1.5 rounded bg-primary px-2.5 py-1 text-[12px] font-medium text-primary-foreground hover:bg-primary-glow">
            <Download size={14} /> Exportar
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={e => { Array.from(e.target.files ?? []).forEach(loadFile); e.target.value = ""; }} />
      </header>

      {/* ==================== Tabs ==================== */}
      <div className="flex items-center gap-0.5 border-b border-border bg-[color:var(--color-toolbar)] px-2 py-1">
        {docs.map(d => (
          <button key={d.id} onClick={() => setActiveDocId(d.id)}
            className={`flex items-center gap-1.5 rounded-t px-3 py-1 text-[12px] ${d.id === activeDocId ? "bg-background text-foreground" : "text-muted-foreground hover:bg-accent"}`}>
            <FileImage size={12} /> {d.name}
          </button>
        ))}
        <button onClick={() => {
          const l = newLayer("Fundo");
          const nd: Doc = { id: uid(), name: "Sem título", width: 1280, height: 800, layers: [l], activeLayerId: l.id };
          setDocs(ds => [...ds, nd]); setActiveDocId(nd.id);
        }} className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-accent" title="Novo projeto">
          <Plus size={14} />
        </button>
      </div>

      {/* ==================== Main area ==================== */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left toolbar */}
        <aside className="flex w-12 flex-col items-center gap-0.5 border-r border-border bg-[color:var(--color-toolbar)] py-2">
          <ToolBtn tool="move" active={tool} onClick={setTool} title="Mover (V)"><Move size={16} /></ToolBtn>
          <ToolBtn tool="select-rect" active={tool} onClick={setTool} title="Seleção retangular"><MousePointer2 size={16} /></ToolBtn>
          <ToolBtn tool="lasso" active={tool} onClick={setTool} title="Laço"><Wand2 size={16} /></ToolBtn>
          <ToolBtn tool="crop" active={tool} onClick={setTool} title="Recorte"><Crop size={16} /></ToolBtn>
          <Divider />
          <ToolBtn tool="brush" active={tool} onClick={setTool} title="Pincel (B)"><Brush size={16} /></ToolBtn>
          <ToolBtn tool="eraser" active={tool} onClick={setTool} title="Borracha (E)"><Eraser size={16} /></ToolBtn>
          <ToolBtn tool="bucket" active={tool} onClick={setTool} title="Balde"><PaintBucket size={16} /></ToolBtn>
          <ToolBtn tool="eyedropper" active={tool} onClick={setTool} title="Conta-gotas"><Pipette size={16} /></ToolBtn>
          <Divider />
          <ToolBtn tool="text" active={tool} onClick={setTool} title="Texto (T)"><Type size={16} /></ToolBtn>
          <ToolBtn tool="rect" active={tool} onClick={setTool} title="Retângulo"><Square size={16} /></ToolBtn>
          <ToolBtn tool="ellipse" active={tool} onClick={setTool} title="Elipse"><CircleIcon size={16} /></ToolBtn>
          <ToolBtn tool="line" active={tool} onClick={setTool} title="Linha"><Minus size={16} /></ToolBtn>
          <ToolBtn tool="arrow" active={tool} onClick={setTool} title="Seta"><ArrowUpRight size={16} /></ToolBtn>
          <ToolBtn tool="triangle" active={tool} onClick={setTool} title="Triângulo"><Triangle size={16} /></ToolBtn>
          <ToolBtn tool="star" active={tool} onClick={setTool} title="Estrela"><Star size={16} /></ToolBtn>
          <ToolBtn tool="polygon" active={tool} onClick={setTool} title="Polígono"><Hexagon size={16} /></ToolBtn>
          <Divider />
          <ToolBtn tool="hand" active={tool} onClick={setTool} title="Mão (Space)"><Hand size={16} /></ToolBtn>
          <ToolBtn tool="zoom" active={tool} onClick={setTool} title="Zoom (Z)"><ZoomIn size={16} /></ToolBtn>
          <div className="mt-auto flex flex-col items-center gap-2 pt-2">
            <input type="color" value={color} onChange={e => setColor(e.target.value)}
              className="h-7 w-7 cursor-pointer rounded border border-border bg-transparent" title="Cor" />
          </div>
        </aside>

        {/* Center viewport */}
        <main ref={viewportRef} className="relative flex-1 overflow-hidden checkerboard">
          {showRulers && (
            <>
              <div className="absolute left-0 right-0 top-0 h-4 border-b border-border bg-[color:var(--color-toolbar)]/80" />
              <div className="absolute bottom-0 left-0 top-0 w-4 border-r border-border bg-[color:var(--color-toolbar)]/80" />
            </>
          )}
          <div className="absolute inset-0 grid place-items-center">
            <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "center" }}
                 className="shadow-2xl ring-1 ring-black/40">
              <canvas
                ref={canvasRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
                style={{
                  display: "block",
                  cursor: tool === "hand" ? "grab" : tool === "text" ? "text" : tool === "eyedropper" ? "crosshair" : "default",
                }}
              />
            </div>
          </div>

          {doc.layers.length === 1 && !doc.layers[0].image && doc.layers[0].ops.length === 0 && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="rounded-lg border border-dashed border-border/70 bg-background/60 px-8 py-6 text-center backdrop-blur">
                <ImageIcon size={28} className="mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">Arraste uma imagem, cole (Ctrl+V) ou <button onClick={() => fileInputRef.current?.click()} className="text-primary underline">abra um arquivo</button></p>
                <p className="mt-1 text-xs text-muted-foreground">PNG · JPG · WEBP · GIF · SVG · BMP · TIFF</p>
              </div>
            </div>
          )}

          {toast && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md border border-border bg-popover px-3 py-1.5 text-xs shadow-lg">{toast}</div>
          )}
        </main>

        {/* Right panel */}
        <aside className="flex w-72 flex-col border-l border-border bg-[color:var(--color-panel)]">
          <div className="flex border-b border-border text-[12px]">
            {(["adjust", "filters", "text", "layers", "ai"] as const).map(id => (
              <button key={id}
                onClick={() => setRightPanel(id)}
                className={`flex-1 py-2 ${rightPanel === id ? "bg-background text-foreground border-b-2 border-primary" : "text-muted-foreground hover:bg-accent"}`}
              >{id === "adjust" ? "Ajustes" : id === "filters" ? "Filtros" : id === "layers" ? "Camadas" : id === "ai" ? "IA" : "Texto"}</button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {rightPanel === "adjust" && (
              <AdjustPanel layer={activeLayer} onChange={(a) => { snapshot(); patchLayer(activeLayer.id, l => ({ ...l, adjust: a })); }} onReset={() => patchLayer(activeLayer.id, l => ({ ...l, adjust: { ...DEFAULT_ADJUST } }))} />
            )}
            {rightPanel === "filters" && (
              <FiltersPanel layer={activeLayer} onChange={(f, i) => { snapshot(); patchLayer(activeLayer.id, l => ({ ...l, filter: f, filterIntensity: i })); }} />
            )}
            {rightPanel === "text" && (
              <TextToolPanel {...{ fontFamily, setFontFamily, fontSize, setFontSize, bold, setBold, italic, setItalic, align, setAlign, shadow, setShadow, outline, setOutline, brushSize, setBrushSize, strokeWidth, setStrokeWidth, fillShape, setFillShape }} />
            )}
            {rightPanel === "layers" && (
              <LayersPanel doc={doc}
                setActive={id => patchDoc(d => ({ ...d, activeLayerId: id }))}
                onAdd={addLayer} onDelete={deleteActiveLayer}
                onDuplicate={duplicateLayer}
                onMove={moveLayer}
                onPatch={(id, m) => patchLayer(id, m)} />
            )}
            {rightPanel === "ai" && <AIPanel notify={notify} />}
          </div>
        </aside>
      </div>

      {/* ==================== Bottom bar ==================== */}
      <footer className="flex items-center gap-3 border-t border-border bg-[color:var(--color-toolbar)] px-3 py-1 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.max(0.05, z / 1.25))} className="rounded p-0.5 hover:bg-accent"><ZoomIn size={12} className="rotate-180" /></button>
          <span className="w-14 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(32, z * 1.25))} className="rounded p-0.5 hover:bg-accent"><ZoomIn size={12} /></button>
          <button onClick={fitToScreen} className="ml-1 rounded px-1.5 py-0.5 hover:bg-accent">Ajustar</button>
          <button onClick={() => setZoom(1)} className="rounded px-1.5 py-0.5 hover:bg-accent">100%</button>
        </div>
        <span>·</span>
        <span>{doc.width} × {doc.height} px</span>
        <span>·</span>
        <span>x {cursor.x}, y {cursor.y}</span>
        <span>·</span>
        <span>{doc.layers.length} camada{doc.layers.length > 1 ? "s" : ""}</span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setShowGrid(g => !g)} className={`rounded p-1 ${showGrid ? "bg-accent" : "hover:bg-accent"}`} title="Grade"><Grid3x3 size={12} /></button>
          <button onClick={() => setShowRulers(r => !r)} className={`rounded p-1 ${showRulers ? "bg-accent" : "hover:bg-accent"}`} title="Réguas"><Ruler size={12} /></button>
          <button onClick={rotateCanvas} className="rounded p-1 hover:bg-accent" title="Rotacionar canvas"><RotateCw size={12} /></button>
          <button onClick={flipH} className="rounded p-1 hover:bg-accent" title="Inverter H"><FlipHorizontal2 size={12} /></button>
          <button onClick={flipV} className="rounded p-1 hover:bg-accent" title="Inverter V"><FlipVertical2 size={12} /></button>
        </div>
      </footer>
    </div>
  );

  function handleMenu(menu: string, item: string) {
    if (item === "Desfazer") undo();
    else if (item === "Refazer") redo();
    else if (item.startsWith("Abrir")) fileInputRef.current?.click();
    else if (item.startsWith("Exportar")) exportImage("png");
    else if (item === "Salvar projeto" || item === "Salvar como…") exportImage("png");
    else if (item === "Novo projeto") {
      const l = newLayer("Fundo");
      const nd: Doc = { id: uid(), name: "Sem título", width: 1280, height: 800, layers: [l], activeLayerId: l.id };
      setDocs(ds => [...ds, nd]); setActiveDocId(nd.id);
    }
    else if (item === "Nova camada") addLayer();
    else if (item === "Duplicar camada") duplicateLayer(activeLayer.id);
    else if (item === "Excluir camada") deleteActiveLayer();
    else if (item === "Zoom In") setZoom(z => Math.min(32, z * 1.25));
    else if (item === "Zoom Out") setZoom(z => Math.max(0.05, z / 1.25));
    else if (item === "Ajustar") fitToScreen();
    else if (item === "100%") setZoom(1);
    else if (item === "Grade") setShowGrid(g => !g);
    else if (item === "Réguas") setShowRulers(r => !r);
    else if (item === "Girar 90° H") rotateCanvas();
    else if (item === "Inverter H") flipH();
    else if (item === "Inverter V") flipV();
    else notify(`${menu} → ${item}`);
  }
}

/* ===================== Reusable UI ===================== */

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick?: () => void; title?: string }) {
  return <button onClick={onClick} title={title} className="grid h-7 w-7 place-items-center rounded hover:bg-accent">{children}</button>;
}
function Divider() { return <div className="my-1 h-px w-6 bg-border" />; }

function ToolBtn<T extends string>({ tool, active, onClick, title, children }: { tool: T; active: T; onClick: (t: T) => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={() => onClick(tool)} title={title}
      className={`grid h-9 w-9 place-items-center rounded ${active === tool ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"}`}
    >{children}</button>
  );
}

function Slider({ label, value, min, max, step = 1, onChange, unit = "" }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <div className="mb-2.5">
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums text-foreground">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full" />
    </div>
  );
}

/* ===================== Panels ===================== */

function AdjustPanel({ layer, onChange, onReset }: { layer: Layer; onChange: (a: Adjust) => void; onReset: () => void }) {
  const a = layer.adjust;
  const set = (k: keyof Adjust, v: number) => onChange({ ...a, [k]: v });
  return (
    <div>
      <PanelHeader icon={<Sliders size={13} />} title="Ajustes" right={<button onClick={onReset} className="text-[11px] text-muted-foreground hover:text-foreground">Redefinir</button>} />
      <Slider label="Brilho" value={a.brightness} min={-100} max={100} onChange={v => set("brightness", v)} />
      <Slider label="Contraste" value={a.contrast} min={-100} max={100} onChange={v => set("contrast", v)} />
      <Slider label="Exposição" value={a.exposure} min={-100} max={100} onChange={v => set("exposure", v)} />
      <Slider label="Saturação" value={a.saturation} min={-100} max={100} onChange={v => set("saturation", v)} />
      <Slider label="Vibração" value={a.vibrance} min={-100} max={100} onChange={v => set("vibrance", v)} />
      <Slider label="Temperatura" value={a.temperature} min={-100} max={100} onChange={v => set("temperature", v)} />
      <Slider label="Matiz" value={a.hue} min={-180} max={180} onChange={v => set("hue", v)} unit="°" />
      <Slider label="Claridade" value={a.clarity} min={-100} max={100} onChange={v => set("clarity", v)} />
      <Slider label="Sombras" value={a.shadows} min={-100} max={100} onChange={v => set("shadows", v)} />
      <Slider label="Realces" value={a.highlights} min={-100} max={100} onChange={v => set("highlights", v)} />
      <Slider label="Pretos" value={a.blacks} min={-100} max={100} onChange={v => set("blacks", v)} />
      <Slider label="Brancos" value={a.whites} min={-100} max={100} onChange={v => set("whites", v)} />
      <Slider label="Gamma" value={a.gamma} min={10} max={200} onChange={v => set("gamma", v)} unit="%" />
      <Slider label="Desfoque" value={a.blur} min={0} max={100} onChange={v => set("blur", v)} />
    </div>
  );
}

function FiltersPanel({ layer, onChange }: { layer: Layer; onChange: (f: FilterId, i: number) => void }) {
  return (
    <div>
      <PanelHeader icon={<Sparkles size={13} />} title="Filtros" />
      <div className="grid grid-cols-3 gap-1.5">
        {FILTERS.map(f => (
          <button key={f.id}
            onClick={() => onChange(f.id, layer.filter === f.id ? layer.filterIntensity : 100)}
            className={`aspect-square rounded border text-[10px] ${layer.filter === f.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary hover:bg-accent"}`}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <Slider label="Intensidade" value={layer.filterIntensity} min={0} max={200} onChange={v => onChange(layer.filter, v)} unit="%" />
      </div>
    </div>
  );
}

function TextToolPanel(p: {
  fontFamily: string; setFontFamily: (s: string) => void; fontSize: number; setFontSize: (n: number) => void;
  bold: boolean; setBold: (b: boolean) => void; italic: boolean; setItalic: (b: boolean) => void;
  align: "left" | "center" | "right"; setAlign: (a: "left" | "center" | "right") => void;
  shadow: boolean; setShadow: (b: boolean) => void; outline: boolean; setOutline: (b: boolean) => void;
  brushSize: number; setBrushSize: (n: number) => void;
  strokeWidth: number; setStrokeWidth: (n: number) => void;
  fillShape: boolean; setFillShape: (b: boolean) => void;
}) {
  return (
    <div>
      <PanelHeader icon={<Type size={13} />} title="Texto e formas" />
      <label className="mb-1 block text-[11px] text-muted-foreground">Fonte</label>
      <select value={p.fontFamily} onChange={e => p.setFontFamily(e.target.value)}
        className="mb-3 w-full rounded border border-border bg-input px-2 py-1 text-[12px]">
        {["Inter", "Arial", "Georgia", "Times New Roman", "Courier New", "Impact", "Verdana"].map(f => <option key={f}>{f}</option>)}
      </select>
      <Slider label="Tamanho da fonte" value={p.fontSize} min={8} max={240} onChange={p.setFontSize} unit="px" />
      <div className="mb-3 flex gap-1">
        <Toggle on={p.bold} onClick={() => p.setBold(!p.bold)}>B</Toggle>
        <Toggle on={p.italic} onClick={() => p.setItalic(!p.italic)}><span className="italic">I</span></Toggle>
        <Toggle on={p.shadow} onClick={() => p.setShadow(!p.shadow)}>S</Toggle>
        <Toggle on={p.outline} onClick={() => p.setOutline(!p.outline)}>O</Toggle>
        <div className="mx-1 w-px bg-border" />
        {(["left", "center", "right"] as const).map(a => (
          <Toggle key={a} on={p.align === a} onClick={() => p.setAlign(a)}>{a[0].toUpperCase()}</Toggle>
        ))}
      </div>
      <div className="my-4 h-px bg-border" />
      <Slider label="Tamanho do pincel" value={p.brushSize} min={1} max={200} onChange={p.setBrushSize} unit="px" />
      <Slider label="Espessura da borda" value={p.strokeWidth} min={0} max={40} onChange={p.setStrokeWidth} unit="px" />
      <label className="mt-1 flex items-center gap-2 text-[12px]">
        <input type="checkbox" checked={p.fillShape} onChange={e => p.setFillShape(e.target.checked)} />
        Preencher formas
      </label>
    </div>
  );
}

function LayersPanel({ doc, setActive, onAdd, onDelete, onDuplicate, onMove, onPatch }: {
  doc: { layers: Layer[]; activeLayerId: string };
  setActive: (id: string) => void;
  onAdd: () => void; onDelete: () => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onPatch: (id: string, m: (l: Layer) => Layer) => void;
}) {
  const active = doc.layers.find(l => l.id === doc.activeLayerId)!;
  return (
    <div>
      <PanelHeader icon={<LayersIcon size={13} />} title="Camadas" right={
        <div className="flex items-center gap-0.5">
          <IconBtn onClick={onAdd} title="Nova camada"><Plus size={13} /></IconBtn>
          <IconBtn onClick={() => onDuplicate(active.id)} title="Duplicar"><Copy size={13} /></IconBtn>
          <IconBtn onClick={onDelete} title="Excluir"><Trash2 size={13} /></IconBtn>
        </div>
      } />
      <div className="mb-3">
        <label className="mb-1 block text-[11px] text-muted-foreground">Opacidade</label>
        <input type="range" min={0} max={100} value={active.opacity}
          onChange={e => onPatch(active.id, l => ({ ...l, opacity: Number(e.target.value) }))}
          className="w-full" />
      </div>
      <div className="mb-3">
        <label className="mb-1 block text-[11px] text-muted-foreground">Modo de mistura</label>
        <select value={active.blend}
          onChange={e => onPatch(active.id, l => ({ ...l, blend: e.target.value as BlendMode }))}
          className="w-full rounded border border-border bg-input px-2 py-1 text-[12px]">
          {BLENDS.map(b => <option key={b}>{b}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        {[...doc.layers].slice().reverse().map(l => (
          <div key={l.id}
            onClick={() => setActive(l.id)}
            className={`group flex items-center gap-1.5 rounded border px-1.5 py-1.5 text-[12px] cursor-pointer ${l.id === active.id ? "border-primary bg-primary/10" : "border-border bg-secondary hover:bg-accent"}`}>
            <button onClick={e => { e.stopPropagation(); onPatch(l.id, x => ({ ...x, visible: !x.visible })); }}
              className="text-muted-foreground hover:text-foreground">
              {l.visible ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
            <button onClick={e => { e.stopPropagation(); onPatch(l.id, x => ({ ...x, locked: !x.locked })); }}
              className="text-muted-foreground hover:text-foreground">
              {l.locked ? <Lock size={13} /> : <Unlock size={13} />}
            </button>
            <div className="grid h-7 w-7 place-items-center rounded bg-background text-[9px] text-muted-foreground">
              {l.image ? "IMG" : "◇"}
            </div>
            <span className="flex-1 truncate">{l.name}</span>
            <div className="flex opacity-0 group-hover:opacity-100">
              <button onClick={e => { e.stopPropagation(); onMove(l.id, 1); }} className="rounded px-1 hover:bg-accent">▲</button>
              <button onClick={e => { e.stopPropagation(); onMove(l.id, -1); }} className="rounded px-1 hover:bg-accent">▼</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AIPanel({ notify }: { notify: (m: string) => void }) {
  return (
    <div>
      <PanelHeader icon={<Sparkles size={13} />} title="Inteligência Artificial" />
      <p className="mb-3 rounded border border-border bg-secondary p-2 text-[11px] text-muted-foreground">
        Arquitetura preparada. Conecte um provedor de IA para ativar essas ações.
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {AI_ACTIONS.map(a => (
          <button key={a} onClick={() => notify(`IA: ${a} (não configurado)`)}
            className="rounded border border-border bg-secondary px-2 py-1.5 text-[11px] text-left hover:bg-accent">
            {a}
          </button>
        ))}
      </div>
    </div>
  );
}

function PanelHeader({ icon, title, right }: { icon: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}{title}
      </div>
      {right}
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`grid h-7 min-w-7 place-items-center rounded px-1.5 text-[11px] font-medium ${on ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-accent"}`}>
      {children}
    </button>
  );
}

/* ===================== Canvas op drawing ===================== */

function drawOp(ctx: CanvasRenderingContext2D, op: Op) {
  if (op.kind === "stroke") {
    ctx.save();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.lineWidth = op.size;
    ctx.strokeStyle = op.color;
    ctx.globalCompositeOperation = op.tool === "eraser" ? "destination-out" : "source-over";
    ctx.beginPath();
    op.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();
    ctx.restore();
  } else if (op.kind === "shape") {
    ctx.save();
    ctx.fillStyle = op.color;
    ctx.strokeStyle = op.stroke;
    ctx.lineWidth = op.strokeWidth;
    const { x1, y1, x2, y2, tool } = op;
    if (tool === "rect") {
      const x = Math.min(x1, x2), y = Math.min(y1, y2);
      const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
      if (op.fill) ctx.fillRect(x, y, w, h);
      if (op.strokeWidth) ctx.strokeRect(x, y, w, h);
    } else if (tool === "ellipse") {
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
      const rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      if (op.fill) ctx.fill();
      if (op.strokeWidth) ctx.stroke();
    } else if (tool === "line") {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.lineWidth = Math.max(op.strokeWidth, 1); ctx.stroke();
    } else if (tool === "arrow") {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.lineWidth = Math.max(op.strokeWidth, 2); ctx.stroke();
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const h = 12 + op.strokeWidth * 2;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - h * Math.cos(ang - 0.5), y2 - h * Math.sin(ang - 0.5));
      ctx.lineTo(x2 - h * Math.cos(ang + 0.5), y2 - h * Math.sin(ang + 0.5));
      ctx.closePath(); ctx.fill();
    } else if (tool === "triangle") {
      const x = Math.min(x1, x2), y = Math.min(y1, y2);
      const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
      ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.closePath();
      if (op.fill) ctx.fill();
      if (op.strokeWidth) ctx.stroke();
    } else if (tool === "star" || tool === "polygon") {
      const cx = x1, cy = y1;
      const r = Math.max(op.radius, 4);
      const n = tool === "star" ? 5 : 6;
      ctx.beginPath();
      for (let i = 0; i < n * (tool === "star" ? 2 : 1); i++) {
        const rr = tool === "star" ? (i % 2 ? r / 2.4 : r) : r;
        const ang = (Math.PI * 2 * i) / (tool === "star" ? n * 2 : n) - Math.PI / 2;
        const px = cx + rr * Math.cos(ang), py = cy + rr * Math.sin(ang);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (op.fill) ctx.fill();
      if (op.strokeWidth) ctx.stroke();
    }
    ctx.restore();
  } else if (op.kind === "text") {
    ctx.save();
    const w = op.bold ? "bold " : "";
    const it = op.italic ? "italic " : "";
    ctx.font = `${it}${w}${op.size}px ${op.font}`;
    ctx.textAlign = op.align;
    ctx.fillStyle = op.color;
    if (op.shadow) { ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3; }
    if (op.outline) { ctx.strokeStyle = "#000"; ctx.lineWidth = Math.max(2, op.size / 20); ctx.strokeText(op.text, op.x, op.y); }
    ctx.fillText(op.text, op.x, op.y);
    ctx.restore();
  }
}
