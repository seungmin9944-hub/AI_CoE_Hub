"use client";

import { ChangeEvent, ClipboardEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { seedPost, type ContentBlock, type Post, type TableBlock, type TextBlock } from "./content";

const categories = ["전체 콘텐츠", "프롬프트", "AI 트렌드", "업무 자동화"];
const categoryOptions = ["프롬프트", "AI 트렌드", "업무 자동화"];
const ideaMailto = "mailto:seungmin.kim@hanwha.com,ghcho08@hanwha.com,taewonkim@hanwha.com,semin1000@hanwha.com?subject=%5BAI%20CoE%5D%20AI%20%ED%99%9C%EC%9A%A9%20%EC%95%84%EC%9D%B4%EB%94%94%EC%96%B4%20%EC%A0%9C%EC%95%88";
const attachmentAccept = ".pdf,.ppt,.pptx,.png,.jpg,.jpeg,.xlsx,.xls,.csv,.zip,.doc,.docx,.txt,.html";

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

const slashTrigger = /(^|\s)\/[^\s/]*$/;
const formatTrigger = /(^|\s)\/\/[^\s/]*$/;

function cleanSlashTrigger(text: string) {
  return text.replace(/(^|\s)\/[^\s/]*$/, "$1").trimEnd();
}

function cleanFormatTrigger(text: string) {
  return text.replace(/(^|\s)\/\/[^\s/]*$/, "$1").trimEnd();
}

function plainRichText(text: string) {
  return text.replace(/\*\*([\s\S]+?)\*\*/g, "$1").replace(/__([\s\S]+?)__/g, "$1").replace(/==([\s\S]+?)==/g, "$1");
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
  const match = text.match(formatTrigger);
  const triggerStart = match?.index ?? text.length;
  const cleanText = cleanFormatTrigger(text);
  if (command.type === "size") return { text: cleanText, cursorStart: cleanText.length, cursorEnd: cleanText.length };

  const canWrapSelection = selection.end > selection.start && selection.end <= triggerStart;
  const start = canWrapSelection ? selection.start : cleanText.length;
  const end = canWrapSelection ? selection.end : cleanText.length;
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

function TextFormatMenu({ onCommand }: { onCommand: (command: FormatCommand) => void }) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const sizes: Array<{ value: TextSize; label: string; symbol: string }> = [
    { value: "small", label: "작은 텍스트", symbol: "T-" },
    { value: "normal", label: "기본 텍스트", symbol: "T" },
    { value: "large", label: "큰 텍스트", symbol: "T+" },
    { value: "xlarge", label: "매우 큰 텍스트", symbol: "T++" },
  ];
  return <div className="text-format-menu" onMouseDown={(event) => event.preventDefault()}>
    <p>텍스트 서식</p>
    {sizes.map((size) => <button key={size.value} onClick={() => onCommand({ type: "size", value: size.value })}><span>{size.symbol}</span><div><strong>{size.label}</strong><small>현재 블록의 글자 크기 변경</small></div></button>)}
    <div className="format-divider" />
    <button onClick={() => onCommand({ type: "bold" })}><span><b>B</b></span><div><strong>굵게</strong><small>선택 영역 또는 새 텍스트를 굵게</small></div></button>
    <button onClick={() => onCommand({ type: "underline" })}><span><u>U</u></span><div><strong>밑줄</strong><small>선택 영역 또는 새 텍스트에 밑줄</small></div></button>
    <button onClick={() => onCommand({ type: "highlight" })}><span className="highlight-symbol">A</span><div><strong>하이라이트</strong><small>선택 영역 또는 새 텍스트 강조</small></div></button>
    <button onClick={() => setEmojiOpen((value) => !value)}><span>☺</span><div><strong>이모지</strong><small>업무에 맞는 이모지 삽입</small></div></button>
    {emojiOpen && <div className="emoji-grid" aria-label="이모지 선택">{["✨", "📌", "✅", "💡", "🚀", "📂", "⚡", "🎯", "📊", "🤖", "👏", "🔗"].map((emoji) => <button key={emoji} onClick={() => onCommand({ type: "emoji", value: emoji })}>{emoji}</button>)}</div>}
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

function BlockView({ block, editing, onChange, onDelete, onInsertAfter, onReplaceFile, onPasteImage, onSlashCommand, onDragStart, onDragEnter, onDrop, onDragEnd, isDragging, isDropTarget }: {
  block: ContentBlock;
  editing: boolean;
  onChange: (next: ContentBlock) => void;
  onDelete: () => void;
  onInsertAfter: () => void;
  onReplaceFile: (file: File) => void;
  onPasteImage: (file: File) => void;
  onSlashCommand: (type: SlashCommandType) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnter: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isDropTarget: boolean;
}) {
  const textEditorRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const richTextBlock = block.type === "heading" || block.type === "paragraph" || block.type === "callout";
  const inlineFormatOpen = editing && richTextBlock && formatTrigger.test(block.text);
  const inlineSlashOpen = editing && richTextBlock && !inlineFormatOpen && slashTrigger.test(block.text);

  function applyBlockFormat(command: FormatCommand) {
    if (!("text" in block)) return;
    const formatted = formatText(block.text, selectionRef.current, command);
    const next = command.type === "size" ? { ...block, text: formatted.text, textSize: command.value } : { ...block, text: formatted.text };
    onChange(next as ContentBlock);
    window.requestAnimationFrame(() => {
      textEditorRef.current?.focus();
      textEditorRef.current?.setSelectionRange(formatted.cursorStart, formatted.cursorEnd);
    });
  }

  const editor = (className: string) => {
    if (!("text" in block)) return null;
    return editing ? <textarea ref={textEditorRef} className={`block-input ${className}`} value={block.text} rows={Math.max(1, block.text.split("\n").length)}
      onChange={(event) => onChange({ ...block, text: event.target.value })}
      onSelect={(event) => { selectionRef.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }; }}
      onPaste={(event) => { const file = clipboardImage(event); if (file) onPasteImage(file); }}
      aria-label="블록 내용 편집" /> : <span className="rich-text">{renderRichText(block.text)}</span>;
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
    content = <figure className="article-image" style={{ width: `${imageWidth}%` }}><img src={block.url} alt={block.caption || "게시물 이미지"} />{editing && <div className="image-toolbar">
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
  return <div id={block.id} className={`content-block text-size-${textSize} ${editing ? "is-editing" : ""} ${isDragging ? "is-dragging" : ""} ${isDropTarget ? "is-drop-target" : ""}`}
    onDragOver={(event) => { if (editing) event.preventDefault(); }} onDragEnter={() => editing && onDragEnter()} onDrop={(event) => { if (editing) { event.preventDefault(); onDrop(); } }}>
    {editing && <div className="block-controls"><button className="drag-handle" draggable onDragStart={onDragStart} onDragEnd={onDragEnd} aria-label="블록 순서 이동">⋮⋮</button><button className="delete-block" onClick={onDelete} aria-label="블록 삭제">×</button></div>}
    {content}
    {inlineSlashOpen && <div className="inline-slash-menu"><p>블록 추가</p>{slashOptions.map((option) => <button key={option.type} onClick={() => onSlashCommand(option.type)}><span>{option.symbol}</span><div><strong>{option.label}</strong><small>{option.hint}</small></div></button>)}</div>}
    {inlineFormatOpen && <TextFormatMenu onCommand={applyBlockFormat} />}
    {editing && <button className="insert-after" onClick={onInsertAfter}>＋ 이 아래에 텍스트 추가</button>}
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

function clipboardImage(event: ClipboardEvent<HTMLTextAreaElement>) {
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
  const [draftText, setDraftText] = useState("");
  const [draftTextSize, setDraftTextSize] = useState<TextSize>("normal");
  const [newTocTitle, setNewTocTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("전체 콘텐츠");
  const [refreshKey, setRefreshKey] = useState(0);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [activeHeadingId, setActiveHeadingId] = useState("");
  const [indicator, setIndicator] = useState({ top: 0, height: 0 });
  const imageInput = useRef<HTMLInputElement>(null);
  const attachmentInput = useRef<HTMLInputElement>(null);
  const draftTextareaRef = useRef<HTMLTextAreaElement>(null);
  const draftSelectionRef = useRef({ start: 0, end: 0 });
  const tocLinksRef = useRef<HTMLDivElement>(null);
  const tocItemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: "1" });
      if (category !== "전체 콘텐츠") params.set("category", category);
      if (search.trim()) params.set("q", search.trim());
      try {
        const response = await fetch(`/api/posts?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) throw new Error("load failed");
        const result = await response.json();
        setPost(result.items[0] ?? null);
        setPagination(result.pagination);
        if (result.pagination.page !== page) setPage(result.pagination.page);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, search ? 220 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [category, page, search, refreshKey]);

  const headings = useMemo(() => post?.blocks.filter((block) => block.type === "heading") ?? [], [post?.blocks]);
  const showFormatMenu = formatTrigger.test(draftText);
  const showSlashMenu = !showFormatMenu && slashTrigger.test(draftText);

  useEffect(() => {
    if (!headings.length) { setActiveHeadingId(""); return; }
    function updateActiveHeading() {
      let active = headings[0].id;
      for (const heading of headings) {
        const element = document.getElementById(heading.id);
        if (element && element.getBoundingClientRect().top <= 190) active = heading.id;
      }
      setActiveHeadingId(active);
    }
    updateActiveHeading();
    window.addEventListener("scroll", updateActiveHeading, { passive: true });
    window.addEventListener("resize", updateActiveHeading);
    return () => { window.removeEventListener("scroll", updateActiveHeading); window.removeEventListener("resize", updateActiveHeading); };
  }, [headings]);

  useEffect(() => {
    const item = tocItemRefs.current[activeHeadingId];
    const container = tocLinksRef.current;
    if (!item || !container) { setIndicator({ top: 0, height: 0 }); return; }
    setIndicator({ top: item.offsetTop, height: item.offsetHeight });
  }, [activeHeadingId, headings, admin]);

  function updateBlock(id: string, next: ContentBlock) {
    setPost((current) => current ? { ...current, blocks: current.blocks.map((block) => block.id === id ? next : block) } : current);
    setSaved(false);
  }

  function insertParagraphAfter(id: string) {
    const newBlock: ContentBlock = { id: `paragraph-${Date.now()}`, type: "paragraph", text: "" };
    setPost((current) => {
      if (!current) return current;
      const index = current.blocks.findIndex((block) => block.id === id);
      const blocks = [...current.blocks];
      blocks.splice(index + 1, 0, newBlock);
      return { ...current, blocks };
    });
    setSaved(false);
  }

  function moveBlock(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    setPost((current) => {
      if (!current) return current;
      const blocks = [...current.blocks];
      const sourceIndex = blocks.findIndex((block) => block.id === sourceId);
      const targetIndex = blocks.findIndex((block) => block.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const [moved] = blocks.splice(sourceIndex, 1);
      blocks.splice(targetIndex, 0, moved);
      return { ...current, blocks };
    });
    setSaved(false);
  }

  function blocksWithDraft(block?: ContentBlock) {
    const text = cleanSlashTrigger(draftText);
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

  function insertBlockAfterId(targetId: string, newBlock: ContentBlock, cleanSlash = false) {
    setPost((current) => {
      if (!current) return current;
      const blocks = current.blocks.map((block) => cleanSlash && block.id === targetId && "text" in block
        ? { ...block, text: cleanSlashTrigger(block.text) } as ContentBlock : block);
      const index = blocks.findIndex((block) => block.id === targetId);
      blocks.splice(index + 1, 0, newBlock);
      return { ...current, blocks };
    });
    setSaved(false);
  }

  function handleInlineSlash(targetId: string, type: SlashCommandType) {
    if (type === "image" || type === "attachment") {
      setPost((current) => current ? { ...current, blocks: current.blocks.map((block) => block.id === targetId && "text" in block
        ? { ...block, text: cleanSlashTrigger(block.text) } as ContentBlock : block) } : current);
      setPendingInsertAfterId(targetId);
      if (type === "image") imageInput.current?.click();
      else attachmentInput.current?.click();
      return;
    }
    insertBlockAfterId(targetId, createStructuredBlock(type), true);
  }

  function addBlock(type: Exclude<SlashCommandType, "image" | "attachment">) {
    const block = createStructuredBlock(type);
    setPost((current) => current ? { ...current, blocks: [...current.blocks, ...blocksWithDraft(block)] } : current);
    setDraftText("");
    setDraftTextSize("normal");
    setSaved(false);
  }

  function addParagraph() {
    const additions = blocksWithDraft();
    if (!additions.length) return;
    setPost((current) => current ? { ...current, blocks: [...current.blocks, ...additions] } : current);
    setDraftText("");
    setDraftTextSize("normal");
    setSaved(false);
  }

  function applyDraftFormat(command: FormatCommand) {
    const formatted = formatText(draftText, draftSelectionRef.current, command);
    setDraftText(formatted.text);
    if (command.type === "size") setDraftTextSize(command.value);
    window.requestAnimationFrame(() => {
      draftTextareaRef.current?.focus();
      draftTextareaRef.current?.setSelectionRange(formatted.cursorStart, formatted.cursorEnd);
    });
  }

  function addTocHeading() {
    if (!newTocTitle.trim()) return;
    const block: ContentBlock = { id: `heading-${Date.now()}`, type: "heading", text: newTocTitle.trim() };
    setPost((current) => current ? { ...current, blocks: [...current.blocks, block] } : current);
    setNewTocTitle("");
    setActiveHeadingId(block.id);
    setSaved(false);
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
        setPost((current) => current ? { ...current, blocks: [...current.blocks, ...blocksWithDraft(block)] } : current);
        setDraftText("");
        setDraftTextSize("normal");
      }
      setPendingInsertAfterId(null);
      setSaved(false);
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
      setPost((current) => current ? { ...current, blocks: [...current.blocks, ...blocksWithDraft(image)] } : current);
      setDraftText("");
      setDraftTextSize("normal");
      setSaved(false);
    }
  }

  async function savePost() {
    if (!post) return;
    setSaving(true);
    const response = await fetch("/api/posts", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(post) });
    setSaving(false);
    if (response.status === 401) { window.location.reload(); return; }
    if (response.ok) { setSaved(true); window.setTimeout(() => setSaved(false), 2200); }
  }

  async function createPost() {
    setCreating(true);
    const targetCategory = category === "전체 콘텐츠" ? "업무 자동화" : category;
    const response = await fetch("/api/posts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ category: targetCategory }) });
    if (response.status === 401) { setCreating(false); window.location.reload(); return; }
    const created = response.ok ? await response.json() as Post : null;
    setCreating(false);
    if (created) { setCategory(targetCategory); setPage(1); setPost(created); setRefreshKey((value) => value + 1); }
  }

  return <div className="site-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="AI CoE Hub 홈"><span className="brand-mark">H</span><span><strong>AI CoE</strong><small>ESSENTIAL HUB</small></span></a>
      <label className="search"><span>⌕</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="콘텐츠, 프롬프트 검색" aria-label="콘텐츠 검색" /><kbd>⌘ K</kbd></label>
      <div className="header-actions">
        {admin && <button className="create-post-button" onClick={createPost} disabled={creating}>{creating ? "생성 중…" : "＋ 새 콘텐츠"}</button>}
        {admin && post && <button className="save-button" onClick={savePost} disabled={saving}>{saving ? "저장 중…" : saved ? "저장 완료 ✓" : "변경사항 저장"}</button>}
        <a className={`admin-toggle ${admin ? "active" : ""}`} href={adminPortalUrl}><span>◇</span>{admin ? "관리자 편집 중" : "관리자 모드"}</a>
      </div>
    </header>

    <div className="workspace" id="top">
      <aside className="sidebar">
        <nav><p className="nav-label">EXPLORE</p>{categories.map((item, index) => <button key={item} className={category === item ? "active" : ""} onClick={() => { setCategory(item); setPage(1); }}><span>{["⌂", "✦", "↗", "⚡"][index]}</span>{item}{item === "업무 자동화" && category === item && pagination.totalItems > 0 && <em>{pagination.totalItems}</em>}</button>)}</nav>
        <div className="sidebar-card"><span>✦</span><strong>AI 활용 아이디어가 있나요?</strong><p>AI CoE에 새로운 콘텐츠를 제안해 주세요.</p><a href={ideaMailto}>아이디어 제안</a></div>
        <footer>HANWHA ESSENTIAL<br />AI Center of Excellence</footer>
      </aside>

      <main className="main-area">
        <section className="collection-head">
          <div><span className="eyebrow">KNOWLEDGE LIBRARY</span><h1>일하는 방식을 바꾸는<br /><em>AI 지식과 실습</em></h1><p>검증된 프롬프트와 실습 자료를 바로 복사하고, 다운로드해 업무에 적용해 보세요.</p></div>
          <div className="stat-card"><span>현재 카테고리 콘텐츠</span><strong>{String(pagination.totalItems).padStart(2, "0")}</strong><small>백엔드에 저장된 게시물</small><i>↗</i></div>
        </section>

        <section className="section-title"><div><span className="live-dot" />FEATURED CONTENT</div><p>{category === "전체 콘텐츠" ? "AI CoE가 엄선한 최신 콘텐츠" : category}</p></section>

        {!post && !loading ? <div className="empty-state"><span>⌕</span><h2>{search ? "검색 결과가 없습니다" : `${category} 콘텐츠를 준비하고 있습니다`}</h2><p>{admin ? "상단의 ‘새 콘텐츠’ 버튼으로 첫 게시물을 만들어 보세요." : "새로운 콘텐츠가 등록되면 이곳에서 확인할 수 있습니다."}</p></div> : post && <>
          <article className={`article ${admin ? "admin-article" : ""}`}>
            <div className="article-cover"><div className="cover-grid" /><span className="cover-badge">CLOUDFLARE × EXCEL</span><div className="cloud-orbit"><span>☁</span></div><div className="cover-copy"><small>HANDS-ON LAB · 01</small><strong>DATA TO<br /><em>LIVE WEB</em></strong><p>엑셀 보고서를 실시간 대시보드로</p></div></div>
            <div className="article-body">
              {admin ? <div className="article-meta meta-editing"><label>카테고리<input list="category-list" value={post.category} onChange={(event) => setPost({ ...post, category: event.target.value })} /></label><label>게시일<input value={post.publishedAt} onChange={(event) => setPost({ ...post, publishedAt: event.target.value })} /></label><label>읽기 시간<input value={post.readTime} onChange={(event) => setPost({ ...post, readTime: event.target.value })} /></label><datalist id="category-list">{categoryOptions.map((item) => <option key={item} value={item} />)}</datalist></div>
                : <div className="article-meta"><span>{post.category}</span><span>{post.publishedAt}</span><span>{post.readTime} 읽기</span></div>}
              {admin ? <textarea className="title-editor" value={post.title} onChange={(event) => setPost({ ...post, title: event.target.value })} aria-label="제목 편집" /> : <h2 className="article-title">{post.title}</h2>}
              {admin ? <textarea className="excerpt-editor" value={post.excerpt} onChange={(event) => setPost({ ...post, excerpt: event.target.value })} aria-label="요약 편집" /> : <p className="article-excerpt">{post.excerpt}</p>}
              <div className="byline"><span className="avatar">AI</span><div><strong>{post.author}</strong><small>한화이센셜 AI Center of Excellence</small></div>{post.tags.map((tag) => <em key={tag}>#{tag}</em>)}</div>
              <div className="article-rule" />
              <div className="blocks">
                {post.blocks.map((block) => <BlockView key={block.id} block={block} editing={admin} onChange={(next) => updateBlock(block.id, next)}
                  onDelete={() => setPost((current) => current ? { ...current, blocks: current.blocks.filter((item) => item.id !== block.id) } : current)} onInsertAfter={() => insertParagraphAfter(block.id)} onReplaceFile={(file) => replaceBlockFile(block, file)} onPasteImage={(file) => pasteImage(file, block.id)}
                  onSlashCommand={(type) => handleInlineSlash(block.id, type)}
                  onDragStart={(event) => { setDraggedId(block.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", block.id); }} onDragEnter={() => draggedId && setDropTargetId(block.id)}
                  onDrop={() => { if (draggedId) moveBlock(draggedId, block.id); setDraggedId(null); setDropTargetId(null); }} onDragEnd={() => { setDraggedId(null); setDropTargetId(null); }} isDragging={draggedId === block.id} isDropTarget={dropTargetId === block.id && draggedId !== block.id} />)}
              </div>

              {admin && <div className="slash-editor">
                <div className="slash-line"><span>＋</span><textarea ref={draftTextareaRef} value={draftText} onChange={(event) => setDraftText(event.target.value)} onSelect={(event) => { draftSelectionRef.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }; }} onPaste={(event) => { const file = clipboardImage(event); if (file) pasteImage(file); }} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); addParagraph(); } }} rows={4} placeholder="새 내용을 입력하세요. '/' 블록 추가 · '//' 텍스트 서식 · 이미지는 Ctrl/⌘ + V" aria-label="새 내용 입력" /></div>
                <div className="composer-actions"><span>Enter 줄바꿈 · / 블록 · // 서식 · Ctrl/⌘ + V 이미지 붙여넣기 · ⌘/Ctrl + Enter 추가</span><button onClick={addParagraph} disabled={!draftText.trim()}>내용 추가</button></div>
                {showSlashMenu && <div className="slash-menu"><p>기본 블록</p>{slashOptions.map((option) => <button key={option.type} onClick={() => { setPendingInsertAfterId(null); if (option.type === "image") imageInput.current?.click(); else if (option.type === "attachment") attachmentInput.current?.click(); else addBlock(option.type); }}><span>{option.symbol}</span><div><strong>{option.label}</strong><small>{option.hint}</small></div></button>)}</div>}
                {showFormatMenu && <TextFormatMenu onCommand={applyDraftFormat} />}
                {uploading && <p className="upload-status">파일을 업로드하고 있습니다…</p>}{uploadError && <p className="upload-error">{uploadError}</p>}
                <input ref={imageInput} className="visually-hidden" type="file" accept="image/*" onChange={(event) => uploadFile(event, "image")} />
                <input ref={attachmentInput} className="visually-hidden" type="file" accept={attachmentAccept} onChange={(event) => uploadFile(event, "attachment")} />
              </div>}

              <div className="article-end"><span>HANWHA</span><p>AI를 가장 잘 쓰는 조직을 함께 만듭니다.</p></div>
            </div>
          </article>
          {pagination.totalPages > 1 && <nav className="pagination" aria-label="콘텐츠 페이지 이동"><button onClick={() => { setPage((value) => Math.max(1, value - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }} disabled={!pagination.hasPrevious}>← 이전</button><span><strong>{pagination.page}</strong> / {pagination.totalPages}</span><button onClick={() => { setPage((value) => value + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }} disabled={!pagination.hasNext}>다음 →</button></nav>}
        </>}
      </main>

      <aside className="toc">
        {post && <div className="toc-inner">
          {admin ? <input className="toc-title-editor" value={post.tocTitle} onChange={(event) => setPost({ ...post, tocTitle: event.target.value })} aria-label="목차 제목 편집" /> : <p>{post.tocTitle}</p>}
          <div className="toc-links" ref={tocLinksRef}><div className="toc-progress"><span style={{ top: indicator.top, height: indicator.height }} /></div>
            {headings.map((heading, index) => <div key={heading.id} ref={(element) => { tocItemRefs.current[heading.id] = element; }} className={`toc-row ${admin ? "admin-toc-row" : ""} ${activeHeadingId === heading.id ? "active" : ""}`}>
              {admin && "text" in heading ? <><a className="toc-number-link" href={`#${heading.id}`} onClick={() => setActiveHeadingId(heading.id)} aria-label={`${index + 1}번 본문으로 이동`}><span>{String(index + 1).padStart(2, "0")}</span></a><input value={plainRichText(heading.text)} onFocus={() => setActiveHeadingId(heading.id)} onChange={(event) => updateBlock(heading.id, { ...heading, text: event.target.value })} aria-label={`${index + 1}번 목차 편집`} /></>
                : <a href={`#${heading.id}`} onClick={() => setActiveHeadingId(heading.id)}><span>{String(index + 1).padStart(2, "0")}</span><span className="toc-label">{"text" in heading ? plainRichText(heading.text) : ""}</span></a>}
            </div>)}
          </div>
          {admin && <div className="toc-add"><input value={newTocTitle} onChange={(event) => setNewTocTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addTocHeading(); }} placeholder="목차와 본문 제목 추가" /><button onClick={addTocHeading}>＋</button></div>}
        </div>}
      </aside>
    </div>
    {loading && <div className="loading-toast">콘텐츠를 불러오는 중…</div>}
  </div>;
}
