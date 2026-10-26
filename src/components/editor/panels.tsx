"use client";

import { diagramData } from "@mermaid-js/examples";
import { useState, type RefObject } from "react";

import { cn } from "@/lib/utils";

import type { DiagramController } from "./diagram-view";
import { exampleTitle, sampleName } from "./ko";
import { ChevronDownIcon, CopyIcon, DownloadIcon, ExternalLinkIcon, ShapesIcon } from "./icons";
import { Button, Card, CopyInput, LinkButton, Popover, buttonClasses } from "./ui";

type SampleExample = { title: string; code: string; isDefault?: boolean };

const extras: Record<string, SampleExample[]> = {
  ZenUML: [
    {
      title: "Order Service",
      isDefault: true,
      code: `zenuml
    title Order Service
    @Actor Client
    @Boundary OrderController
    @EC2 OrderService
    @Starter(Client)
    OrderController.post(payload) {
      OrderService.create(payload) {
        order = new Order(payload)
      }
    }
`,
    },
  ],
};

function getSamples() {
  const samples: Record<string, SampleExample[]> = {};
  for (const diagram of diagramData) {
    if (!diagram.name || !diagram.examples?.length) continue;
    samples[diagram.name.replace(/ (Diagram|Chart|Graph)/, "")] = [...diagram.examples].sort(
      (a, b) => Number(b.isDefault ?? false) - Number(a.isDefault ?? false),
    );
  }
  return { ...samples, ...extras };
}

const samples = getSamples();
const mainDiagrams = ["Flowchart", "Class", "Sequence", "Entity Relationship", "State", "Mindmap"];
const diagramOrder = [
  ...mainDiagrams.filter((name) => name in samples),
  ...Object.keys(samples)
    .filter((name) => !mainDiagrams.includes(name))
    .sort((a, b) => sampleName(a).localeCompare(sampleName(b), "ko")),
];

export function SamplesCard({ onLoad }: { onLoad: (code: string) => void }) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <Card
      title="샘플 다이어그램"
      icon={<ShapesIcon />}
      isOpen={isOpen}
      onToggle={() => setIsOpen((open) => !open)}
      isStackable
    >
      <div className="flex h-fit max-h-52 flex-wrap gap-2 overflow-y-auto p-2">
        {diagramOrder.map((name) => {
          const examples = samples[name];
          return (
            <div key={name} className="flex min-w-20 grow">
              <Button
                size="sm"
                className={cn("grow normal-case", examples.length > 1 && "rounded-r-none")}
                onClick={() => onLoad(examples[0].code)}
              >
                {sampleName(name)}
              </Button>
              {examples.length > 1 && (
                <Popover
                  trigger={({ toggle, open }) => (
                    <button
                      type="button"
                      aria-label={`${sampleName(name)} 예제 선택`}
                      aria-expanded={open}
                      onClick={toggle}
                      className={cn(
                        buttonClasses("default", "sm"),
                        "rounded-l-none border-l border-(--ml-primary-foreground)/30 px-0.5 [&_svg]:size-5",
                      )}
                    >
                      <ChevronDownIcon />
                    </button>
                  )}
                  className="flex w-fit flex-col gap-1 p-1"
                >
                  {(close) =>
                    examples.map((example) => (
                      <button
                        key={example.title}
                        type="button"
                        className={cn(buttonClasses("ghost", "sm"), "justify-start normal-case")}
                        onClick={() => {
                          onLoad(example.code);
                          close();
                        }}
                      >
                        {exampleTitle(example.title)}
                      </button>
                    ))
                  }
                </Popover>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

type ImageSizeMode = "auto" | "width" | "height";

const sizeModeLabels: Record<ImageSizeMode, string> = { auto: "자동", width: "너비", height: "높이" };

type ActionsCardProps = {
  controllerRef: RefObject<DiagramController | null>;
  setExporting: (exporting: boolean) => void;
  backgroundColor: () => string;
  urls: { png: string; svg: string; kroki: string; mdCode: string };
  onLoadCode: (code: string) => void;
};

const FONT_AWESOME_URL = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css";

function fileName(extension: string) {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `mermaid-diagram-${stamp}.${extension}`;
}

function simulateDownload(download: string, href: string) {
  const anchor = document.createElement("a");
  anchor.download = download;
  anchor.href = href;
  anchor.click();
  anchor.remove();
}

function toBase64(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function svgToBase64(svg: SVGSVGElement, background: string, width?: number, height?: number) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  if (height) clone.setAttribute("height", `${height}px`);
  if (width) clone.setAttribute("width", `${width}px`);
  clone.style.backgroundColor = background;
  const markup = clone.outerHTML
    .replaceAll("<br>", "<br/>")
    .replaceAll(/<img([^>]*)>/g, (_match, attributes: string) => `<img ${attributes} />`);
  return toBase64(`<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet href="${FONT_AWESOME_URL}" type="text/css"?>
${markup}`);
}

function DualAction({ label, onClick, href }: { label: string; onClick: () => void; href: string }) {
  return (
    <div className="flex grow gap-0.5">
      <Button className="grow rounded-r-none" onClick={onClick} data-testid={`download-${label}`}>
        <DownloadIcon />
        {label}
      </Button>
      <LinkButton className="rounded-l-none" href={href} target="_blank" rel="noreferrer noopener" aria-label={`mermaid.ink에서 ${label} 열기`}>
        <ExternalLinkIcon />
      </LinkButton>
    </div>
  );
}

export function ActionsCard({ controllerRef, setExporting, backgroundColor, urls, onLoadCode }: ActionsCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sizeMode, setSizeMode] = useState<ImageSizeMode>("auto");
  const [imageSize, setImageSize] = useState(1080);
  const [gistUrl, setGistUrl] = useState("");
  const [gistStatus, setGistStatus] = useState("");

  const exportImage = async (exporter: (canvas: HTMLCanvasElement, image: HTMLImageElement) => void) => {
    setExporting(true);
    // Pan/zoom transforms must be gone before the SVG is rasterized.
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    await controllerRef.current?.whenRendered();
    const svg = controllerRef.current?.getSvg();
    if (!svg) {
      setExporting(false);
      return;
    }
    const box = svg.getBoundingClientRect();
    const viewBox = svg.viewBox?.baseVal;
    const contentWidth = viewBox && viewBox.width > 0 ? viewBox.width : box.width;
    const contentHeight = viewBox && viewBox.height > 0 ? viewBox.height : box.height;
    const canvas = document.createElement("canvas");
    if (sizeMode === "width") {
      canvas.width = imageSize;
      canvas.height = imageSize * (contentHeight / contentWidth);
    } else if (sizeMode === "height") {
      canvas.width = imageSize * (contentWidth / contentHeight);
      canvas.height = imageSize;
    } else {
      canvas.width = contentWidth * 2;
      canvas.height = contentHeight * 2;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      setExporting(false);
      return;
    }
    const background = backgroundColor();
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const image = new Image();
    image.addEventListener("load", () => {
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      exporter(canvas, image);
      setExporting(false);
    });
    image.addEventListener("error", () => setExporting(false));
    image.src = `data:image/svg+xml;base64,${svgToBase64(svg, background, canvas.width, canvas.height)}`;
  };

  const downloadPng = () =>
    exportImage((canvas) => {
      simulateDownload(fileName("png"), canvas.toDataURL("image/png").replace("image/png", "image/octet-stream"));
    });

  const copyImage = () =>
    exportImage((canvas) => {
      canvas.toBlob((blob) => {
        if (!blob) return;
        void navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      });
    });

  const downloadSvg = () => {
    const svg = controllerRef.current?.getSvg();
    if (!svg) return;
    simulateDownload(fileName("svg"), `data:image/svg+xml;base64,${svgToBase64(svg, backgroundColor())}`);
  };

  const loadGist = async () => {
    if (!gistUrl) {
      window.alert("먼저 Gist URL을 입력하세요");
      return;
    }
    const id = gistUrl.split("/").filter(Boolean).pop();
    setGistStatus("불러오는 중…");
    try {
      const response = await fetch(`https://api.github.com/gists/${id}`);
      if (!response.ok) throw new Error(`GitHub 응답 오류 (${response.status})`);
      const gist = (await response.json()) as { files: Record<string, { filename: string; content: string }> };
      const files = Object.values(gist.files);
      const file = files.find((entry) => /\.(mmd|mermaid)$/.test(entry.filename)) ?? files[0];
      if (!file) throw new Error("Gist에 파일이 없습니다");
      onLoadCode(file.content);
      setGistStatus("");
    } catch (error) {
      setGistStatus(error instanceof Error ? error.message : "Gist를 불러오지 못했습니다");
    }
  };

  return (
    <Card
      title="내보내기"
      icon={<DownloadIcon className="rotate-180" />}
      isOpen={isOpen}
      onToggle={() => setIsOpen((open) => !open)}
      isStackable
    >
      <div className="flex min-w-fit flex-col gap-2 p-2">
        <div className="flex w-full items-center gap-2 py-2 whitespace-nowrap">
          PNG 크기
          <div className="flex items-center gap-1" role="group">
            {(["auto", "width", "height"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                data-state={sizeMode === mode ? "on" : "off"}
                aria-pressed={sizeMode === mode}
                onClick={() => setSizeMode(mode)}
                className="inline-flex h-9 cursor-pointer items-center justify-center rounded-[10px] border border-(--ml-input) bg-transparent px-3 text-sm font-medium capitalize shadow-sm transition-colors hover:bg-(--ml-muted) data-[state=on]:bg-(--ml-primary) data-[state=on]:text-(--ml-primary-foreground)"
              >
                {sizeModeLabels[mode]}
              </button>
            ))}
          </div>
          <input
            type="number"
            min={3}
            max={10000}
            disabled={sizeMode === "auto"}
            value={imageSize}
            onChange={(event) => setImageSize(Number(event.target.value))}
            className="h-9 w-full min-w-16 rounded-md border border-(--ml-input) bg-transparent px-3 py-1 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <div className="flex gap-2">
          <DualAction label="PNG" onClick={() => void downloadPng()} href={urls.png} />
          <DualAction label="SVG" onClick={downloadSvg} href={urls.svg} />
          <LinkButton className="grow" href={urls.kroki} target="_blank" rel="noreferrer">
            <ExternalLinkIcon /> Kroki
          </LinkButton>
        </div>
        <div className="h-px w-full bg-(--ml-border)" role="separator" />
        <Button onClick={() => void copyImage()}>
          <CopyIcon />
          이미지 복사
        </Button>
        <CopyInput value={urls.mdCode} label="마크다운 복사" />
        <div className="flex w-full items-center gap-2">
          <input
            type="url"
            value={gistUrl}
            onChange={(event) => setGistUrl(event.target.value)}
            placeholder="Gist URL 입력"
            className="h-9 w-full min-w-0 rounded-md border border-(--ml-input) bg-transparent px-3 py-1 text-sm shadow-sm"
          />
          <Button onClick={() => void loadGist()}>Gist 불러오기</Button>
        </div>
        {gistStatus && <p className="text-sm text-(--ml-muted-foreground)">{gistStatus}</p>}
      </div>
    </Card>
  );
}
