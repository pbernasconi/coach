'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { acceptedFiles, type ChatAttachmentItem } from '@kobo/web';
import type { FileRef } from './types';

/** What the composer's + offers (lift/APP-API.md, "Coach attachments"). */
export const COACH_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,text/csv,text/markdown,application/json,.md,.csv,.txt';
const MAX_FILES = 6;
/** Claude reads no more detail than this on a photo's long side. */
const MAX_SIDE = 1568;

type Upload = ChatAttachmentItem & { file: File; ref: FileRef | null; error: string | null };

const kindOf = (f: File): ChatAttachmentItem['kind'] => (f.type.startsWith('image/') ? 'image' : f.type === 'application/pdf' ? 'pdf' : 'text');

/** A photo shrunk to MAX_SIDE as a JPEG (GIFs stay as they are), with its size. */
async function prepare(file: File): Promise<{ blob: Blob; width: number | null; height: number | null }> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return { blob: file, width: null, height: null };
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    if (scale === 1 && file.type === 'image/jpeg') return { blob: file, width, height };
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.8));
    return { blob: blob ?? file, width, height };
  } catch {
    return { blob: file, width: null, height: null };
  }
}

/** The photos and files picked for the next message: each uploads at once (POST /api/coach/files). */
export function useCoachUploads() {
  const [items, setItems] = useState<Upload[]>([]);
  const urls = useRef<string[]>([]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const update = (id: string, patch: Partial<Upload>) => setItems((list) => list.map((u) => (u.id === id ? { ...u, ...patch } : u)));

  const upload = async (u: Upload) => {
    try {
      const { blob, width, height } = await prepare(u.file);
      const headers: Record<string, string> = {
        'Content-Type': blob.type || u.file.type || 'text/plain',
        'X-File-Name': encodeURIComponent(u.name),
      };
      if (width && height) {
        headers['X-Image-Width'] = String(width);
        headers['X-Image-Height'] = String(height);
      }
      const res = await fetch('/api/coach/files', { method: 'POST', headers, body: blob });
      const body = (await res.json().catch(() => ({}))) as { file?: FileRef; error?: string };
      if (!res.ok || !body.file) throw new Error(body.error ?? `HTTP ${res.status}`);
      update(u.id, { state: 'ready', ref: body.file });
    } catch (e) {
      update(u.id, { state: 'failed', error: e instanceof Error ? e.message : 'upload failed' });
    }
  };

  const add = (files: File[]) => {
    const picked = acceptedFiles(files, COACH_ACCEPT, MAX_FILES - items.length);
    const fresh: Upload[] = picked.map((file, i) => {
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      if (previewUrl) urls.current.push(previewUrl);
      return { id: `u${Date.now()}-${i}`, name: file.name || 'Photo', kind: kindOf(file), previewUrl, state: 'uploading', file, ref: null, error: null };
    });
    setItems((current) => [...current, ...fresh]);
    for (const u of fresh) void upload(u);
  };

  const remove = useCallback((id: string) => setItems((list) => list.filter((u) => u.id !== id)), []);
  const clear = useCallback(() => setItems([]), []);
  const ready = items.flatMap((u) => (u.state === 'ready' && u.ref ? [u.ref] : []));

  return { items, add, remove, clear, ready };
}
