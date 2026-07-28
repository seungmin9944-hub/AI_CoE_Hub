"use client";

import { ChangeEvent, ClipboardEvent, DragEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, FileUp, GraduationCap, House, ListPlus, ListX, Sparkles, TrendingUp, Zap } from "lucide-react";
import { defaultPostCover, seedPost, type ContentBlock, type Post, type TableBlock, type TextBlock } from "./content";
import { defaultSiteSettings, type SiteCategory, type SiteSettings } from "./site-settings";

const ideaRecipients = ["seungmin.kim@hanwha.com", "ghcho08@hanwha.com", "taewonkim@hanwha.com", "semin1000@hanwha.com"];
const ideaMailto = `mailto:${ideaRecipients.join(";%20")}?subject=%5BAI%20CoE%5D%20AI%20%ED%99%9C%EC%9A%A9%20%EC%95%84%EC%9D%B4%EB%94%94%EC%96%B4%20%EC%A0%9C%EC%95%88`;
const publicSiteUrl = "https://hanwha-essential-ai-coe.reppy1182952347.chatgpt.site";
const attachmentAccept = ".pdf,.ppt,.pptx,.png,.jpg,.jpeg,.xlsx,.xls,.csv,.zip,.doc,.docx,.txt,.html";
const documentImportAccept = ".docx,.pptx,.pdf";

type Pagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

const emptyPagination: Pagination = { page: 1, pageSize: 1, totalItems: 0, totalPages: 0, hasPrevious: false, hasNext: false };
type SlashCommandType = "code" | "image" | "callout" | "table" | "attachment" | "link";
type TextSize = NonNullable<TextBlock["textSize"]>;
type FormatCommand =
  | { type: "size"; value: TextSize }
  | { type: "bold" | "underline" | "highlight" }
  | { type: "emoji"; value: string };

type EditorSnapshot = { post: Post | null; settings: SiteSettings };

type TriggerKind = "slash" | "format";

type ImportedDocumentResult = {
  title: string;
  excerpt: string;
  readTime: string;
  tags: string[];
  blocks: ContentBlock[];
  attachment: { id: string; type: "attachment"; name: string; url: string; size: number };
};

function CategoryIcon({ category }: { category: SiteCategory }) {
  const key = `${category.id} ${category.label}`.toLowerCase();
  const Icon = key.includes("용어") ? BookOpen
    : key.includes("교육") ? GraduationCap
      : key.includes("전체") ? House
        : key.includes("프롬프트") ? Sparkles
          : key.includes("트렌드") ? TrendingUp
            : key.includes("자동화") ? Zap
              : null;
  return <span className="nav-icon" aria-hidden="true">{Icon ? <Icon size={18} strokeWidth={1.8} /> : category.icon}</span>;
}

const formatMenuItems: Array<{ command: FormatCommand; label: string; hint: string; symbol: string }> = [
  { command: { type: "size", value: "small" }, label: "작은 텍스트", hint: "현재 블록의 글자 크기 변경", symbol: "T-" },
  { command: { type: "size", value: "normal" }, label: "기본 텍스트", hint: "현재 블록의 글자 크기 변경", symbol: "T" },
  { command: { type: "size", value: "large" }, label: "큰 텍스트", hint: "현재 블록의 글자 크기 변경", symbol: "T+" },
  { command: { type: "size", value: "xlarge" }, label: "매우 큰 텍스트", hint: "현재 블록의 글자 크기 변경", symbol: "T++" },
  { command: { type: "bold" }, label: "굵게", hint: "서식이 적용된 텍스트를 바로 삽입", symbol: "B" },
  { command: { type: "underline" }, label: "밑줄", hint: "서식이 적용된 텍스트를 바로 삽입", symbol: "U" },
  { command: { type: "highlight" }, label: "하이라이트", hint: "서식이 적용된 텍스트를 바로 삽입", symbol: "A" },
  { command: { type: "emoji", value: "✨" }, label: "이모지", hint: "이모지 선택 열기", symbol: "☺" },
];

function findTriggerAtCursor(text: string, cursor: number, kind: TriggerKind) {
  const safeCursor = Math.max(0, Math.min(cursor, text.length));
  const beforeCursor = text.slice(0, safeCursor);
  const match = beforeCursor.match(kind === "format" ? /\/\/[^\s/]*$/ : /\/[^\s/]*$/);
  if (!match) return null;
  const start = match.index ?? 0;
  if (kind === "slash" && start > 0 && beforeCursor[start - 1] === "/") return null;
  return { start, end: safeCursor };
}

function removeTriggerAtCursor(text: string, cursor: number, kind: TriggerKind) {
  const range = findTriggerAtCursor(text, cursor, kind);
  if (!range) return { text, cursor: Math.max(0, Math.min(cursor, text.length)) };
  return { text: `${text.slice(0, range.start)}${text.slice(range.end)}`, cursor: range.start };
}

function plainRichText(text: string) {
  return text.replace(/\*\*([\s\S]+?)\*\*/g, "$1").replace(/__([\s\S]+?)__/g, "$1").replace(/==([\s\S]+?)==/g, "$1");
}

function richTextHtml(text: string) {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped
    .replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__([\s\S]+?)__/g, "<u>$1</u>")
    .replace(/==([\s\S]+?)==/g, "<mark>$1</mark>")
    .replace(/\n/g, "<br>");
}

function editorHtmlToRichText(root: HTMLElement) {
  function walk(node: globalThis.Node): string {
    if (node.nodeType === 3) return node.textContent ?? "";
    if (!(node instanceof HTMLElement)) return Array.from(node.childNodes).map(walk).join("");
    const tag = node.tagName.toLowerCase();
    if (tag === "br") return "\n";
    const inner = Array.from(node.childNodes).map(walk).join("");
    if (tag === "strong" || tag === "b") return `**${inner}**`;
    if (tag === "u") return `__${inner}__`;
    if (tag === "mark") return `==${inner}==`;
    if (tag === "div" || tag === "p") return `${inner}\n`;
    return inner;
  }
  return Array.from(root.childNodes).map(walk).join("").replace(/\n{3,}/g, "\n\n").replace(/\n$/, "");
}

function renderRichText(text: string) {
  return text.split(/(\*\*[\s\S]+?\*\*|__[\s\S]+?__|==[\s\S]+?==)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("__") && part.endsWith("__")) return <u key={index}>{part.slice(2, -2)}</u>;
    if (part.startsWith("==") && part.endsWith("==")) return <mark key={index}>{part.slice(2, -2)}</mark>;
    return part;
  });
}

function normalizedHref(value: string) {
  const url = value.trim();
  if (!url) return "#";
  if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(url)) return url;
  return `https://${url}`;
}

function formatText(text: string, selection: { start: number; end: number }, command: FormatCommand) {
  const trigger = findTriggerAtCursor(text, selection.end, "format");
  const cleaned = removeTriggerAtCursor(text, selection.end, "format");
  const triggerStart = trigger?.start ?? cleaned.cursor;
  const cleanText = cleaned.text;
  if (command.type === "size") return { text: cleanText, cursorStart: triggerStart, cursorEnd: triggerStart };

  const canWrapSelection = selection.end > selection.start && selection.end <= triggerStart;
  const start = canWrapSelection ? selection.start : triggerStart;
  const end = canWrapSelection ? selection.end : triggerStart;
  const selected = canWrapSelection ? cleanText.slice(start, end) : "";
  const replacement = command.type === "emoji" ? command.value
    : command.type === "bold" ? `**${selected || "굵은 텍스트"}**`
      : command.type === "underline" ? `__${selected || "밑줄 텍스트"}__`
        : `==${selected || "하이라이트 텍스트"}==`;
  const nextText = `${cleanText.slice(0, start)}${replacement}${cleanText.slice(end)}`;
  const placeholderOffset = command.type === "bold" || command.type === "underline" || command.type === "highlight" ? 2 : 0;
  return {
    text: nextText,
    cursorStart: start + placeholderOffset,
    cursorEnd: start + replacement.length - placeholderOffset,
  };
}

function useCommandMenu(open: boolean, count: number, onSelect: (index: number) => void) {
  const [activeIndex, setActiveIndex] = useState(-1);
  useEffect(() => { if (!open) setActiveIndex(-1); }, [open]);
  function onKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (!open) return false;
    if (event.key === "ArrowRight" && activeIndex < 0) {
      event.preventDefault();
      setActiveIndex(0);
      return true;
    }
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && activeIndex >= 0) {
      event.preventDefault();
      setActiveIndex((current) => (current + (event.key === "ArrowDown" ? 1 : -1) + count) % count);
      return true;
    }
    if ((event.key === "Enter" || event.key === " ") && activeIndex >= 0) {
      event.preventDefault();
      onSelect(activeIndex);
      return true;
    }
    return false;
  }
  return { activeIndex, setActiveIndex, onKeyDown };
}

function TextFormatMenu({ onCommand, activeIndex = -1, onActiveIndexChange }: { onCommand: (command: FormatCommand) => void; activeIndex?: number; onActiveIndexChange?: (index: number) => void }) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  return <div className="text-format-menu" onMouseDown={(event) => event.preventDefault()}>
    <p>텍스트 서식 · → 진입 · ↑↓ 이동 · Enter/Space 선택</p>
    {formatMenuItems.map((item, index) => <button key={item.label} className={activeIndex === index ? "keyboard-active" : ""} onMouseEnter={() => onActiveIndexChange?.(index)} onClick={() => item.command.type === "emoji" ? setEmojiOpen((value) => !value) : onCommand(item.command)}><span className={item.command.type === "highlight" ? "highlight-symbol" : ""}>{item.symbol}</span><div><strong>{item.label}</strong><small>{item.hint}</small></div></button>)}
    {emojiOpen && <div className="emoji-grid" aria-label="이모지 선택">{["✨", "📌", "✅", "💡", "🚀", "📂", "⚡", "🎯", "📊", "🤖", "👏", "🔗"].map((emoji) => <button key={emoji} onClick={() => onCommand({ type: "emoji", value: emoji })}>{emoji}</button>)}</div>}
  </div>;
}

function ImageLightbox({ url, alt, onClose }: { url: string; alt: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(100);
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="이미지 확대 보기" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="image-lightbox-toolbar"><button onClick={() => setZoom((value) => Math.max(100, value - 25))}>−</button><label>확대 {zoom}%<input type="range" min="100" max="200" step="10" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label><button onClick={() => setZoom((value) => Math.min(200, value + 25))}>＋</button><button className="lightbox-close" onClick={onClose}>닫기 ×</button></div>
    <div className="image-lightbox-stage"><img src={url} alt={alt} style={{ transform: `scale(${zoom / 100})` }} /></div>
  </div>;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }
  return <button className="copy-button" onClick={copy} aria-label="코드 복사">{copied ? "복사 완료" : "복사"}</button>;
}

function BlockView({ block, editing, onChange, onDelete, onInsertAfter, onReplaceFile, onPasteImage, onSlashCommand, onTocAction, onActivateHeading, onDragStart, onDragEnter, onDrop, onDragEnd, isDragging, isDropTarget, isTocActive }: {
  block: ContentBlock;
  editing: boolean;
  onChange: (next: ContentBlock) => void;
  onDelete: () => void;
  onInsertAfter: () => void;
  onReplaceFile: (file: File) => void;
  onPasteImage: (file: File) => void;
  onSlashCommand: (type: SlashCommandType) => void;
  onTocAction: (action: "show" | "hide" | "promote") => void;
  onActivateHeading: () => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnter: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isDropTarget: boolean;
  isTocActive: boolean;
}) {
  const textEditorRef = useRef<HTMLTextAreaElement>(null);
  const richEditorRef = useRef<HTMLSpanElement>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [triggerContext, setTriggerContext] = useState({ text: "", cursor: 0 });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const richTextBlock = block.type === "heading" || block.type === "paragraph" || block.type === "callout";
  const inlineFormatOpen = editing && richTextBlock && Boolean(findTriggerAtCursor(triggerContext.text, triggerContext.cursor, "format"));
  const inlineSlashOpen = editing && richTextBlock && !inlineFormatOpen && Boolean(findTriggerAtCursor(triggerContext.text, triggerContext.cursor, "slash"));
  const slashKeyboard = useCommandMenu(inlineSlashOpen, slashOptions.length, (index) => chooseInlineSlash(slashOptions[index].type));
  const formatKeyboard = useCommandMenu(inlineFormatOpen, formatMenuItems.length, (index) => applyBlockFormat(formatMenuItems[index].command));

  useEffect(() => {
    if (!richTextBlock || !richEditorRef.current || document.activeElement === richEditorRef.current) return;
    const html = richTextHtml(block.text);
    if (richEditorRef.current.innerHTML !== html) richEditorRef.current.innerHTML = html;
  }, [block.id, richTextBlock, richTextBlock ? block.text : ""]);

  function updateTriggerContext() {
    const root = richEditorRef.current;
    const selectionState = window.getSelection();
    const node = selectionState?.anchorNode;
    if (!root || !node || node.nodeType !== 3 || !root.contains(node)) {
      setTriggerContext({ text: "", cursor: 0 });
      return;
    }
    setTriggerContext({ text: node.textContent ?? "", cursor: selectionState?.anchorOffset ?? 0 });
  }

  function removeRichTrigger(kind: TriggerKind) {
    const root = richEditorRef.current;
    const selectionState = window.getSelection();
    const node = selectionState?.anchorNode;
    if (!root || !selectionState || !node || node.nodeType !== 3 || !root.contains(node)) return null;
    const range = findTriggerAtCursor(node.textContent ?? "", selectionState.anchorOffset, kind);
    if (!range) return null;
    const domRange = document.createRange();
    domRange.setStart(node, range.start);
    domRange.setEnd(node, range.end);
    domRange.deleteContents();
    domRange.collapse(true);
    selectionState.removeAllRanges();
    selectionState.addRange(domRange);
    setTriggerContext({ text: node.textContent ?? "", cursor: range.start });
    return domRange;
  }

  function saveRichEditor(nextBlock = block) {
    const root = richEditorRef.current;
    if (!root) return;
    onChange({ ...nextBlock, text: editorHtmlToRichText(root) } as ContentBlock);
  }

  function chooseInlineSlash(type: SlashCommandType) {
    if (!removeRichTrigger("slash")) return;
    saveRichEditor();
    onSlashCommand(type);
  }

  function applyBlockFormat(command: FormatCommand) {
    if (!("text" in block)) return;
    if (richTextBlock && richEditorRef.current) {
      const range = removeRichTrigger("format");
      if (!range) return;
      if (command.type === "size") {
        saveRichEditor({ ...block, textSize: command.value } as ContentBlock);
        return;
      }
      const placeholder = command.type === "emoji" ? command.value : command.type === "bold" ? "굵은 텍스트" : command.type === "underline" ? "밑줄 텍스트" : "하이라이트 텍스트";
      const node = command.type === "emoji" ? document.createTextNode(placeholder) : document.createElement(command.type === "bold" ? "strong" : command.type === "underline" ? "u" : "mark");
      if (node instanceof HTMLElement) node.textContent = placeholder;
      range.insertNode(node);
      const selectionState = window.getSelection();
      const selectRange = document.createRange();
      selectRange.selectNodeContents(node);
      selectionState?.removeAllRanges();
      selectionState?.addRange(selectRange);
      saveRichEditor();
      window.requestAnimationFrame(() => richEditorRef.current?.focus());
      return;
    }
    const formatted = formatText(block.text, selection, command);
    const next = command.type === "size" ? { ...block, text: formatted.text, textSize: command.value } : { ...block, text: formatted.text };
    onChange(next as ContentBlock);
    window.requestAnimationFrame(() => {
      textEditorRef.current?.focus();
      textEditorRef.current?.setSelectionRange(formatted.cursorStart, formatted.cursorEnd);
    });
  }

  const editor = (className: string) => {
    if (!("text" in block)) return null;
    if (!editing) return <span className="rich-text">{renderRichText(block.text)}</span>;
    if (richTextBlock) return <span ref={richEditorRef} className={`block-input block-rich-editor ${className}`} contentEditable suppressContentEditableWarning
      onFocus={updateTriggerContext} onInput={() => { updateTriggerContext(); saveRichEditor(); }} onSelect={updateTriggerContext}
      onKeyUp={updateTriggerContext} onMouseUp={updateTriggerContext}
      onKeyDown={(event) => { if (inlineFormatOpen ? formatKeyboard.onKeyDown(event) : slashKeyboard.onKeyDown(event)) return; }}
      onPaste={(event) => { const file = clipboardImage(event); if (file) { onPasteImage(file); return; } event.preventDefault(); document.execCommand("insertText", false, event.clipboardData.getData("text/plain")); }}
      aria-label="블록 내용 편집" />;
    return <textarea ref={textEditorRef} className={`block-input ${className}`} value={block.text} rows={Math.max(1, block.text.split("\n").length)}
      onChange={(event) => { setSelection({ start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }); onChange({ ...block, text: event.target.value }); }}
      onSelect={(event) => { setSelection({ start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }); }}
      onPaste={(event) => { const file = clipboardImage(event); if (file) onPasteImage(file); }} aria-label="블록 내용 편집" />;
  };

  let content: React.ReactNode;
  if (block.type === "heading") {
    content = <h2 className="article-heading">{editor("heading-input")}</h2>;
  } else if (block.type === "paragraph") {
    content = <p className="article-paragraph">{editor("paragraph-input")}</p>;
  } else if (block.type === "callout") {
    content = <div className={`callout ${block.tone ?? "info"}`}><span className="callout-dot" />{editor("callout-input")}</div>;
  } else if (block.type === "code") {
    content = <div className="code-card"><div className="code-top"><span>{block.language === "prompt" ? "PROMPT" : block.language?.toUpperCase()}</span><CopyButton value={block.text} /></div>{editing ? editor("code-input") : <pre><code>{block.text}</code></pre>}</div>;
  } else if (block.type === "attachment") {
    content = editing ? <div className="attachment attachment-editing"><span className="attachment-icon">↓</span><div className="attachment-fields">
      <label>파일명<input value={block.name} onChange={(event) => onChange({ ...block, name: event.target.value })} /></label>
      <label>다운로드 경로<input value={block.url} onChange={(event) => onChange({ ...block, url: event.target.value })} /></label>
      <label>표시 용량<input value={block.size} onChange={(event) => onChange({ ...block, size: event.target.value })} /></label>
    </div><div className="attachment-actions"><label className="replace-file-button">파일 교체<input type="file" accept={attachmentAccept} onChange={(event) => { const file = event.target.files?.[0]; if (file) onReplaceFile(file); event.target.value = ""; }} /></label><a className="download-label" href={block.url} download>다운로드 확인</a></div></div>
      : <a className="attachment" href={block.url} download><span className="attachment-icon">↓</span><span><strong>{block.name}</strong><small>{block.size} · 첨부파일</small></span><span className="download-label">다운로드</span></a>;
  } else if (block.type === "image") {
    const imageWidth = block.width ?? 100;
    content = <figure className="article-image" style={{ width: `${imageWidth}%` }}><button className="article-image-open" onClick={() => setLightboxOpen(true)} aria-label="이미지 확대 보기"><img src={block.url} alt={block.caption || "게시물 이미지"} /><span>클릭하여 확대</span></button>{editing && <div className="image-toolbar">
      <label className="replace-file-button">이미지 교체<input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) onReplaceFile(file); event.target.value = ""; }} /></label>
      <label className="image-size-control"><span>크기 {imageWidth}%</span><input type="range" min="20" max="100" step="5" value={imageWidth} onChange={(event) => onChange({ ...block, width: Number(event.target.value) })} /></label>
      <div className="image-size-presets" aria-label="이미지 크기 빠른 선택">{[25, 50, 75, 100].map((size) => <button key={size} className={imageWidth === size ? "active" : ""} onClick={() => onChange({ ...block, width: size })}>{size}%</button>)}</div>
    </div>}{editing ? <input value={block.caption} onChange={(event) => onChange({ ...block, caption: event.target.value })} placeholder="이미지 설명" /> : <figcaption>{block.caption}</figcaption>}</figure>;
  } else if (block.type === "link") {
    content = editing ? <div className="link-card link-card-editing"><span className="link-icon">↗</span><label>표시 텍스트<input value={block.label} onChange={(event) => onChange({ ...block, label: event.target.value })} /></label><label>URL<input value={block.url} onChange={(event) => onChange({ ...block, url: event.target.value })} placeholder="https://" /></label><a href={normalizedHref(block.url)} target="_blank" rel="noreferrer">열기</a></div>
      : <a className="link-card" href={normalizedHref(block.url)} target="_blank" rel="noreferrer"><span className="link-icon">↗</span><span><strong>{block.label || block.url}</strong><small>{block.url}</small></span><em>링크 열기</em></a>;
  } else {
    const table = block as TableBlock;
    const columnCount = Math.max(1, ...table.rows.map((row) => row.length));
    const normalizedRows = (table.rows.length ? table.rows : [[""]]).map((row) => Array.from({ length: columnCount }, (_, index) => row[index] ?? ""));
    const updateRows = (rows: string[][]) => onChange({ ...table, rows });
    content = <div className={`table-wrap ${editing ? "table-editing" : ""}`}>{editing && <div className="table-toolbar">
      <span>{normalizedRows.length}행 × {columnCount}열</span>
      <button onClick={() => updateRows([...normalizedRows, Array(columnCount).fill("")])}>＋ 행 추가</button>
      <button onClick={() => updateRows(normalizedRows.map((row) => [...row, ""]))}>＋ 열 추가</button>
    </div>}<table><tbody>
      {editing && <tr className="column-controls">{Array.from({ length: columnCount }, (_, columnIndex) => <th key={columnIndex}><span>{columnIndex + 1}열</span><button onClick={() => updateRows(normalizedRows.map((row) => row.filter((_, index) => index !== columnIndex)))} disabled={columnCount <= 1} aria-label={`${columnIndex + 1}열 삭제`}>×</button></th>)}<th className="row-control-heading">행</th></tr>}
      {normalizedRows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => {
        const Tag = !editing && rowIndex === 0 ? "th" : "td";
        return <Tag key={cellIndex} className={editing && rowIndex === 0 ? "editable-header-cell" : ""}>{editing ? <input value={cell} onChange={(event) => {
          const rows = normalizedRows.map((current, r) => current.map((value, c) => r === rowIndex && c === cellIndex ? event.target.value : value));
          updateRows(rows);
        }} aria-label={`${rowIndex + 1}행 ${cellIndex + 1}열`} /> : cell}</Tag>;
      })}{editing && <td className="row-control"><button onClick={() => updateRows(normalizedRows.filter((_, index) => index !== rowIndex))} disabled={normalizedRows.length <= 1} aria-label={`${rowIndex + 1}행 삭제`}>×</button></td>}</tr>)}
    </tbody></table></div>;
  }

  const textSize = "textSize" in block ? block.textSize ?? "normal" : "normal";
  return <div id={block.id} className={`content-block text-size-${textSize} ${editing ? "is-editing" : ""} ${isDragging ? "is-dragging" : ""} ${isDropTarget ? "is-drop-target" : ""} ${isTocActive ? "is-toc-active" : ""}`}
    onFocusCapture={() => { if (editing && block.type === "heading" && !block.tocHidden) onActivateHeading(); }}
    onDragOver={(event) => { if (editing) event.preventDefault(); }} onDragEnter={() => editing && onDragEnter()} onDrop={(event) => { if (editing) { event.preventDefault(); onDrop(); } }}>
    {editing && <div className="block-controls"><button className="drag-handle" draggable onDragStart={onDragStart} onDragEnd={onDragEnd} aria-label="블록 순서 이동" title="블록 순서 이동">⋮⋮</button>
      {block.type === "heading" ? <button className={`toc-block-toggle ${block.tocHidden ? "is-hidden" : ""}`} onClick={() => onTocAction(block.tocHidden ? "show" : "hide")} aria-label={block.tocHidden ? "목차에 다시 표시" : "목차에서 제외"} title={block.tocHidden ? "목차에 다시 표시" : "목차에서 제외"}>{block.tocHidden ? <ListPlus size={15} /> : <ListX size={15} />}</button>
        : block.type === "paragraph" && <button className="toc-block-toggle" onClick={() => onTocAction("promote")} aria-label="본문 제목 및 목차로 지정" title="본문 제목 및 목차로 지정"><ListPlus size={15} /></button>}
      <button className="delete-block" onClick={onDelete} aria-label="블록 삭제" title="블록 삭제">×</button></div>}
    {content}
    {inlineSlashOpen && <div className="inline-slash-menu" onMouseDown={(event) => event.preventDefault()}><p>블록 추가 · → 진입 · ↑↓ 이동 · Enter/Space 선택</p>{slashOptions.map((option, index) => <button key={option.type} className={slashKeyboard.activeIndex === index ? "keyboard-active" : ""} onMouseEnter={() => slashKeyboard.setActiveIndex(index)} onClick={() => chooseInlineSlash(option.type)}><span>{option.symbol}</span><div><strong>{option.label}</strong><small>{option.hint}</small></div></button>)}</div>}
    {inlineFormatOpen && <TextFormatMenu onCommand={applyBlockFormat} activeIndex={formatKeyboard.activeIndex} onActiveIndexChange={formatKeyboard.setActiveIndex} />}
    {editing && <button className="insert-after" onClick={onInsertAfter}>＋ 이 아래에 텍스트 추가</button>}
    {lightboxOpen && block.type === "image" && <ImageLightbox url={block.url} alt={block.caption || "게시물 이미지"} onClose={() => setLightboxOpen(false)} />}
  </div>;
}

const slashOptions = [
  { type: "code", label: "코드", hint: "코드 또는 프롬프트 블록", symbol: "</>" },
  { type: "image", label: "이미지", hint: "이미지 파일을 본문에 삽입", symbol: "▧" },
  { type: "callout", label: "콜아웃", hint: "강조할 안내문", symbol: "!" },
  { type: "table", label: "표", hint: "행과 열을 자유롭게 편집", symbol: "▦" },
  { type: "attachment", label: "첨부파일", hint: "PDF, PPT, PNG, XLSX 등 업로드", symbol: "↑" },
  { type: "link", label: "URL 링크", hint: "클릭 가능한 웹 주소 삽입", symbol: "↗" },
] as const;

function clipboardImage(event: ClipboardEvent<HTMLElement>) {
  const item = Array.from(event.clipboardData.items).find((candidate) => candidate.kind === "file" && candidate.type.startsWith("image/"));
  const image = item?.getAsFile() ?? Array.from(event.clipboardData.files).find((candidate) => candidate.type.startsWith("image/"));
  if (!image) return null;
  event.preventDefault();
  if (image.name) return image;
  const extension = image.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
  return new File([image], `clipboard-${Date.now()}.${extension}`, { type: image.type });
}

export function AICoeHub({ initialAdmin = false, adminPortalUrl = "/admin" }: { initialAdmin?: boolean; adminPortalUrl?: string }) {
  const [post, setPost] = useState<Post | null>(seedPost);
  const [pagination, setPagination] = useState<Pagination>(emptyPagination);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [admin] = useState(initialAdmin);
  const [pendingInsertAfterId, setPendingInsertAfterId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [draftText, setDraftText] = useState("");
  const [draftTextSize, setDraftTextSize] = useState<TextSize>("normal");
  const [draftTriggerContext, setDraftTriggerContext] = useState({ text: "", cursor: 0 });
  const [newTocTitle, setNewTocTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("전체 콘텐츠");
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(defaultSiteSettings);
  const [refreshKey, setRefreshKey] = useState(0);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [activeHeadingId, setActiveHeadingId] = useState("");
  const [indicator, setIndicator] = useState({ top: 0, height: 0 });
  const [coverLightboxOpen, setCoverLightboxOpen] = useState(false);
  const [historyCounts, setHistoryCounts] = useState({ undo: 0, redo: 0 });
  const imageInput = useRef<HTMLInputElement>(null);
  const attachmentInput = useRef<HTMLInputElement>(null);
  const documentImportInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const draftRichEditorRef = useRef<HTMLSpanElement>(null);
  const tocLinksRef = useRef<HTMLDivElement>(null);
  const tocItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const undoHistory = useRef<EditorSnapshot[]>([]);
  const redoHistory = useRef<EditorSnapshot[]>([]);
  const postRef = useRef<Post | null>(post);
  const settingsRef = useRef<SiteSettings>(siteSettings);
  postRef.current = post;
  settingsRef.current = siteSettings;

  const categories = siteSettings.categories;
  const categoryOptions = categories.filter((item) => item.id !== "전체 콘텐츠");
  const activeCategory = categories.find((item) => item.id === category) ?? categories[0];

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: "1" });
      if (category !== "전체 콘텐츠") params.set("category", category);
      if (search.trim()) params.set("q", search.trim());
      try {
        const response = await fetch(`/api/posts?${params.toString()}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("load failed");
        const result = await response.json();
        setPost(result.items[0] ?? null);
        resetHistory();
        setPagination(result.pagination);
        if (result.pagination.page !== page) setPage(result.pagination.page);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, search ? 220 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [category, page, search, refreshKey]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/settings", { signal: controller.signal, cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<SiteSettings> : Promise.reject(new Error("settings load failed")))
      .then((settings) => { setSiteSettings(settings); resetHistory(); })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const headings = useMemo(() => post?.blocks.filter((block) => block.type === "heading" && !block.tocHidden) ?? [], [post?.blocks]);
  const hiddenHeadings = useMemo(() => post?.blocks.filter((block) => block.type === "heading" && block.tocHidden) ?? [], [post?.blocks]);
  const showFormatMenu = Boolean(findTriggerAtCursor(draftTriggerContext.text, draftTriggerContext.cursor, "format"));
  const showSlashMenu = !showFormatMenu && Boolean(findTriggerAtCursor(draftTriggerContext.text, draftTriggerContext.cursor, "slash"));
  const draftSlashKeyboard = useCommandMenu(showSlashMenu, slashOptions.length, (index) => chooseDraftSlash(slashOptions[index].type));
  const draftFormatKeyboard = useCommandMenu(showFormatMenu, formatMenuItems.length, (index) => applyDraftFormat(formatMenuItems[index].command));

  useEffect(() => {
    if (!admin) return;
    function onHistoryKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) { event.preventDefault(); undoEdit(); }
      if (key === "y" || (key === "z" && event.shiftKey)) { event.preventDefault(); redoEdit(); }
    }
    window.addEventListener("keydown", onHistoryKey);
    return () => window.removeEventListener("keydown", onHistoryKey);
  }, [admin]);

  useEffect(() => {
    const editor = draftRichEditorRef.current;
    if (!editor || document.activeElement === editor) return;
    const html = richTextHtml(draftText);
    if (editor.innerHTML !== html) editor.innerHTML = html;
  }, [draftText]);

  useEffect(() => {
    if (!headings.length) { setActiveHeadingId(""); return; }
    let frame = 0;
    function updateActiveHeading() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const anchor = Math.min(190, window.innerHeight * 0.28);
        let active = headings[0].id;
        for (const heading of headings) {
          const element = document.getElementById(heading.id);
          if (element && element.getBoundingClientRect().top <= anchor) active = heading.id;
        }
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) active = headings.at(-1)?.id ?? active;
        setActiveHeadingId(active);
      });
    }
    updateActiveHeading();
    window.addEventListener("scroll", updateActiveHeading, { passive: true });
    window.addEventListener("resize", updateActiveHeading);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("scroll", updateActiveHeading); window.removeEventListener("resize", updateActiveHeading); };
  }, [headings]);

  useEffect(() => {
    const container = tocLinksRef.current;
    const item = tocItemRefs.current[activeHeadingId];
    if (!item || !container) { setIndicator({ top: 0, height: 0 }); return; }
    const updateIndicator = () => {
      const itemRect = item.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setIndicator({ top: itemRect.top - containerRect.top, height: itemRect.height });
    };
    updateIndicator();
    const observer = new ResizeObserver(updateIndicator);
    observer.observe(container);
    observer.observe(item);
    window.addEventListener("resize", updateIndicator);
    return () => { observer.disconnect(); window.removeEventListener("resize", updateIndicator); };
  }, [activeHeadingId, headings, admin]);

  function currentSnapshot(): EditorSnapshot {
    return structuredClone({ post: postRef.current, settings: settingsRef.current });
  }

  function updateHistoryCounts() {
    setHistoryCounts({ undo: undoHistory.current.length, redo: redoHistory.current.length });
  }

  function resetHistory() {
    undoHistory.current = [];
    redoHistory.current = [];
    updateHistoryCounts();
  }

  function recordHistory() {
    if (!admin) return;
    undoHistory.current.push(currentSnapshot());
    if (undoHistory.current.length > 20) undoHistory.current.shift();
    redoHistory.current = [];
    updateHistoryCounts();
  }

  function restoreSnapshot(snapshot: EditorSnapshot) {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    postRef.current = snapshot.post;
    settingsRef.current = snapshot.settings;
    setPost(snapshot.post);
    setSiteSettings(snapshot.settings);
    setSaved(false);
  }

  function undoEdit() {
    const snapshot = undoHistory.current.pop();
    if (!snapshot) return;
    redoHistory.current.push(currentSnapshot());
    if (redoHistory.current.length > 20) redoHistory.current.shift();
    restoreSnapshot(snapshot);
    updateHistoryCounts();
  }

  function redoEdit() {
    const snapshot = redoHistory.current.pop();
    if (!snapshot) return;
    undoHistory.current.push(currentSnapshot());
    if (undoHistory.current.length > 20) undoHistory.current.shift();
    restoreSnapshot(snapshot);
    updateHistoryCounts();
  }

  function editPost(updater: (current: Post) => Post) {
    recordHistory();
    setPost((current) => {
      if (!current) return current;
      const next = updater(current);
      postRef.current = next;
      return next;
    });
    setSaved(false);
  }

  function editSettings(updater: (current: SiteSettings) => SiteSettings) {
    recordHistory();
    setSiteSettings((current) => {
      const next = updater(current);
      settingsRef.current = next;
      return next;
    });
    setSaved(false);
  }

  function updateBlock(id: string, next: ContentBlock) {
    editPost((current) => ({ ...current, blocks: current.blocks.map((block) => block.id === id ? next : block) }));
  }

  function updateTocMembership(block: ContentBlock, action: "show" | "hide" | "promote") {
    if (!("text" in block)) return;
    const next = action === "promote" ? { ...block, type: "heading" as const, tocHidden: false }
      : { ...block, tocHidden: action === "hide" };
    updateBlock(block.id, next);
    if (action === "hide") {
      const nextVisible = headings.find((heading) => heading.id !== block.id);
      setActiveHeadingId(nextVisible?.id ?? "");
    } else {
      setActiveHeadingId(block.id);
      window.requestAnimationFrame(() => document.getElementById(block.id)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    }
  }

  function insertParagraphAfter(id: string) {
    const newBlock: ContentBlock = { id: `paragraph-${Date.now()}`, type: "paragraph", text: "" };
    editPost((current) => {
      const index = current.blocks.findIndex((block) => block.id === id);
      const blocks = [...current.blocks];
      blocks.splice(index + 1, 0, newBlock);
      return { ...current, blocks };
    });
  }

  function moveBlock(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    editPost((current) => {
      const blocks = [...current.blocks];
      const sourceIndex = blocks.findIndex((block) => block.id === sourceId);
      const targetIndex = blocks.findIndex((block) => block.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const [moved] = blocks.splice(sourceIndex, 1);
      blocks.splice(targetIndex, 0, moved);
      return { ...current, blocks };
    });
  }

  function blocksWithDraft(block?: ContentBlock, sourceText = draftText) {
    const text = sourceText.trimEnd();
    const additions: ContentBlock[] = [];
    if (text.trim()) additions.push({ id: `paragraph-${Date.now()}`, type: "paragraph", text, textSize: draftTextSize });
    if (block) additions.push(block);
    return additions;
  }

  function createStructuredBlock(type: Exclude<SlashCommandType, "image" | "attachment">) {
    const id = `block-${Date.now()}`;
    if (type === "table") return { id, type, rows: [["항목", "내용", "비고"], ["", "", ""], ["", "", ""]] } as ContentBlock;
    if (type === "code") return { id, type, language: "prompt", text: "여기에 코드 또는 프롬프트를 입력하세요." } as ContentBlock;
    if (type === "link") return { id, type, label: "링크 제목", url: "https://" } as ContentBlock;
    return { id, type, tone: "info", text: "강조할 내용을 입력하세요." } as ContentBlock;
  }

  function updateDraftTriggerContext() {
    const root = draftRichEditorRef.current;
    const selectionState = window.getSelection();
    const node = selectionState?.anchorNode;
    if (!root || !node || node.nodeType !== 3 || !root.contains(node)) {
      setDraftTriggerContext({ text: "", cursor: 0 });
      return;
    }
    setDraftTriggerContext({ text: node.textContent ?? "", cursor: selectionState?.anchorOffset ?? 0 });
  }

  function saveDraftEditor() {
    const root = draftRichEditorRef.current;
    if (!root) return draftText;
    const text = editorHtmlToRichText(root);
    setDraftText(text);
    return text;
  }

  function removeDraftTrigger(kind: TriggerKind) {
    const root = draftRichEditorRef.current;
    const selectionState = window.getSelection();
    const node = selectionState?.anchorNode;
    if (!root || !selectionState || !node || node.nodeType !== 3 || !root.contains(node)) return null;
    const trigger = findTriggerAtCursor(node.textContent ?? "", selectionState.anchorOffset, kind);
    if (!trigger) return null;
    const range = document.createRange();
    range.setStart(node, trigger.start);
    range.setEnd(node, trigger.end);
    range.deleteContents();
    range.collapse(true);
    selectionState.removeAllRanges();
    selectionState.addRange(range);
    setDraftTriggerContext({ text: node.textContent ?? "", cursor: trigger.start });
    return range;
  }

  function clearDraftEditor() {
    if (draftRichEditorRef.current) draftRichEditorRef.current.innerHTML = "";
    setDraftText("");
    setDraftTriggerContext({ text: "", cursor: 0 });
  }

  function insertBlockAfterId(targetId: string, newBlock: ContentBlock) {
    editPost((current) => {
      const blocks = [...current.blocks];
      const index = blocks.findIndex((block) => block.id === targetId);
      blocks.splice(index + 1, 0, newBlock);
      return { ...current, blocks };
    });
  }

  function handleInlineSlash(targetId: string, type: SlashCommandType) {
    if (type === "image" || type === "attachment") {
      setPendingInsertAfterId(targetId);
      if (type === "image") imageInput.current?.click();
      else attachmentInput.current?.click();
      return;
    }
    insertBlockAfterId(targetId, createStructuredBlock(type));
  }

  function addBlock(type: Exclude<SlashCommandType, "image" | "attachment">, sourceText = draftText) {
    const block = createStructuredBlock(type);
    editPost((current) => ({ ...current, blocks: [...current.blocks, ...blocksWithDraft(block, sourceText)] }));
    clearDraftEditor();
    setDraftTextSize("normal");
  }

  function addParagraph() {
    const additions = blocksWithDraft();
    if (!additions.length) return;
    editPost((current) => ({ ...current, blocks: [...current.blocks, ...additions] }));
    clearDraftEditor();
    setDraftTextSize("normal");
  }

  function applyDraftFormat(command: FormatCommand) {
    const range = removeDraftTrigger("format");
    if (!range) return;
    if (command.type === "size") {
      setDraftTextSize(command.value);
      saveDraftEditor();
      return;
    }
    const placeholder = command.type === "emoji" ? command.value : command.type === "bold" ? "굵은 텍스트" : command.type === "underline" ? "밑줄 텍스트" : "하이라이트 텍스트";
    const node = command.type === "emoji" ? document.createTextNode(placeholder) : document.createElement(command.type === "bold" ? "strong" : command.type === "underline" ? "u" : "mark");
    if (node instanceof HTMLElement) node.textContent = placeholder;
    range.insertNode(node);
    const selectionState = window.getSelection();
    const selectRange = document.createRange();
    selectRange.selectNodeContents(node);
    selectionState?.removeAllRanges();
    selectionState?.addRange(selectRange);
    saveDraftEditor();
    window.requestAnimationFrame(() => draftRichEditorRef.current?.focus());
  }

  function prepareDraftAssetUpload(type: "image" | "attachment", sourceText = draftText) {
    setDraftText(sourceText);
    setPendingInsertAfterId(null);
    if (type === "image") imageInput.current?.click();
    else attachmentInput.current?.click();
  }

  function chooseDraftSlash(type: SlashCommandType) {
    if (!removeDraftTrigger("slash")) return;
    const sourceText = saveDraftEditor();
    if (type === "image" || type === "attachment") prepareDraftAssetUpload(type, sourceText);
    else addBlock(type, sourceText);
  }

  function addTocHeading() {
    if (!newTocTitle.trim()) return;
    const block: ContentBlock = { id: `heading-${Date.now()}`, type: "heading", text: newTocTitle.trim() };
    editPost((current) => {
      const blocks = [...current.blocks];
      const activeIndex = blocks.findIndex((item) => item.id === activeHeadingId);
      if (activeIndex >= 0) blocks.splice(activeIndex + 1, 0, block);
      else blocks.push(block);
      return { ...current, blocks };
    });
    setNewTocTitle("");
    setActiveHeadingId(block.id);
    window.requestAnimationFrame(() => document.getElementById(block.id)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  function addExploreCategory() {
    const item: SiteCategory = { id: `category-${Date.now()}`, label: "새 메뉴", icon: "＋" };
    editSettings((current) => ({ ...current, categories: [...current.categories, item] }));
    setCategory(item.id);
    setPage(1);
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  async function uploadAsset(file: File) {
    setUploading(true);
    setUploadError("");
    try {
      const fileName = file.name || `clipboard-${Date.now()}.png`;
      const response = await fetch("/api/files", {
        method: "POST",
        headers: {
          "content-type": file.type || "application/octet-stream",
          "x-ai-coe-file-name": encodeURIComponent(fileName),
        },
        body: file,
      });
      if (response.status === 401) {
        setUploadError("관리자 인증이 만료되었거나 허용되지 않은 계정입니다. 관리자 주소에서 다시 로그인해 주세요.");
        return null;
      }
      const responseText = await response.text();
      let result: { error?: string; url?: string; name?: string; size?: number } = {};
      try {
        result = JSON.parse(responseText);
      } catch {
        result = {};
      }
      if (!response.ok) {
        setUploadError(result.error ?? `파일 업로드에 실패했습니다. (${response.status})`);
        return null;
      }
      if (!result.url || typeof result.size !== "number") {
        setUploadError("파일 저장 결과를 확인할 수 없습니다. 다시 시도해 주세요.");
        return null;
      }
      return result as { url: string; name: string; size: number };
    } catch {
      setUploadError("네트워크 연결로 파일 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function uploadFile(event: ChangeEvent<HTMLInputElement>, kind: "image" | "attachment") {
    const file = event.target.files?.[0];
    if (!file) return;
    const result = await uploadAsset(file);
    if (result) {
      const block: ContentBlock = kind === "image" ? { id: `block-${Date.now()}`, type: "image", url: result.url, caption: file.name }
        : { id: `block-${Date.now()}`, type: "attachment", url: result.url, name: file.name, size: formatFileSize(result.size) };
      if (pendingInsertAfterId) insertBlockAfterId(pendingInsertAfterId, block);
      else {
        editPost((current) => ({ ...current, blocks: [...current.blocks, ...blocksWithDraft(block)] }));
        clearDraftEditor();
        setDraftTextSize("normal");
      }
      setPendingInsertAfterId(null);
    }
    event.target.value = "";
  }

  async function replaceBlockFile(block: ContentBlock, file: File) {
    const result = await uploadAsset(file);
    if (!result) return;
    if (block.type === "attachment") updateBlock(block.id, { ...block, url: result.url, name: file.name, size: formatFileSize(result.size) });
    if (block.type === "image") updateBlock(block.id, { ...block, url: result.url, caption: file.name });
  }

  async function pasteImage(file: File, afterId?: string) {
    const result = await uploadAsset(file);
    if (!result) return;
    const image: ContentBlock = { id: `block-${Date.now()}`, type: "image", url: result.url, caption: "", width: 100 };
    if (afterId) insertBlockAfterId(afterId, image);
    else {
      editPost((current) => ({ ...current, blocks: [...current.blocks, ...blocksWithDraft(image)] }));
      clearDraftEditor();
      setDraftTextSize("normal");
    }
  }

  async function replaceCoverImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const result = await uploadAsset(file);
    if (result) editPost((current) => ({ ...current, cover: { ...defaultPostCover, ...current.cover, imageUrl: result.url } }));
    event.target.value = "";
  }

  async function savePost() {
    setSaving(true);
    const responses = await Promise.all([
      post ? fetch("/api/posts", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(post) }) : Promise.resolve(null),
      fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(siteSettings) }),
    ]);
    setSaving(false);
    if (responses.some((response) => response?.status === 401)) { window.location.reload(); return; }
    if (responses.every((response) => !response || response.ok)) {
      setSaved(true);
      resetHistory();
      setRefreshKey((value) => value + 1);
      window.setTimeout(() => setSaved(false), 2200);
    }
  }

  async function createPost() {
    setCreating(true);
    const targetCategory = category === "전체 콘텐츠" ? categoryOptions[0]?.id || "업무 자동화" : category;
    const response = await fetch("/api/posts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ category: targetCategory }) });
    if (response.status === 401) { setCreating(false); window.location.reload(); return; }
    const created = response.ok ? await response.json() as Post : null;
    setCreating(false);
    if (created) { setCategory(targetCategory); setPage(1); setPost(created); setRefreshKey((value) => value + 1); }
  }

  async function importDocumentFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    setImportError("");
    const targetCategory = category === "전체 콘텐츠" ? categoryOptions[0]?.id || "업무 자동화" : category;
    try {
      const importResponse = await fetch("/api/import-document", {
        method: "POST",
        headers: {
          "content-type": file.type || "application/octet-stream",
          "x-ai-coe-file-name": encodeURIComponent(file.name),
        },
        body: file,
      });
      if (importResponse.status === 401) { window.location.reload(); return; }
      const imported = await importResponse.json().catch(() => ({})) as ImportedDocumentResult & { error?: string };
      if (!importResponse.ok) throw new Error(imported.error || `문서 가져오기에 실패했습니다. (${importResponse.status})`);

      const importedPost = {
        category: targetCategory,
        title: imported.title,
        excerpt: imported.excerpt,
        readTime: imported.readTime,
        tags: imported.tags,
        cover: {
          badge: "DOCUMENT IMPORT",
          kicker: file.name.toUpperCase(),
          titlePrimary: imported.title.slice(0, 18),
          titleAccent: "AI CONTENT",
          description: imported.excerpt,
        },
        blocks: [
          ...imported.blocks,
          { ...imported.attachment, size: formatFileSize(imported.attachment.size) },
        ],
      };
      const createResponse = await fetch("/api/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(importedPost),
      });
      if (createResponse.status === 401) { window.location.reload(); return; }
      const created = await createResponse.json().catch(() => ({})) as Post & { error?: string };
      if (!createResponse.ok) throw new Error(created.error || "가져온 콘텐츠를 저장하지 못했습니다.");
      setCategory(targetCategory);
      setPage(1);
      setPost(created);
      resetHistory();
      setSaved(true);
      setRefreshKey((value) => value + 1);
      window.setTimeout(() => setSaved(false), 2200);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "문서 가져오기에 실패했습니다.");
    } finally {
      setImporting(false);
    }
  }

  async function deletePost() {
    if (!post || !window.confirm(`‘${post.title}’ 게시물을 삭제할까요? 이 작업은 저장 후 되돌릴 수 없습니다.`)) return;
    const response = await fetch(`/api/posts?id=${encodeURIComponent(post.id)}`, { method: "DELETE" });
    if (response.status === 401) { window.location.reload(); return; }
    if (!response.ok) return;
    setPost(null);
    resetHistory();
    setPage(1);
    setRefreshKey((value) => value + 1);
  }

  const cover = post ? { ...defaultPostCover, ...post.cover } : defaultPostCover;

  return <div className="site-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="AI CoE Hub 홈"><span className="brand-mark">H</span><span><strong>AI CoE</strong><small>ESSENTIAL HUB</small></span></a>
      <label className="search"><span>⌕</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="콘텐츠, 프롬프트 검색" aria-label="콘텐츠 검색" /><kbd>⌘ K</kbd></label>
      <div className="header-actions">
        {admin && <button className="history-button" onClick={undoEdit} disabled={!historyCounts.undo} title="Ctrl/⌘ + Z">↶ 실행 취소</button>}
        {admin && <button className="history-button" onClick={redoEdit} disabled={!historyCounts.redo} title="Ctrl/⌘ + Y">↷ 다시 실행</button>}
        {admin && post && <button className="delete-post-button" onClick={deletePost}>콘텐츠 삭제</button>}
        {admin && <label className={`document-import-button ${importing ? "is-loading" : ""}`}><FileUp size={15} aria-hidden="true" /><span>{importing ? "문서 변환 중…" : "문서로 콘텐츠 만들기"}</span><input ref={documentImportInput} type="file" accept={documentImportAccept} onChange={importDocumentFile} disabled={importing} /></label>}
        {admin && <button className="create-post-button" onClick={createPost} disabled={creating}>{creating ? "생성 중…" : "＋ 새 콘텐츠"}</button>}
        {admin && <button className="save-button" onClick={savePost} disabled={saving}>{saving ? "저장 중…" : saved ? "저장 완료 ✓" : "변경사항 저장"}</button>}
        {admin ? <a className="normal-mode-button" href={publicSiteUrl}>일반 모드로 이동</a> : <a className="admin-toggle" href={adminPortalUrl}><span>◇</span>관리자 모드</a>}
      </div>
    </header>

    <div className="workspace" id="top">
      <aside className="sidebar">
        <nav>
          {admin ? <input className="nav-title-editor" value={siteSettings.exploreTitle} onChange={(event) => editSettings((current) => ({ ...current, exploreTitle: event.target.value }))} aria-label="Explore 메뉴 제목 편집" />
            : <p className="nav-label">{siteSettings.exploreTitle}</p>}
          {categories.map((item) => admin
            ? <label key={item.id} className={`nav-edit-item ${category === item.id ? "active" : ""}`} onClick={() => { setCategory(item.id); setPage(1); }}>
              <CategoryIcon category={item} />
              <input value={item.label} onFocus={() => { setCategory(item.id); setPage(1); }} onChange={(event) => editSettings((current) => ({ ...current, categories: current.categories.map((categoryItem) => categoryItem.id === item.id ? { ...categoryItem, label: event.target.value } : categoryItem) }))} aria-label={`${item.label} 메뉴명 편집`} />
              {category === item.id && pagination.totalItems > 0 && <em>{pagination.totalItems}</em>}
            </label>
            : <button key={item.id} className={category === item.id ? "active" : ""} onClick={() => { setCategory(item.id); setPage(1); }}><CategoryIcon category={item} />{item.label}{category === item.id && pagination.totalItems > 0 && <em>{pagination.totalItems}</em>}</button>)}
          {admin && <button className="add-nav-item" onClick={addExploreCategory}>＋ 메뉴 추가</button>}
        </nav>
        <div className={`sidebar-card ${admin ? "sidebar-card-editing" : ""}`}><span>✦</span>{admin ? <><input value={siteSettings.ideaTitle} onChange={(event) => editSettings((current) => ({ ...current, ideaTitle: event.target.value }))} aria-label="아이디어 카드 제목 편집" /><textarea value={siteSettings.ideaDescription} onChange={(event) => editSettings((current) => ({ ...current, ideaDescription: event.target.value }))} aria-label="아이디어 카드 설명 편집" /><input value={siteSettings.ideaButtonLabel} onChange={(event) => editSettings((current) => ({ ...current, ideaButtonLabel: event.target.value }))} aria-label="아이디어 버튼 문구 편집" /></> : <><strong>{siteSettings.ideaTitle}</strong><p>{siteSettings.ideaDescription}</p><a href={ideaMailto}>{siteSettings.ideaButtonLabel}</a></>}</div>
        <footer>HANWHA ESSENTIAL<br />AI Center of Excellence</footer>
      </aside>

      <main className="main-area">
        <section className="collection-head">
          <div>{admin ? <><input className="eyebrow content-copy-editor" value={siteSettings.heroEyebrow} onChange={(event) => editSettings((current) => ({ ...current, heroEyebrow: event.target.value }))} aria-label="라이브러리 라벨 편집" /><h1><input className="hero-title-editor" value={siteSettings.heroTitlePrimary} onChange={(event) => editSettings((current) => ({ ...current, heroTitlePrimary: event.target.value }))} aria-label="메인 제목 편집" /><input className="hero-title-editor accent" value={siteSettings.heroTitleAccent} onChange={(event) => editSettings((current) => ({ ...current, heroTitleAccent: event.target.value }))} aria-label="강조 제목 편집" /></h1><textarea className="hero-description-editor" value={siteSettings.heroDescription} onChange={(event) => editSettings((current) => ({ ...current, heroDescription: event.target.value }))} aria-label="소개 문구 편집" /></> : <><span className="eyebrow">{siteSettings.heroEyebrow}</span><h1>{siteSettings.heroTitlePrimary}<br /><em>{siteSettings.heroTitleAccent}</em></h1><p>{siteSettings.heroDescription}</p></>}</div>
          <div className="stat-card">{admin ? <input className="stat-label-editor" value={siteSettings.statLabel} onChange={(event) => editSettings((current) => ({ ...current, statLabel: event.target.value }))} aria-label="콘텐츠 수 라벨 편집" /> : <span>{siteSettings.statLabel}</span>}<strong>{String(pagination.totalItems).padStart(2, "0")}</strong><i>↗</i></div>
        </section>

        <section className="section-title"><div><span className="live-dot" />{admin ? <input value={siteSettings.featuredLabel} onChange={(event) => editSettings((current) => ({ ...current, featuredLabel: event.target.value }))} aria-label="콘텐츠 섹션 라벨 편집" /> : siteSettings.featuredLabel}</div>{admin && category === "전체 콘텐츠" ? <input className="featured-description-editor" value={siteSettings.featuredAllDescription} onChange={(event) => editSettings((current) => ({ ...current, featuredAllDescription: event.target.value }))} aria-label="콘텐츠 섹션 설명 편집" /> : <p>{category === "전체 콘텐츠" ? siteSettings.featuredAllDescription : activeCategory?.label}</p>}</section>

        {!post && !loading ? <div className="empty-state"><span>⌕</span><h2>{search ? "검색 결과가 없습니다" : `${activeCategory?.label ?? category} 콘텐츠를 준비하고 있습니다`}</h2><p>{admin ? "상단의 ‘새 콘텐츠’ 버튼으로 첫 게시물을 만들어 보세요." : "새로운 콘텐츠가 등록되면 이곳에서 확인할 수 있습니다."}</p></div> : post && <>
          <article className={`article ${admin ? "admin-article" : ""}`}>
            <div className={`article-cover ${cover.imageUrl ? "has-cover-image" : ""}`}>
              {cover.imageUrl && <button className="cover-background-open" onClick={() => setCoverLightboxOpen(true)} aria-label="커버 이미지 확대 보기"><img src={cover.imageUrl} alt="게시물 커버" /></button>}
              <div className="cover-grid" /><div className="cloud-orbit"><span>☁</span></div>
              {admin ? <>
                <input className="cover-badge cover-text-editor" value={cover.badge} onChange={(event) => editPost((current) => ({ ...current, cover: { ...cover, badge: event.target.value } }))} aria-label="커버 배지 편집" />
                <div className="cover-copy cover-copy-editing"><input value={cover.kicker} onChange={(event) => editPost((current) => ({ ...current, cover: { ...cover, kicker: event.target.value } }))} aria-label="커버 상단 문구 편집" /><input className="cover-title-editor" value={cover.titlePrimary} onChange={(event) => editPost((current) => ({ ...current, cover: { ...cover, titlePrimary: event.target.value } }))} aria-label="커버 제목 편집" /><input className="cover-title-editor accent" value={cover.titleAccent} onChange={(event) => editPost((current) => ({ ...current, cover: { ...cover, titleAccent: event.target.value } }))} aria-label="커버 강조 제목 편집" /><input value={cover.description} onChange={(event) => editPost((current) => ({ ...current, cover: { ...cover, description: event.target.value } }))} aria-label="커버 설명 편집" /></div>
                <label className="cover-replace-button">커버 이미지 교체<input ref={coverInput} type="file" accept="image/*" onChange={replaceCoverImage} /></label>
              </> : <><span className="cover-badge">{cover.badge}</span><div className="cover-copy"><small>{cover.kicker}</small><strong>{cover.titlePrimary}<br /><em>{cover.titleAccent}</em></strong><p>{cover.description}</p></div></>}
            </div>
            <div className="article-body">
              {admin ? <div className="article-meta meta-editing"><label>카테고리<input list="category-list" value={post.category} onChange={(event) => editPost((current) => ({ ...current, category: event.target.value }))} /></label><label>게시일<input value={post.publishedAt} onChange={(event) => editPost((current) => ({ ...current, publishedAt: event.target.value }))} /></label><label>읽기 시간<input value={post.readTime} onChange={(event) => editPost((current) => ({ ...current, readTime: event.target.value }))} /></label><datalist id="category-list">{categoryOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</datalist></div>
                : <div className="article-meta"><span>{categories.find((item) => item.id === post.category)?.label ?? post.category}</span><span>{post.publishedAt}</span><span>{post.readTime} 읽기</span></div>}
              {admin ? <textarea className="title-editor" value={post.title} onChange={(event) => editPost((current) => ({ ...current, title: event.target.value }))} aria-label="제목 편집" /> : <h2 className="article-title">{post.title}</h2>}
              {admin ? <textarea className="excerpt-editor" value={post.excerpt} onChange={(event) => editPost((current) => ({ ...current, excerpt: event.target.value }))} aria-label="요약 편집" /> : <p className="article-excerpt">{post.excerpt}</p>}
              {admin ? <div className="byline byline-editing"><span className="avatar">AI</span><div><input value={post.author} onChange={(event) => editPost((current) => ({ ...current, author: event.target.value }))} aria-label="작성자 편집" /><input value={siteSettings.organizationLabel} onChange={(event) => editSettings((current) => ({ ...current, organizationLabel: event.target.value }))} aria-label="조직명 편집" /></div><input className="tags-editor" value={post.tags.join(", ")} onChange={(event) => editPost((current) => ({ ...current, tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) }))} aria-label="태그 편집" /></div>
                : <div className="byline"><span className="avatar">AI</span><div><strong>{post.author}</strong><small>{siteSettings.organizationLabel}</small></div>{post.tags.map((tag) => <em key={tag}>#{tag}</em>)}</div>}
              <div className="article-rule" />
              <div className="blocks">
                {post.blocks.map((block) => <BlockView key={block.id} block={block} editing={admin} onChange={(next) => updateBlock(block.id, next)}
                  onDelete={() => editPost((current) => ({ ...current, blocks: current.blocks.filter((item) => item.id !== block.id) }))} onInsertAfter={() => insertParagraphAfter(block.id)} onReplaceFile={(file) => replaceBlockFile(block, file)} onPasteImage={(file) => pasteImage(file, block.id)}
                  onSlashCommand={(type) => handleInlineSlash(block.id, type)}
                  onTocAction={(action) => updateTocMembership(block, action)} onActivateHeading={() => setActiveHeadingId(block.id)}
                  onDragStart={(event) => { setDraggedId(block.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", block.id); }} onDragEnter={() => draggedId && setDropTargetId(block.id)}
                  onDrop={() => { if (draggedId) moveBlock(draggedId, block.id); setDraggedId(null); setDropTargetId(null); }} onDragEnd={() => { setDraggedId(null); setDropTargetId(null); }} isDragging={draggedId === block.id} isDropTarget={dropTargetId === block.id && draggedId !== block.id} isTocActive={admin && block.type === "heading" && !block.tocHidden && activeHeadingId === block.id} />)}
              </div>

              {admin && <div className="slash-editor">
                <div className="slash-line"><span>＋</span><span ref={draftRichEditorRef} className={`slash-rich-editor text-size-${draftTextSize}`} contentEditable suppressContentEditableWarning data-placeholder="새 내용을 입력하세요. / 블록 추가 · // 텍스트 서식 · 이미지는 Ctrl/⌘ + V" onFocus={updateDraftTriggerContext} onInput={() => { updateDraftTriggerContext(); saveDraftEditor(); }} onSelect={updateDraftTriggerContext} onKeyUp={updateDraftTriggerContext} onMouseUp={updateDraftTriggerContext} onPaste={(event) => { const file = clipboardImage(event); if (file) { pasteImage(file); return; } event.preventDefault(); document.execCommand("insertText", false, event.clipboardData.getData("text/plain")); }} onKeyDown={(event) => { if (showFormatMenu ? draftFormatKeyboard.onKeyDown(event) : draftSlashKeyboard.onKeyDown(event)) return; if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); addParagraph(); } }} aria-label="새 내용 입력" /></div>
                <div className="composer-actions"><span>→ 메뉴 진입 · ↑↓ 이동 · Enter/Space 선택 · Ctrl/⌘ + V 이미지 · ⌘/Ctrl + Enter 추가</span><button onClick={addParagraph} disabled={!draftText.trim()}>내용 추가</button></div>
                {showSlashMenu && <div className="slash-menu" onMouseDown={(event) => event.preventDefault()}><p>기본 블록 · → 진입 · ↑↓ 이동 · Enter/Space 선택</p>{slashOptions.map((option, index) => <button key={option.type} className={draftSlashKeyboard.activeIndex === index ? "keyboard-active" : ""} onMouseEnter={() => draftSlashKeyboard.setActiveIndex(index)} onClick={() => chooseDraftSlash(option.type)}><span>{option.symbol}</span><div><strong>{option.label}</strong><small>{option.hint}</small></div></button>)}</div>}
                {showFormatMenu && <TextFormatMenu onCommand={applyDraftFormat} activeIndex={draftFormatKeyboard.activeIndex} onActiveIndexChange={draftFormatKeyboard.setActiveIndex} />}
                {uploading && <p className="upload-status">파일을 업로드하고 있습니다…</p>}{uploadError && <p className="upload-error">{uploadError}</p>}
                <input ref={imageInput} className="visually-hidden" type="file" accept="image/*" onChange={(event) => uploadFile(event, "image")} />
                <input ref={attachmentInput} className="visually-hidden" type="file" accept={attachmentAccept} onChange={(event) => uploadFile(event, "attachment")} />
              </div>}

              <div className="article-end">{admin ? <><input value={siteSettings.articleEndBrand} onChange={(event) => editSettings((current) => ({ ...current, articleEndBrand: event.target.value }))} aria-label="본문 하단 브랜드 편집" /><input value={siteSettings.articleEndText} onChange={(event) => editSettings((current) => ({ ...current, articleEndText: event.target.value }))} aria-label="본문 하단 문구 편집" /></> : <><span>{siteSettings.articleEndBrand}</span><p>{siteSettings.articleEndText}</p></>}</div>
            </div>
          </article>
          {pagination.totalPages > 1 && <nav className="pagination" aria-label="콘텐츠 페이지 이동"><button onClick={() => { setPage((value) => Math.max(1, value - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }} disabled={!pagination.hasPrevious}>← 이전</button><span><strong>{pagination.page}</strong> / {pagination.totalPages}</span><button onClick={() => { setPage((value) => value + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }} disabled={!pagination.hasNext}>다음 →</button></nav>}
        </>}
      </main>

      <aside className="toc">
        {post && <div className="toc-inner">
          {admin ? <input className="toc-title-editor" value={post.tocTitle} onChange={(event) => editPost((current) => ({ ...current, tocTitle: event.target.value }))} aria-label="목차 제목 편집" /> : <p>{post.tocTitle}</p>}
          <div className="toc-links" ref={tocLinksRef}><div className="toc-progress"><span style={{ top: indicator.top, height: indicator.height }} /></div>
            {headings.map((heading, index) => <div key={heading.id} ref={(element) => { tocItemRefs.current[heading.id] = element; }} className={`toc-row ${admin ? "admin-toc-row" : ""} ${activeHeadingId === heading.id ? "active" : ""}`}>
              {admin && "text" in heading ? <><a className="toc-number-link" href={`#${heading.id}`} onClick={(event) => { event.preventDefault(); setActiveHeadingId(heading.id); document.getElementById(heading.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }} aria-label={`${index + 1}번 본문으로 이동`}><span>{String(index + 1).padStart(2, "0")}</span></a><textarea value={plainRichText(heading.text)} rows={Math.max(1, plainRichText(heading.text).split("\n").length)} onFocus={() => setActiveHeadingId(heading.id)} onChange={(event) => updateBlock(heading.id, { ...heading, text: event.target.value })} aria-label={`${index + 1}번 목차 편집`} /><button className="toc-remove-button" onClick={() => updateTocMembership(heading, "hide")} aria-label={`${index + 1}번 목차에서 제거`} title="목차에서 제거"><ListX size={14} /></button></>
                : <a href={`#${heading.id}`} onClick={(event) => { event.preventDefault(); setActiveHeadingId(heading.id); document.getElementById(heading.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><span>{String(index + 1).padStart(2, "0")}</span><span className="toc-label">{"text" in heading ? plainRichText(heading.text) : ""}</span></a>}
            </div>)}
          </div>
          {admin && <div className="toc-add"><input value={newTocTitle} onChange={(event) => setNewTocTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addTocHeading(); }} placeholder="현재 본문 위치에 제목 추가" /><button onClick={addTocHeading} aria-label="현재 본문 위치에 제목 추가" title="현재 선택한 제목 다음에 추가"><ListPlus size={15} /></button></div>}
          {admin && hiddenHeadings.length > 0 && <div className="toc-hidden-list"><span>목차 제외</span>{hiddenHeadings.map((heading) => <button key={heading.id} onClick={() => updateTocMembership(heading, "show")} title="목차에 다시 표시"><ListPlus size={13} /><em>{"text" in heading ? plainRichText(heading.text) : ""}</em></button>)}</div>}
        </div>}
      </aside>
    </div>
    {coverLightboxOpen && cover.imageUrl && <ImageLightbox url={cover.imageUrl} alt="게시물 커버" onClose={() => setCoverLightboxOpen(false)} />}
    {importError && <div className="import-error-toast" role="alert"><strong>문서 가져오기 실패</strong><span>{importError}</span><button onClick={() => setImportError("")} aria-label="오류 닫기">×</button></div>}
    {loading && <div className="loading-toast">콘텐츠를 불러오는 중…</div>}
  </div>;
}
