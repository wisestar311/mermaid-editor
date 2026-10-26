"use client";

import { ImageIcon, Mail, Share2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { markdownFor } from "./diagram-file";
import type { DiagramExporter } from "./exporters";
import { Button, CopyInput, Dialog, buttonClasses } from "./ui";

const SHARE_TITLE = "Mermaid 다이어그램";

// Web share intents: each opens the app's own compose page with the diagram link filled in.
const shareTargets: { label: string; href: (url: string, title: string) => string; icon?: ReactNode }[] = [
  { label: "이메일", icon: <Mail />, href: (url, title) => `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}` },
  { label: "X", href: (url, title) => `https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}` },
  { label: "Facebook", href: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  { label: "LinkedIn", href: (url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
  { label: "Telegram", href: (url, title) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}` },
  { label: "LINE", href: (url) => `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}` },
];

type ShareDialogProps = {
  open: boolean;
  onClose: () => void;
  code: string;
  exportDiagram: DiagramExporter;
};

export function ShareDialog({ open, onClose, code, exportDiagram }: ShareDialogProps) {
  const [status, setStatus] = useState("");
  if (!open) return null;

  const url = window.location.href;
  const canShareLink = typeof navigator.share === "function";
  const canShareFiles =
    canShareLink &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [new File([""], "diagram.png", { type: "image/png" })] });

  const share = async (data: ShareData) => {
    setStatus("");
    try {
      await navigator.share(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus(error instanceof Error ? `공유하지 못했습니다: ${error.message}` : "공유하지 못했습니다");
    }
  };

  const shareImage = async () => {
    setStatus("이미지를 만드는 중…");
    try {
      const blob = await exportDiagram("png");
      setStatus("");
      await share({ title: SHARE_TITLE, files: [new File([blob], "diagram.png", { type: "image/png" })] });
    } catch (error) {
      setStatus(error instanceof Error ? `공유하지 못했습니다: ${error.message}` : "공유하지 못했습니다");
    }
  };

  return (
    <Dialog
      open
      onClose={() => {
        setStatus("");
        onClose();
      }}
      className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
    >
      <div className="flex flex-col space-y-1.5 text-center sm:text-left">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Share2 className="size-5" /> 공유
        </h2>
        <p className="text-sm text-(--ml-muted-foreground)">
          링크 안에 다이어그램이 통째로 들어 있어서, 서버에 따로 저장하지 않고도 받은 사람이 바로 열 수 있습니다.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">링크</h3>
        <CopyInput value={url} />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">다른 앱으로 보내기</h3>
        {(canShareLink || canShareFiles) && (
          <div className="flex flex-wrap gap-2">
            {canShareLink && (
              <Button className="grow [&_svg]:size-4" onClick={() => void share({ title: SHARE_TITLE, url })}>
                <Share2 /> 공유 시트 열기
              </Button>
            )}
            {canShareFiles && (
              <Button className="grow [&_svg]:size-4" onClick={() => void shareImage()}>
                <ImageIcon /> 이미지로 공유
              </Button>
            )}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {shareTargets.map((target) => (
            <a
              key={target.label}
              href={target.href(url, SHARE_TITLE)}
              target="_blank"
              rel="noreferrer noopener"
              className={cn(buttonClasses("outline", "sm"), "hover:bg-(--ml-muted) hover:text-(--ml-foreground) [&_svg]:size-4")}
            >
              {target.icon}
              {target.label}
            </a>
          ))}
        </div>
        {canShareLink && (
          <p className="text-xs text-(--ml-muted-foreground)">
            공유 시트에서는 메시지, 메일, 메모, 카카오톡처럼 이 기기에 설치된 앱을 고를 수 있습니다.
          </p>
        )}
        {status && <p className="text-sm text-(--ml-muted-foreground)">{status}</p>}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">문서·위키에 붙여넣기</h3>
        <p className="text-xs text-(--ml-muted-foreground)">
          GitHub, GitLab, Notion, Obsidian은 mermaid 코드 블록을 그대로 다이어그램으로 그립니다.
        </p>
        <CopyInput value={markdownFor(code)} label="코드 블록 복사" multiline />
      </section>
    </Dialog>
  );
}
