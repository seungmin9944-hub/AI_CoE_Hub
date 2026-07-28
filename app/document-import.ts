import { XMLParser } from "fast-xml-parser";
import { unzipSync } from "fflate";
import { extractText } from "unpdf";
import type { ContentBlock } from "./content";

type XmlNode = Record<string, unknown>;

export type ImportedDocument = {
  title: string;
  excerpt: string;
  readTime: string;
  tags: string[];
  blocks: ContentBlock[];
};

const decoder = new TextDecoder();
const xmlParser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  trimValues: false,
  parseTagValue: false,
});

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function cleanText(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function fileTitle(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "가져온 문서";
}

function childNodes(node: unknown, tag: string) {
  const matches: Array<{ children: unknown[]; attributes: XmlNode }> = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    const object = value as XmlNode;
    if (Array.isArray(object[tag])) matches.push({ children: object[tag] as unknown[], attributes: (object[":@"] as XmlNode | undefined) ?? {} });
    for (const [key, nested] of Object.entries(object)) {
      if (key !== ":@" && key !== "#text" && key !== tag) visit(nested);
    }
  };
  visit(node);
  return matches;
}

function nodeText(node: unknown): string {
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (!node || typeof node !== "object") return "";
  const object = node as XmlNode;
  let text = typeof object["#text"] === "string" ? String(object["#text"]) : "";
  for (const [tag, value] of Object.entries(object)) {
    if (tag === "#text" || tag === ":@") continue;
    if (tag === "w:tab" || tag === "a:tab") text += "\t";
    else if (tag === "w:br" || tag === "a:br") text += "\n";
    else text += nodeText(value);
  }
  return text;
}

function readXml(files: Record<string, Uint8Array>, path: string) {
  const entry = files[path];
  if (!entry) throw new Error(`MISSING_XML:${path}`);
  return xmlParser.parse(decoder.decode(entry)) as unknown[];
}

function docxParagraphBlock(node: unknown): ContentBlock | null {
  const text = cleanText(nodeText(node));
  if (!text) return null;
  const style = childNodes(node, "w:pStyle")[0]?.attributes["@_w:val"];
  const styleName = String(style ?? "").toLowerCase();
  const heading = styleName.includes("title") || styleName.includes("heading") || styleName.includes("제목");
  return heading ? { id: id("heading"), type: "heading", text } : { id: id("paragraph"), type: "paragraph", text };
}

function tableBlock(node: unknown, rowTag: string, cellTag: string): ContentBlock | null {
  const rows = childNodes(node, rowTag).map((row) => childNodes(row.children, cellTag).map((cell) => cleanText(nodeText(cell.children))));
  const normalized = rows.filter((row) => row.some(Boolean));
  if (!normalized.length) return null;
  const width = Math.max(...normalized.map((row) => row.length));
  return { id: id("table"), type: "table", rows: normalized.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? "")) };
}

function parseDocx(bytes: ArrayBuffer) {
  const files = unzipSync(new Uint8Array(bytes));
  const xml = readXml(files, "word/document.xml");
  const body = childNodes(xml, "w:body")[0]?.children ?? xml;
  const blocks: ContentBlock[] = [];
  for (const entry of body) {
    if (!entry || typeof entry !== "object") continue;
    const object = entry as XmlNode;
    if (Array.isArray(object["w:p"])) {
      const block = docxParagraphBlock(object["w:p"]);
      if (block) blocks.push(block);
    } else if (Array.isArray(object["w:tbl"])) {
      const block = tableBlock(object["w:tbl"], "w:tr", "w:tc");
      if (block) blocks.push(block);
    }
  }
  return blocks;
}

function parsePptx(bytes: ArrayBuffer) {
  const files = unzipSync(new Uint8Array(bytes));
  const slidePaths = Object.keys(files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path)).sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
  const blocks: ContentBlock[] = [];
  slidePaths.forEach((path, slideIndex) => {
    const xml = readXml(files, path);
    const tables = childNodes(xml, "a:tbl");
    const tableParagraphs = new Set(tables.flatMap((table) => childNodes(table.children, "a:p").map((paragraph) => paragraph.children)));
    const paragraphs = childNodes(xml, "a:p").filter((paragraph) => !tableParagraphs.has(paragraph.children)).map((paragraph) => cleanText(nodeText(paragraph.children))).filter(Boolean);
    if (paragraphs.length) {
      blocks.push({ id: id("heading"), type: "heading", text: paragraphs[0] || `슬라이드 ${slideIndex + 1}` });
      if (paragraphs.length > 1) blocks.push({ id: id("paragraph"), type: "paragraph", text: paragraphs.slice(1).join("\n") });
    }
    tables.forEach((table) => {
      const block = tableBlock(table.children, "a:tr", "a:tc");
      if (block) blocks.push(block);
    });
  });
  return blocks;
}

async function parsePdf(bytes: ArrayBuffer) {
  const result = await extractText(new Uint8Array(bytes), { mergePages: false });
  const blocks: ContentBlock[] = [];
  result.text.forEach((page, index) => {
    const text = cleanText(page);
    if (!text) return;
    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
    blocks.push({ id: id("heading"), type: "heading", text: lines[0] || `페이지 ${index + 1}` });
    if (lines.length > 1) blocks.push({ id: id("paragraph"), type: "paragraph", text: lines.slice(1).join("\n") });
  });
  return blocks;
}

function summarize(blocks: ContentBlock[], fallbackTitle: string) {
  const textBlocks = blocks.filter((block): block is Extract<ContentBlock, { text: string }> => "text" in block);
  const earlyLines = textBlocks.slice(0, 10).flatMap((block) => cleanText(block.text).split("\n")).map((line) => line.trim()).filter(Boolean);
  const preferredTitle = earlyLines.find((line) => line.length >= 8 && line.length <= 160 && !/^(ai\s*coe|카테고리|태그|#|\d+분\s*읽기)/i.test(line));
  const title = cleanText(preferredTitle ?? textBlocks.find((block) => block.type === "heading")?.text ?? fallbackTitle).slice(0, 160) || fallbackTitle;
  const body = cleanText(textBlocks.map((block) => block.text).join(" "));
  const excerptSource = body.replace(title, "").trim() || body;
  const excerpt = `${excerptSource.slice(0, 180)}${excerptSource.length > 180 ? "…" : ""}` || `${fallbackTitle}에서 가져온 콘텐츠입니다.`;
  const words = body.split(/\s+/).filter(Boolean).length;
  return { title, excerpt, readTime: `${Math.max(1, Math.ceil(words / 250))}분` };
}

export async function importDocument(bytes: ArrayBuffer, name: string, contentType: string): Promise<ImportedDocument> {
  const extension = name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
  let blocks: ContentBlock[];
  if (extension === ".docx" || contentType.includes("wordprocessingml")) blocks = parseDocx(bytes);
  else if (extension === ".pptx" || contentType.includes("presentationml")) blocks = parsePptx(bytes);
  else if (extension === ".pdf" || contentType === "application/pdf") blocks = await parsePdf(bytes);
  else throw new Error("UNSUPPORTED_DOCUMENT");

  blocks = blocks.filter((block) => block.type !== "paragraph" || Boolean(block.text.trim())).slice(0, 300);
  if (!blocks.length) throw new Error("EMPTY_DOCUMENT");
  const fallbackTitle = fileTitle(name);
  return { ...summarize(blocks, fallbackTitle), tags: ["AI CoE", extension.replace(".", "").toUpperCase() || "문서"], blocks };
}
