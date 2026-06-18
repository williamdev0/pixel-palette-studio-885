import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload, Download, Undo2, Redo2, RotateCw, FlipHorizontal2, FlipVertical2,
  Crop, Type, Brush, Eraser, Square, Circle as CircleIcon, ArrowRight,
  Sliders, Sparkles, Image as ImageIcon, Trash2, ZoomIn, ZoomOut, Maximize2,
} from "lucide-react";

type Adjust = {
  brightness: number; contrast: number; saturate: number; hueRotate: number;
  sepia: number; blur: number; exposure: number; temperature: number; opacity: number;
};

const DEFAULT_ADJUST: Adjust = {
  brightness: 100, contrast: 100, saturate: 100, hueRotate: 0,
  sepia: 0, blur: 0, exposure: 100, temperature: 0, opacity: 100,
};

type FilterPreset = "none" | "bw" | "vintage" | "sepia" | "hdr" | "retro" | "cinema" | "neon" | "pixel";

const FILTERS: { id: FilterPreset; label: string }[] = [
  { id: "none", label: "Original" },
  { id: "bw", label: "P&B" },
  { id: "vintage", label: "Vintage" },
  { id: "sepia", label: "Sépia" },
  { id: "hdr", label: "HDR" },
  { id: "retro", label: "Retrô" },
  { id: "cinema", label: "Cinema" },
  { id: "neon", label: "Neon" },
  { id: "pixel", label: "Pixel" },
];

type Tool = "move" | "crop" | "text" | "brush" | "eraser" | "rect" | "circle" | "line" | "arrow";

type DrawOp =
  | { type: "stroke"; tool: "brush" | "eraser"; color: string; size: number; points: { x: number; y: number }[] }
  | { type: "shape"; tool: "rect" | "circle" | "line" | "arrow"; color: string; size: number; x1: number; y1: number; x2: number; y2: number }
  | { type: "text"; text: string; x: number; y: number; font: string; size: number; color: string; bold: boolean; italic: boolean; shadow: boolean; outline: boolean; rotate: number };

type EditorState = {
  adjust: Adjust;
  filter: FilterPreset;
  rotation: number; // degrees
  flipH: boolean;
  flipV: boolean;
  ops: DrawOp[];
};

const INITIAL_STATE: EditorState = {
  adjust: DEFAULT_ADJUST,
  filter: "none",
  rotation: 0,
  flipH: false,
  flipV: false,
  ops: [],
};

function buildFilterString(a: Adjust, preset: FilterPreset): string {
  const parts: string[] = [];
  // exposure simulated as extra brightness
  parts.push(`brightness(${(a.brightness * (a.exposure / 100)) / 100})`);
  parts.push(`contrast(${a.contrast}%)`);
  parts.push(`saturate(${a.saturate}%)`);
  parts.push(`hue-rotate(${a.hueRotate + a.temperature * 0.3}deg)`);
  parts.push(`sepia(${a.sepia}%)`);
  parts.push(`blur(${a.blur}px)`);
  parts.push(`opacity(${a.opacity}%)`);
  switch (preset) {
    case "bw": parts.push("grayscale(100%)"); break;
    case "vintage": parts.push("sepia(40%) contrast(110%) saturate(80%)"); break;
    case "sepia": parts.push("sepia(80%)"); break;
    case "hdr": parts.push("contrast(140%) saturate(140%)"); break;
    case "retro": parts.push("sepia(30%) hue-rotate(-20deg) saturate(120%)"); break;
    case "cinema": parts.push("contrast(120%) saturate(85%) hue-rotate(-10deg) brightness(0.95)"); break;
    case "neon": parts.push("saturate(220%) contrast(130%) hue-rotate(40deg)"); break;
    case "pixel": break; // handled separately
    default: break;
  }
  return parts.join(" ");
}

export default function Editor() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [state, setState] = useState<EditorState>(INITIAL_STATE);
  const [history, setHistory] = useState<EditorState[]>([]);
  const [future, setFuture] = useState<EditorState[]>([]);
  const [tool, setTool] = useState<Tool>("move");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [activePanel, setActivePanel] = useState<"adjust" | "filters" | "text" | "draw" | "transform">("adjust");

  // drawing controls
  const [brushColor, setBrushColor] = useState("#2563eb");
  const [brushSize, setBrushSize] = useState(8);

  // text controls
  const [textValue, setTextValue] = useState("Seu texto");
  const [textFont, setTextFont] = useState("Inter");
  const [textSize, setTextSize] = useState(48);
  const [textColor, setTextColor] = useState("#111827");
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);
  const [textShadow, setTextShadow] = useState(false);
  const [textOutline, setTextOutline] = useState(false);

  // export
  const [exportFormat, setExportFormat] = useState<"png" | "jpeg" | "webp">("png");
  const [exportQuality, setExportQuality] = useState(0.92);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<{ active: boolean; op: DrawOp | null }>({ active: false, op: null });
  const panRef = useRef<{ active: boolean; sx: number; sy: number; ox: number; oy: number }>({ active: false, sx: 0, sy: 0, ox: 0, oy: 0 });

  const pushHistory = useCallback((next: EditorState) => {
    setHistory((h) => [...h, state]);
    setFuture([]);
    setState(next);
  }, [state]);

  const updateAdjust = (key: keyof Adjust, value: number) => {
    setState((s) => ({ ...s, adjust: { ...s.adjust, [key]: value } }));
  };
  const commitAdjust = () => pushHistory(state);

  const undo = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [state, ...f]);
      setState(prev);
      return h.slice(0, -1);
    });
  };
  const redo = () => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setHistory((h) => [...h, state]);
      setState(next);
      return f.slice(1);
    });
  };

  const loadFile = (file: File) => {
    if (!file.type.match(/image\/(png|jpe?g|webp)/i)) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setState(INITIAL_STATE);
        setHistory([]);
        setFuture([]);
        setOffset({ x: 0, y: 0 });
        setZoom(1);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) loadFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) loadFile(f);
  };

  // Render
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // canvas matches image bounds after rotation
    const rad = (state.rotation * Math.PI) / 180;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));
    const w = image.width * cos + image.height * sin;
    const h = image.width * sin + image.height * cos;
    canvas.width = w;
    canvas.height = h;

    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2);
    ctx.rotate(rad);
    ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
    ctx.filter = buildFilterString(state.adjust, state.filter);
    ctx.drawImage(image, -image.width / 2, -image.height / 2);
    ctx.filter = "none";
    ctx.restore();

    // pixel art post effect
    if (state.filter === "pixel") {
      const size = 8;
      const tmp = document.createElement("canvas");
      tmp.width = Math.ceil(w / size);
      tmp.height = Math.ceil(h / size);
      const tctx = tmp.getContext("2d")!;
      tctx.imageSmoothingEnabled = false;
      tctx.drawImage(canvas, 0, 0, tmp.width, tmp.height);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(tmp, 0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
    }

    // overlay ops
    for (const op of state.ops) drawOp(ctx, op);
    // draft
    if (draftRef.current.op) drawOp(ctx, draftRef.current.op);
  }, [image, state]);

  useEffect(() => { render(); }, [render]);

  function drawOp(ctx: CanvasRenderingContext2D, op: DrawOp) {
    ctx.save();
    if (op.type === "stroke") {
      ctx.strokeStyle = op.color;
      ctx.lineWidth = op.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalCompositeOperation = op.tool === "eraser" ? "destination-out" : "source-over";
      ctx.beginPath();
      op.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke();
    } else if (op.type === "shape") {
      ctx.strokeStyle = op.color;
      ctx.lineWidth = op.size;
      ctx.lineCap = "round";
      if (op.tool === "rect") {
        ctx.strokeRect(op.x1, op.y1, op.x2 - op.x1, op.y2 - op.y1);
      } else if (op.tool === "circle") {
        const cx = (op.x1 + op.x2) / 2;
        const cy = (op.y1 + op.y2) / 2;
        const rx = Math.abs(op.x2 - op.x1) / 2;
        const ry = Math.abs(op.y2 - op.y1) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (op.tool === "line" || op.tool === "arrow") {
        ctx.beginPath();
        ctx.moveTo(op.x1, op.y1);
        ctx.lineTo(op.x2, op.y2);
        ctx.stroke();
        if (op.tool === "arrow") {
          const a = Math.atan2(op.y2 - op.y1, op.x2 - op.x1);
          const head = op.size * 3 + 6;
          ctx.beginPath();
          ctx.moveTo(op.x2, op.y2);
          ctx.lineTo(op.x2 - head * Math.cos(a - Math.PI / 6), op.y2 - head * Math.sin(a - Math.PI / 6));
          ctx.moveTo(op.x2, op.y2);
          ctx.lineTo(op.x2 - head * Math.cos(a + Math.PI / 6), op.y2 - head * Math.sin(a + Math.PI / 6));
          ctx.stroke();
        }
      }
    } else if (op.type === "text") {
      ctx.translate(op.x, op.y);
      ctx.rotate((op.rotate * Math.PI) / 180);
      const style = `${op.italic ? "italic " : ""}${op.bold ? "700 " : "400 "}${op.size}px ${op.font}, sans-serif`;
      ctx.font = style;
      ctx.textBaseline = "top";
      if (op.shadow) {
        ctx.shadowColor = "rgba(0,0,0,0.45)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
      }
      if (op.outline) {
        ctx.strokeStyle = "#000";
        ctx.lineWidth = Math.max(2, op.size / 16);
        ctx.strokeText(op.text, 0, 0);
      }
      ctx.fillStyle = op.color;
      ctx.fillText(op.text, 0, 0);
    }
    ctx.restore();
  }

  // Canvas coords from pointer
  const canvasCoords = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!image) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    if (tool === "move") {
      panRef.current = { active: true, sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
      return;
    }
    const { x, y } = canvasCoords(e);
    if (tool === "text") {
      const op: DrawOp = {
        type: "text", text: textValue, x, y, font: textFont, size: textSize,
        color: textColor, bold: textBold, italic: textItalic, shadow: textShadow, outline: textOutline, rotate: 0,
      };
      pushHistory({ ...state, ops: [...state.ops, op] });
      return;
    }
    if (tool === "brush" || tool === "eraser") {
      draftRef.current = { active: true, op: { type: "stroke", tool, color: brushColor, size: brushSize, points: [{ x, y }] } };
    } else if (tool === "rect" || tool === "circle" || tool === "line" || tool === "arrow") {
      draftRef.current = { active: true, op: { type: "shape", tool, color: brushColor, size: brushSize, x1: x, y1: y, x2: x, y2: y } };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (panRef.current.active) {
      setOffset({ x: panRef.current.ox + (e.clientX - panRef.current.sx), y: panRef.current.oy + (e.clientY - panRef.current.sy) });
      return;
    }
    if (!draftRef.current.active || !draftRef.current.op) return;
    const { x, y } = canvasCoords(e);
    const op = draftRef.current.op;
    if (op.type === "stroke") op.points.push({ x, y });
    else if (op.type === "shape") { op.x2 = x; op.y2 = y; }
    render();
  };

  const onPointerUp = () => {
    if (panRef.current.active) { panRef.current.active = false; return; }
    if (!draftRef.current.active || !draftRef.current.op) return;
    const op = draftRef.current.op;
    draftRef.current = { active: false, op: null };
    pushHistory({ ...state, ops: [...state.ops, op] });
  };

  const rotate90 = () => pushHistory({ ...state, rotation: (state.rotation + 90) % 360 });
  const flipH = () => pushHistory({ ...state, flipH: !state.flipH });
  const flipV = () => pushHistory({ ...state, flipV: !state.flipV });
  const resetAll = () => pushHistory(INITIAL_STATE);
  const clearOverlays = () => pushHistory({ ...state, ops: [] });

  const exportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const mime = exportFormat === "png" ? "image/png" : exportFormat === "jpeg" ? "image/jpeg" : "image/webp";
    const url = canvas.toDataURL(mime, exportFormat === "png" ? undefined : exportQuality);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pixellab.${exportFormat}`;
    a.click();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground">
      {/* Topbar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-none">PixelLab</h1>
            <p className="hidden text-xs text-muted-foreground sm:block">Editor de fotos no navegador</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={undo} disabled={!history.length} className="iconbtn" title="Desfazer (Ctrl+Z)"><Undo2 className="h-4 w-4" /></button>
          <button onClick={redo} disabled={!future.length} className="iconbtn" title="Refazer (Ctrl+Y)"><Redo2 className="h-4 w-4" /></button>
          <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
          <label className="cursor-pointer rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent">
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onUpload} className="hidden" />
            <span className="inline-flex items-center gap-2"><Upload className="h-4 w-4" />Upload</span>
          </label>
          <button onClick={exportImage} disabled={!image} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50">
            <Download className="h-4 w-4" />Baixar
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Left tool rail */}
        <aside className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-sidebar py-3">
          {[
            { id: "move", icon: Maximize2, label: "Mover" },
            { id: "crop", icon: Crop, label: "Recortar" },
            { id: "text", icon: Type, label: "Texto" },
            { id: "brush", icon: Brush, label: "Pincel" },
            { id: "eraser", icon: Eraser, label: "Borracha" },
            { id: "rect", icon: Square, label: "Retângulo" },
            { id: "circle", icon: CircleIcon, label: "Círculo" },
            { id: "line", icon: ArrowRight, label: "Linha/Seta" },
          ].map((t) => (
            <button
              key={t.id}
              title={t.label}
              onClick={() => {
                setTool(t.id as Tool);
                if (t.id === "text") setActivePanel("text");
                if (["brush", "eraser", "rect", "circle", "line"].includes(t.id)) setActivePanel("draw");
              }}
              className={`grid h-10 w-10 place-items-center rounded-lg transition-colors ${tool === t.id ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-accent"}`}
            >
              <t.icon className="h-4 w-4" />
            </button>
          ))}
          <div className="my-2 h-px w-8 bg-border" />
          <button title="Rotacionar" onClick={rotate90} className="iconbtn-rail"><RotateCw className="h-4 w-4" /></button>
          <button title="Espelhar horizontal" onClick={flipH} className="iconbtn-rail"><FlipHorizontal2 className="h-4 w-4" /></button>
          <button title="Espelhar vertical" onClick={flipV} className="iconbtn-rail"><FlipVertical2 className="h-4 w-4" /></button>
          <button title="Limpar desenhos" onClick={clearOverlays} className="iconbtn-rail"><Trash2 className="h-4 w-4" /></button>
        </aside>

        {/* Center canvas */}
        <main
          ref={wrapperRef}
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_1px_1px,_rgba(0,0,0,0.06)_1px,_transparent_0)] [background-size:18px_18px]"
        >
          {!image ? (
            <label className="flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-border bg-card/70 p-10 text-center shadow-sm transition-colors hover:border-primary hover:bg-accent/40">
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onUpload} className="hidden" />
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                <ImageIcon className="h-7 w-7" />
              </div>
              <div>
                <p className="text-lg font-semibold">Arraste uma imagem ou clique para enviar</p>
                <p className="mt-1 text-sm text-muted-foreground">PNG, JPG, JPEG ou WEBP — processado localmente</p>
              </div>
            </label>
          ) : (
            <div
              style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
              className="origin-center transition-transform duration-75"
            >
              <canvas
                ref={canvasRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                className="max-h-[78vh] max-w-[78vw] rounded-md bg-white shadow-2xl ring-1 ring-border"
                style={{ cursor: tool === "move" ? "grab" : "crosshair", touchAction: "none" }}
              />
            </div>
          )}

          {image && (
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card/95 px-2 py-1 shadow-md backdrop-blur">
              <button onClick={() => setZoom((z) => Math.max(0.1, z - 0.1))} className="iconbtn"><ZoomOut className="h-4 w-4" /></button>
              <span className="w-12 text-center text-xs font-medium tabular-nums">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(5, z + 0.1))} className="iconbtn"><ZoomIn className="h-4 w-4" /></button>
              <button onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }} className="iconbtn" title="Ajustar"><Maximize2 className="h-4 w-4" /></button>
            </div>
          )}
        </main>

        {/* Right panel */}
        <aside className="hidden w-80 shrink-0 flex-col border-l border-border bg-sidebar md:flex">
          <nav className="flex border-b border-border">
            {([
              { id: "adjust", label: "Ajustes", icon: Sliders },
              { id: "filters", label: "Filtros", icon: Sparkles },
              { id: "text", label: "Texto", icon: Type },
              { id: "draw", label: "Pincel", icon: Brush },
              { id: "transform", label: "Exportar", icon: Download },
            ] as const).map((p) => (
              <button
                key={p.id}
                onClick={() => setActivePanel(p.id)}
                className={`flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors ${activePanel === p.id ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <p.icon className="h-4 w-4" />
                {p.label}
              </button>
            ))}
          </nav>

          <div className="flex-1 overflow-y-auto p-4">
            {activePanel === "adjust" && (
              <div className="space-y-4">
                {([
                  ["brightness", "Brilho", 0, 200],
                  ["contrast", "Contraste", 0, 200],
                  ["saturate", "Saturação", 0, 200],
                  ["exposure", "Exposição", 0, 200],
                  ["hueRotate", "Matiz", -180, 180],
                  ["temperature", "Temperatura", -100, 100],
                  ["blur", "Nitidez (blur)", 0, 10],
                  ["sepia", "Sépia", 0, 100],
                  ["opacity", "Opacidade", 0, 100],
                ] as const).map(([key, label, min, max]) => (
                  <div key={key}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium text-foreground">{label}</span>
                      <span className="tabular-nums text-muted-foreground">{state.adjust[key]}</span>
                    </div>
                    <input
                      type="range" min={min} max={max} value={state.adjust[key]}
                      onChange={(e) => updateAdjust(key, Number(e.target.value))}
                      onMouseUp={commitAdjust} onTouchEnd={commitAdjust}
                      className="w-full accent-primary"
                    />
                  </div>
                ))}
                <button onClick={resetAll} className="w-full rounded-lg border border-border bg-background py-2 text-sm font-medium transition-colors hover:bg-accent">
                  Resetar tudo
                </button>
              </div>
            )}

            {activePanel === "filters" && (
              <div className="grid grid-cols-2 gap-2">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => pushHistory({ ...state, filter: f.id })}
                    className={`rounded-lg border p-3 text-left text-sm font-medium transition-all ${state.filter === f.id ? "border-primary bg-primary/5 text-primary" : "border-border bg-background hover:border-primary/50"}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            {activePanel === "text" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Selecione a ferramenta Texto e clique no canvas para inserir.</p>
                <label className="block text-xs font-medium">Texto
                  <input value={textValue} onChange={(e) => setTextValue(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </label>
                <label className="block text-xs font-medium">Fonte
                  <select value={textFont} onChange={(e) => setTextFont(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option>Inter</option><option>Space Grotesk</option><option>Georgia</option>
                    <option>Times New Roman</option><option>Courier New</option><option>Impact</option>
                  </select>
                </label>
                <label className="block text-xs font-medium">Tamanho: {textSize}px
                  <input type="range" min={12} max={200} value={textSize} onChange={(e) => setTextSize(Number(e.target.value))} className="w-full accent-primary" />
                </label>
                <label className="block text-xs font-medium">Cor
                  <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-border bg-background" />
                </label>
                <div className="flex flex-wrap gap-2">
                  {([
                    ["B", textBold, setTextBold, "font-bold"],
                    ["I", textItalic, setTextItalic, "italic"],
                    ["Sombra", textShadow, setTextShadow, ""],
                    ["Contorno", textOutline, setTextOutline, ""],
                  ] as const).map(([label, val, set, cls]) => (
                    <button key={label} onClick={() => set(!val)} className={`rounded-lg border px-3 py-1.5 text-xs ${cls} ${val ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activePanel === "draw" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Escolha pincel, borracha ou formas na barra lateral.</p>
                <label className="block text-xs font-medium">Cor
                  <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-border bg-background" />
                </label>
                <label className="block text-xs font-medium">Espessura: {brushSize}px
                  <input type="range" min={1} max={80} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-full accent-primary" />
                </label>
                <div className="grid grid-cols-6 gap-1">
                  {["#000000", "#ffffff", "#ef4444", "#f59e0b", "#10b981", "#2563eb", "#8b5cf6", "#ec4899", "#64748b", "#fbbf24", "#06b6d4", "#84cc16"].map((c) => (
                    <button key={c} onClick={() => setBrushColor(c)} className="aspect-square rounded-md border border-border" style={{ background: c }} />
                  ))}
                </div>
              </div>
            )}

            {activePanel === "transform" && (
              <div className="space-y-3">
                <label className="block text-xs font-medium">Formato
                  <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as "png" | "jpeg" | "webp")} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="png">PNG</option>
                    <option value="jpeg">JPG</option>
                    <option value="webp">WEBP</option>
                  </select>
                </label>
                {exportFormat !== "png" && (
                  <label className="block text-xs font-medium">Qualidade: {Math.round(exportQuality * 100)}%
                    <input type="range" min={10} max={100} value={Math.round(exportQuality * 100)} onChange={(e) => setExportQuality(Number(e.target.value) / 100)} className="w-full accent-primary" />
                  </label>
                )}
                <button onClick={exportImage} disabled={!image} className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
                  <span className="inline-flex items-center gap-2"><Download className="h-4 w-4" />Baixar imagem</span>
                </button>
                <p className="text-xs text-muted-foreground">Processamento 100% local. Sem upload, sem marca d'água.</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      <style>{`
        .iconbtn { display:inline-flex; align-items:center; justify-content:center; height:2rem; width:2rem; border-radius:0.5rem; color:var(--color-foreground); transition: background-color .15s; }
        .iconbtn:hover { background: var(--color-accent); }
        .iconbtn:disabled { opacity:.4; cursor: not-allowed; }
        .iconbtn-rail { display:grid; place-items:center; height:2.5rem; width:2.5rem; border-radius:.5rem; color: var(--color-sidebar-foreground); }
        .iconbtn-rail:hover { background: var(--color-accent); }
      `}</style>
    </div>
  );
}
