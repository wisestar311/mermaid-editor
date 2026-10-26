"use client";

import type { MermaidConfig } from "mermaid";
import { useCallback, useEffect, useRef, type RefObject } from "react";
import svgPanZoom from "svg-pan-zoom";
import { Svg2Roughjs } from "svg2roughjs";

import { cn } from "@/lib/utils";

import { renderDiagram } from "./mermaid-runtime";

export type DiagramController = {
  reset: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  getSvg: () => SVGSVGElement | null;
  /** Resolves once the latest render has been placed in the view. */
  whenRendered: () => Promise<void>;
};

type DiagramViewProps = {
  code: string | undefined;
  config: string;
  rough: boolean;
  grid: boolean;
  panZoom: boolean;
  dark: boolean;
  hasError: boolean;
  pan?: { x: number; y: number };
  zoom?: number;
  onPanZoomChange: (pan: { x: number; y: number }, zoom: number) => void;
  controllerRef: RefObject<DiagramController | null>;
};

// mermaid.live zooms out a little after fitting so the diagram clears the toolbars.
const RESET_ZOOM = 0.875;

async function waitForFonts(code: string) {
  const loads = [document.fonts.load('14px "Recursive Variable"')];
  if (/fa[srlbk]?:fa-/.test(code)) {
    loads.push(document.fonts.load('900 16px "Font Awesome 6 Free"'));
  }
  await Promise.allSettled(loads);
}

export function DiagramView({
  code,
  config,
  rough,
  grid,
  panZoom,
  dark,
  hasError,
  pan,
  zoom,
  onPanZoomChange,
  controllerRef,
}: DiagramViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panZoomRef = useRef<SvgPanZoom.Instance | null>(null);
  const dirtyRef = useRef(false);
  const renderRef = useRef<Promise<void>>(Promise.resolve());
  // mermaid.live opens on a freshly fitted view; stored pan/zoom only carries over between re-renders.
  const hasPlacedRef = useRef(false);
  // Latest stored pan/zoom and change handler, read when a fresh render is placed.
  const panZoomStateRef = useRef({ pan, zoom, onPanZoomChange });
  useEffect(() => {
    panZoomStateRef.current = { pan, zoom, onPanZoomChange };
  }, [pan, zoom, onPanZoomChange]);

  const resetView = useCallback(() => {
    const instance = panZoomRef.current;
    if (!instance) return;
    instance.reset();
    instance.zoom(RESET_ZOOM);
    dirtyRef.current = false;
  }, []);

  useEffect(() => {
    controllerRef.current = {
      reset: resetView,
      zoomIn: () => panZoomRef.current?.zoomIn(),
      zoomOut: () => panZoomRef.current?.zoomOut(),
      getSvg: () => containerRef.current?.querySelector("svg") ?? null,
      whenRendered: () => renderRef.current,
    };
  }, [controllerRef, resetView]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || hasError || code === undefined) return;
    let cancelled = false;

    const run = async () => {
      let parsedConfig: MermaidConfig;
      try {
        parsedConfig = JSON.parse(config) as MermaidConfig;
      } catch {
        return;
      }
      await waitForFonts(code);
      const { id, svg, bindFunctions } = await renderDiagram(code, parsedConfig);
      if (cancelled || svg.length === 0) return;

      panZoomRef.current?.destroy();
      panZoomRef.current = null;
      container.innerHTML = svg;
      let graph = container.querySelector<SVGSVGElement>(`#${id}`);
      if (!graph) return;

      if (rough) {
        const sketcher = new Svg2Roughjs(`#${container.id}`);
        sketcher.svg = graph;
        await sketcher.sketch();
        if (cancelled) return;
        graph.remove();
        const sketch = container.querySelector<SVGSVGElement>(":scope > svg");
        if (!sketch) return;
        const width = sketch.getAttribute("width");
        const height = sketch.getAttribute("height");
        sketch.setAttribute("id", "graph-div");
        sketch.setAttribute("height", "100%");
        sketch.setAttribute("width", "100%");
        sketch.setAttribute("viewBox", `0 0 ${width} ${height}`);
        sketch.style.maxWidth = "100%";
        graph = sketch;
      } else {
        graph.setAttribute("height", "100%");
        graph.style.maxWidth = "100%";
        bindFunctions?.(graph);
      }

      if (panZoom) {
        const instance = svgPanZoom(graph, {
          center: true,
          fit: true,
          controlIconsEnabled: false,
          maxZoom: 12,
          minZoom: 0.2,
          onPan: (nextPan) => {
            dirtyRef.current = true;
            panZoomStateRef.current.onPanZoomChange(nextPan, instance.getZoom());
          },
          onZoom: (nextZoom) => {
            dirtyRef.current = true;
            panZoomStateRef.current.onPanZoomChange(instance.getPan(), nextZoom);
          },
        });
        instance.disableDblClickZoom();
        panZoomRef.current = instance;
        const stored = panZoomStateRef.current;
        const canRestore =
          hasPlacedRef.current &&
          stored.pan !== undefined &&
          stored.zoom !== undefined &&
          Number.isFinite(stored.zoom) &&
          Number.isFinite(stored.pan.x) &&
          Number.isFinite(stored.pan.y);
        hasPlacedRef.current = true;
        if (canRestore && stored.pan && stored.zoom) {
          instance.zoom(stored.zoom);
          instance.pan(stored.pan);
        } else {
          resetView();
        }
      }
    };

    renderRef.current = renderRef.current.then(run).catch((error: unknown) => {
      console.error("view fail", error);
    });
    return () => {
      cancelled = true;
    };
  }, [code, config, rough, panZoom, dark, hasError, resetView]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      const instance = panZoomRef.current;
      if (!instance) return;
      instance.resize();
      if (!dirtyRef.current) resetView();
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      panZoomRef.current?.destroy();
      panZoomRef.current = null;
    };
  }, [resetView]);

  return (
    <div id="ml-view" className={cn("h-full w-full", grid && "ml-grid", hasError && "opacity-50")}>
      <div id="ml-container" ref={containerRef} className="h-full overflow-auto" />
    </div>
  );
}
