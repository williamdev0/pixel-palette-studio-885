import { createFileRoute } from "@tanstack/react-router";
import Editor from "@/components/Editor";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PixelLab — Editor de Fotos Online Grátis" },
      { name: "description", content: "Edite fotos no navegador: ajustes, filtros, texto, desenho, recorte e camadas. 100% grátis, sem login." },
      { property: "og:title", content: "PixelLab — Editor de Fotos Online" },
      { property: "og:description", content: "Editor de fotos completo no navegador. Grátis, rápido, sem instalação." },
    ],
  }),
  component: Editor,
});
