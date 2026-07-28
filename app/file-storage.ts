const MAX_FILE_SIZE = 50 * 1024 * 1024;

export function safeFileName(name: string, type: string) {
  const extension = name.match(/\.[a-zA-Z0-9]{1,10}$/)?.[0]
    ?? (type.startsWith("image/") ? `.${type.split("/")[1]?.replace("jpeg", "jpg") || "png"}` : "");
  const stem = name.replace(/\.[^.]+$/, "").normalize("NFKC").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${stem || "file"}-${crypto.randomUUID().slice(0, 8)}${extension.toLowerCase()}`;
}

export async function storeUpload(bucket: R2Bucket, bytes: ArrayBuffer, originalName: string, contentType: string) {
  if (bytes.byteLength > MAX_FILE_SIZE) throw new Error("FILE_TOO_LARGE");
  if (!bytes.byteLength) throw new Error("EMPTY_FILE");

  const safeName = safeFileName(originalName, contentType);
  const key = `uploads/${Date.now()}-${safeName}`;
  await bucket.put(key, new Uint8Array(bytes), {
    httpMetadata: {
      contentType,
      contentDisposition: `${contentType.startsWith("image/") ? "inline" : "attachment"}; filename="${safeName}"`,
    },
    customMetadata: { originalName },
  });
  return { key, url: `/api/files/${key}`, name: originalName, size: bytes.byteLength };
}
