"use client";

import { Contrast, Copy, FolderOpen, Plus, Save, SaveAll, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { modKey, type DiagramFile } from "./diagram-file";
import { ChevronDownIcon, GithubIcon, HistoryIcon, MenuIcon, MermaidIcon } from "./icons";
import { Button, Dialog, Popover, Separator, Toggle, buttonClasses } from "./ui";

type MenuEntry = {
  label: string;
  icon: ReactNode;
  href?: string;
  onClick?: () => void;
  sectionEnd?: boolean;
  className?: string;
  newTab?: boolean;
  isDarkToggle?: boolean;
};

type MainMenuProps = {
  newHref: string;
  dark: boolean;
  onToggleDark: () => void;
  file: DiagramFile;
};

function MainMenu({ newHref, dark, onToggleDark, file }: MainMenuProps) {
  const entries: MenuEntry[] = [
    { label: "새로 만들기", icon: <Plus />, href: newHref, newTab: true },
    { label: "복제", icon: <Copy />, href: typeof window === "undefined" ? "#" : window.location.href, newTab: true },
    { label: "열기", icon: <FolderOpen />, onClick: () => void file.open() },
    { label: "저장", icon: <Save />, onClick: () => void file.save() },
    { label: "다른 이름으로 저장", icon: <SaveAll />, onClick: file.saveAs, sectionEnd: true },
    { label: "Mermaid.js", icon: <MermaidIcon />, href: "https://mermaid.js.org", newTab: true },
    { label: "커뮤니티", icon: <Users />, href: "https://discord.gg/sKeNQX4Wtj", newTab: true },
    { label: "다크 모드", icon: <Contrast />, onClick: onToggleDark, isDarkToggle: true },
  ];
  return (
    <Popover
      trigger={({ toggle, open }) => (
        <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={toggle} className="shrink-0 cursor-pointer [&_svg]:size-6">
          <MenuIcon />
          <span className="sr-only">메인 메뉴</span>
        </button>
      )}
      className="mt-2 w-60 p-0"
    >
      {(close) => (
        <ul className="flex flex-col">
          {entries.map((entry) => {
            const content = (
              <>
                <span className="[&_svg]:size-5">{entry.icon}</span>
                <span className="grow">{entry.label}</span>
                {entry.isDarkToggle && (
                  <span
                    className={cn(
                      "relative h-5 w-9 rounded-full transition-colors",
                      dark ? "bg-(--ml-accent)" : "bg-(--ml-input)",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform",
                        dark && "translate-x-4",
                      )}
                    />
                  </span>
                )}
              </>
            );
            const itemClass = cn(
              "flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-(--ml-muted)",
              entry.sectionEnd && "border-b border-(--ml-border)",
              entry.className,
            );
            return (
              <li key={entry.label}>
                {entry.href ? (
                  <a href={entry.href} target={entry.newTab ? "_blank" : undefined} rel="noreferrer" className={itemClass} onClick={close}>
                    {content}
                  </a>
                ) : (
                  <button
                    type="button"
                    className={itemClass}
                    onClick={() => {
                      entry.onClick?.();
                      if (!entry.isDarkToggle) close();
                    }}
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Popover>
  );
}

const githubLinks = [
  { title: "Mermaid JS", href: "https://github.com/mermaid-js/mermaid" },
  { title: "Mermaid Live Editor", href: "https://github.com/mermaid-js/mermaid-live-editor" },
  { title: "Mermaid CLI", href: "https://github.com/mermaid-js/mermaid-cli" },
];

type NavbarProps = MainMenuProps & {
  isMobile: boolean;
  isViewMode: boolean;
  onViewModeChange: (view: boolean) => void;
  historyOpen: boolean;
  onHistoryChange: (open: boolean) => void;
  onShare: () => void;
};

export function Navbar({ isMobile, isViewMode, onViewModeChange, historyOpen, onHistoryChange, onShare, ...menu }: NavbarProps) {
  const { file } = menu;
  return (
    <nav className="z-50 flex p-4 sm:p-6">
      <div className="flex flex-1 items-center gap-2">
        <MainMenu {...menu} />
        <MermaidIcon className="size-6" />
        <Link href="/" className="whitespace-nowrap text-(--ml-accent)">
          Mermaid 에디터
        </Link>
        {file.name && (
          <span
            className="min-w-0 truncate text-sm text-(--ml-muted-foreground)"
            title={file.dirty ? "저장하지 않은 변경 사항이 있습니다" : "저장됨"}
          >
            · {file.name}
            {file.dirty && <span className="ml-1 text-(--ml-accent)">●</span>}
          </span>
        )}
      </div>
      <div id="menu" className="hidden flex-nowrap items-center justify-between gap-3 md:flex">
        <Popover
          align="end"
          trigger={({ toggle, open }) => (
            <Button variant="ghost" size="sm" aria-haspopup="dialog" aria-expanded={open} onClick={toggle} title="GitHub">
              <GithubIcon />
            </Button>
          )}
          className="flex w-fit flex-col gap-1 p-1"
        >
          {(close) =>
            githubLinks.map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer" onClick={close} className={cn(buttonClasses("ghost", "sm"), "justify-start")}>
                {link.title}
              </a>
            ))
          }
        </Popover>
        <Separator />
        <Toggle pressed={historyOpen} onPressedChange={onHistoryChange} title="기록" aria-label="기록">
          <HistoryIcon />
        </Toggle>
        <Button size="sm" onClick={onShare}>
          공유
        </Button>
        <Separator />
        <SaveMenu file={file} />
      </div>
      {isMobile && (
        <div className="flex items-center gap-2">
          편집
          <button
            type="button"
            role="switch"
            aria-checked={isViewMode}
            aria-label="편집과 보기 전환"
            onClick={() => onViewModeChange(!isViewMode)}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
              isViewMode ? "bg-(--ml-accent)" : "bg-(--ml-input)",
            )}
          >
            <span
              className={cn(
                "pointer-events-none block size-5 rounded-full bg-white shadow-lg transition-transform",
                isViewMode ? "translate-x-5" : "translate-x-0",
              )}
            />
          </button>
          보기
        </div>
      )}
    </nav>
  );
}

function SaveMenu({ file }: { file: DiagramFile }) {
  const mod = modKey();
  const items = [
    { label: "저장", shortcut: `${mod}S`, icon: <Save />, run: file.save },
    { label: "다른 이름으로 저장", shortcut: `⇧${mod}S`, icon: <SaveAll />, run: file.saveAs },
    { label: "열기", shortcut: `${mod}O`, icon: <FolderOpen />, run: file.open },
  ];
  return (
    <div className="flex">
      <Button variant="accent" size="sm" className="rounded-r-none [&_svg]:size-4" title={`저장 (${mod}S)`} onClick={() => void file.save()}>
        <Save />
        저장
      </Button>
      <Popover
        align="end"
        trigger={({ toggle, open }) => (
          <Button
            variant="accent"
            size="sm"
            className="rounded-l-none border-l border-white/40 px-1 [&_svg]:size-5"
            aria-label="저장 옵션"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={toggle}
          >
            <ChevronDownIcon />
          </Button>
        )}
        className="flex w-60 flex-col gap-1 p-1"
      >
        {(close) =>
          items.map((item) => (
            <button
              key={item.label}
              type="button"
              className={cn(buttonClasses("ghost", "sm"), "justify-start [&_svg]:size-4")}
              onClick={() => {
                close();
                void item.run();
              }}
            >
              {item.icon}
              <span className="grow text-left">{item.label}</span>
              <kbd className="font-sans text-xs opacity-60">{item.shortcut}</kbd>
            </button>
          ))
        }
      </Popover>
    </div>
  );
}

export function PrivacyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} className="max-h-full overflow-y-auto p-12">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <ShieldCheck className="size-8 text-green-700" />
        데이터 보안
      </h2>
      <p className="text-xl font-semibold">다이어그램은 브라우저 밖으로 나가지 않습니다.</p>
      <p>이 에디터는 다이어그램을 페이지 URL과 브라우저의 로컬 저장소에만 보관합니다.</p>
      <p>
        이 앱은 오픈소스 Mermaid Live Editor(MIT)를 바탕으로 만들었습니다:{" "}
        <a className="underline" href="https://github.com/mermaid-js/mermaid-live-editor" target="_blank" rel="noreferrer">
          mermaid-js/mermaid-live-editor
        </a>
        .
      </p>
    </Dialog>
  );
}
