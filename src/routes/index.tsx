import { createFileRoute } from "@tanstack/react-router";
import DualPixel from "@/components/Editor";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DualPixel — Editor de Fotos Profissional Online" },
      { name: "description", content: "DualPixel: editor de fotos profissional no navegador com camadas, filtros, ajustes, texto e formas. Grátis, sem instalação." },
      { property: "og:title", content: "DualPixel — Editor de Fotos Profissional" },
      { property: "og:description", content: "Editor completo com camadas, filtros, ajustes, texto, formas e histórico. 100% no navegador." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DualPixel,
});
