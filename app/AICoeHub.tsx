"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { seedPost, type ContentBlock, type Post, type TableBlock } from "./content";

const categories = ["전체 콘텐츠", "실습 가이드", "프롬프트", "AI 트렌드", "업무 자동화"];

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }
  return <button className="copy-button" onClick={copy} aria-label="코드 복사">{copied ? "복사 완료" : "복사"}</button>;
}

function BlockView({ block, editing, onChange, onDelete }: {
  block: ContentBlock;
  editing: boolean;
  onChange: (next: ContentBlock) => void;
  onDelete: () => void;
}) {
  const editor = (className: string, multiline = true) => {
    if (!("text" in block)) return null;
    return editing ? (
      <textarea className={`block-input ${className}`} value={block.text} rows={multiline ? Math.max(1, block.text.split("\n").length) : 1}
        onChange={(event) => onChange({ ...block, text: event.target.value })} aria-label="블록 내용 편집" />
    ) : <span>{block.text}</span>;
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
    content = <a className="attachment" href={block.url} download><span className="attachment-icon">↓</span><span><strong>{block.name}</strong><small>{block.size} · 실습파일</small></span><span className="download-label">다운로드</span></a>;
  } else if (block.type === "image") {
    content = <figure className="article-image"><img src={block.url} alt={block.caption || "게시물 이미지"} />{editing ? <input value={block.caption} onChange={(e) => onChange({ ...block, caption: e.target.value })} placeholder="이미지 설명" /> : <figcaption>{block.caption}</figcaption>}</figure>;
  } else {
    const table = block as TableBlock;
    content = <div className="table-wrap"><table><tbody>{table.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => {
      const Tag = rowIndex === 0 ? "th" : "td";
      return <Tag key={cellIndex}>{editing ? <input value={cell} onChange={(e) => {
        const rows = table.rows.map((current, r) => current.map((value, c) => r === rowIndex && c === cellIndex ? e.target.value : value));
        onChange({ ...table, rows });
      }} /> : cell}</Tag>;
    })}</tr>)}</tbody></table></div>;
  }

  return <div id={block.id} className={`content-block ${editing ? "is-editing" : ""}`}>{editing && <button className="delete-block" onClick={onDelete} aria-label="블록 삭제">×</button>}{content}</div>;
}

const slashOptions = [
  { type: "code", label: "코드", hint: "코드 또는 프롬프트 블록", symbol: "</>" },
  { type: "image", label: "이미지", hint: "파일을 업로드해 삽입", symbol: "▧" },
  { type: "callout", label: "콜아웃", hint: "강조할 안내문", symbol: "!" },
  { type: "table", label: "표", hint: "3 × 3 기본 표", symbol: "▦" },
] as const;

export function AICoeHub() {
  const [post, setPost] = useState<Post>(seedPost);
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [slash, setSlash] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("전체 콘텐츠");
  const imageInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/posts?slug=${seedPost.slug}`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(setPost)
      .finally(() => setLoading(false));
  }, []);

  const headings = useMemo(() => post.blocks.filter((block) => block.type === "heading").slice(0, 5), [post.blocks]);
  const matchesSearch = !search || `${post.title} ${post.excerpt} ${post.tags.join(" ")} ${post.blocks.map((block) => "text" in block ? block.text : "").join(" ")}`.toLowerCase().includes(search.toLowerCase());

  function updateBlock(id: string, next: ContentBlock) {
    setPost((current) => ({ ...current, blocks: current.blocks.map((block) => block.id === id ? next : block) }));
    setSaved(false);
  }

  function addBlock(type: "code" | "callout" | "table") {
    const id = `block-${Date.now()}`;
    const block: ContentBlock = type === "table"
      ? { id, type, rows: [["항목", "내용", "비고"], ["", "", ""], ["", "", ""]] }
      : type === "code"
        ? { id, type, language: "prompt", text: "여기에 코드 또는 프롬프트를 입력하세요." }
        : { id, type, tone: "info", text: "강조할 내용을 입력하세요." };
    setPost((current) => ({ ...current, blocks: [...current.blocks, block] }));
    setSlash("");
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/files", { method: "POST", body: form });
    if (!response.ok) return;
    const result = await response.json();
    setPost((current) => ({ ...current, blocks: [...current.blocks, { id: `block-${Date.now()}`, type: "image", url: result.url, caption: file.name }] }));
    setSlash("");
    event.target.value = "";
  }

  async function savePost() {
    setSaving(true);
    const response = await fetch("/api/posts", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(post) });
    setSaving(false);
    if (response.ok) { setSaved(true); window.setTimeout(() => setSaved(false), 2200); }
  }

  return <div className="site-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="AI CoE Hub 홈"><span className="brand-mark">H</span><span><strong>AI CoE</strong><small>ESSENTIAL HUB</small></span></a>
      <label className="search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="콘텐츠, 프롬프트 검색" aria-label="콘텐츠 검색" /><kbd>⌘ K</kbd></label>
      <div className="header-actions">
        {admin && <button className="save-button" onClick={savePost} disabled={saving}>{saving ? "저장 중…" : saved ? "저장 완료 ✓" : "변경사항 저장"}</button>}
        <button className={`admin-toggle ${admin ? "active" : ""}`} onClick={() => setAdmin(!admin)}><span>{admin ? "◆" : "◇"}</span>{admin ? "관리자 편집 중" : "관리자 모드"}</button>
      </div>
    </header>

    <div className="workspace" id="top">
      <aside className="sidebar">
        <nav><p className="nav-label">EXPLORE</p>{categories.map((item, index) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}><span>{["⌂", "▤", "✦", "↗", "⚡"][index]}</span>{item}{index === 1 && <em>1</em>}</button>)}</nav>
        <div className="sidebar-card"><span>✦</span><strong>AI 활용 아이디어가 있나요?</strong><p>AI CoE에 새로운 콘텐츠를 제안해 주세요.</p><button>아이디어 제안</button></div>
        <footer>HANWHA ESSENTIAL<br />AI Center of Excellence</footer>
      </aside>

      <main className="main-area">
        <section className="collection-head">
          <div><span className="eyebrow">KNOWLEDGE LIBRARY</span><h1>일하는 방식을 바꾸는<br /><em>AI 지식과 실습</em></h1><p>검증된 프롬프트와 실습 자료를 바로 복사하고, 다운로드해 업무에 적용해 보세요.</p></div>
          <div className="stat-card"><span>이번 달 새 콘텐츠</span><strong>08</strong><small>지난달보다 3개 더</small><i>↗</i></div>
        </section>

        <section className="section-title"><div><span className="live-dot" />FEATURED GUIDE</div><p>{category === "전체 콘텐츠" ? "AI CoE가 엄선한 최신 가이드" : category}</p></section>

        {!matchesSearch ? <div className="empty-state"><span>⌕</span><h2>검색 결과가 없습니다</h2><p>다른 키워드로 다시 찾아보세요.</p></div> : <article className={`article ${admin ? "admin-article" : ""}`}>
          <div className="article-cover"><div className="cover-grid" /><span className="cover-badge">CLOUDFLARE × EXCEL</span><div className="cloud-orbit"><span>☁</span></div><div className="cover-copy"><small>HANDS-ON LAB · 01</small><strong>DATA TO<br /><em>LIVE WEB</em></strong><p>엑셀 보고서를 실시간 대시보드로</p></div></div>
          <div className="article-body">
            <div className="article-meta"><span>{post.category}</span><span>{post.publishedAt}</span><span>{post.readTime} 읽기</span></div>
            {admin ? <textarea className="title-editor" value={post.title} onChange={(e) => setPost({ ...post, title: e.target.value })} aria-label="제목 편집" /> : <h2 className="article-title">{post.title}</h2>}
            {admin ? <textarea className="excerpt-editor" value={post.excerpt} onChange={(e) => setPost({ ...post, excerpt: e.target.value })} aria-label="요약 편집" /> : <p className="article-excerpt">{post.excerpt}</p>}
            <div className="byline"><span className="avatar">AI</span><div><strong>{post.author}</strong><small>한화이센셜 AI Center of Excellence</small></div>{post.tags.map((tag) => <em key={tag}>#{tag}</em>)}</div>
            <div className="article-rule" />
            <div className="blocks">
              {post.blocks.map((block) => <BlockView key={block.id} block={block} editing={admin} onChange={(next) => updateBlock(block.id, next)} onDelete={() => setPost((current) => ({ ...current, blocks: current.blocks.filter((item) => item.id !== block.id) }))} />)}
            </div>

            {admin && <div className="slash-editor">
              <div className="slash-line"><span>＋</span><input value={slash} onChange={(e) => setSlash(e.target.value)} placeholder="'/'를 입력해 블록 추가" aria-label="슬래시 명령 입력" /></div>
              {slash.startsWith("/") && <div className="slash-menu"><p>기본 블록</p>{slashOptions.map((option) => <button key={option.type} onClick={() => option.type === "image" ? imageInput.current?.click() : addBlock(option.type)}><span>{option.symbol}</span><div><strong>{option.label}</strong><small>{option.hint}</small></div></button>)}</div>}
              <input ref={imageInput} className="visually-hidden" type="file" accept="image/*" onChange={uploadImage} />
            </div>}

            <div className="article-end"><span>HANWHA</span><p>AI를 가장 잘 쓰는 조직을 함께 만듭니다.</p></div>
          </div>
        </article>}
      </main>

      <aside className="toc">
        <div className="toc-inner"><p>ON THIS PAGE</p>{headings.map((heading, index) => <a key={heading.id} href={`#${heading.id}`}><span>{String(index + 1).padStart(2, "0")}</span>{"text" in heading ? heading.text.replace(/^[^가-힣A-Za-z\[]+/, "") : ""}</a>)}<div className="toc-progress"><span style={{ height: `${Math.min(100, 28 + post.blocks.length)}%` }} /></div></div>
        <div className="help-card"><span>?</span><strong>실습 중 막혔나요?</strong><p>AI CoE 오피스아워에서 함께 해결해 드립니다.</p><button>도움 요청하기 ↗</button></div>
      </aside>
    </div>
    {loading && <div className="loading-toast">콘텐츠를 불러오는 중…</div>}
  </div>;
}
