// Builds the semantic-search index: one 384-dim vector per bookmark, stored as int8.
// Incremental: vectors for ids already in embeddings.bin are reused, so a sync only embeds new bookmarks.
//   node embed.mjs            -> writes embeddings.bin + embeddings.json aligned to bookmarks.json order
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { pipeline } from '@huggingface/transformers';

const { embedText } = createRequire(import.meta.url)('./rules.js');
export const MODEL = 'Xenova/bge-small-en-v1.5', DIM = 384, DTYPE = 'q8';
export const SCALE = 250; // int8 = round(v * SCALE), clamped; bge components stay under ~0.6, so almost nothing clips

function loadCache() {
  const cache = new Map();
  try {
    const meta = JSON.parse(fs.readFileSync('embeddings.json', 'utf8'));
    if (meta.model !== MODEL || meta.scale !== SCALE) return cache; // model changed: re-embed everything
    const buf = fs.readFileSync('embeddings.bin');
    meta.ids.forEach((id, i) => cache.set(id, buf.subarray(i * DIM, (i + 1) * DIM)));
  } catch {}
  return cache;
}

const { bookmarks } = JSON.parse(fs.readFileSync('bookmarks.json', 'utf8'));
const cache = loadCache();
const todo = bookmarks.filter(b => !cache.has(b.id));
console.error(`${bookmarks.length} bookmarks, ${cache.size} cached, ${todo.length} to embed`);

if (todo.length) {
  const extract = await pipeline('feature-extraction', MODEL, { dtype: DTYPE });
  const t0 = Date.now();
  for (let i = 0; i < todo.length; i += 32) {
    const batch = todo.slice(i, i + 32);
    const { data } = await extract(batch.map(embedText), { pooling: 'cls', normalize: true });
    batch.forEach((b, j) => {
      const v = new Int8Array(DIM);
      for (let k = 0; k < DIM; k++) v[k] = Math.max(-127, Math.min(127, Math.round(data[j * DIM + k] * SCALE)));
      cache.set(b.id, Buffer.from(v.buffer));
    });
    if ((i / 32) % 50 === 0) console.error(`  ${i + batch.length}/${todo.length} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
}

// Append-only order (old rows first, new rows last) so each sync changes only the file's tail and git
// stores a tiny delta. Vectors of un-bookmarked tweets stay; the page ignores ids it can't find.
// ponytail: never compacts; a fresh `rm embeddings.*; node embed.mjs` rebuilds it if it ever gets bloated.
fs.writeFileSync('embeddings.bin', Buffer.concat([...cache.values()]));
fs.writeFileSync('embeddings.json', JSON.stringify({ model: MODEL, dtype: DTYPE, dim: DIM, scale: SCALE, ids: [...cache.keys()] }));
console.error(`wrote embeddings.bin (${(cache.size * DIM / 1e6).toFixed(1)} MB, ${cache.size} vectors)`);
