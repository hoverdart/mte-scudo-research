#!/usr/bin/env node
// A deliberately boring event trace for teaching allocation lifetime concepts.
// It never writes out of bounds and never exposes an address or reusable payload.
const events = [];
const slots = new Map();
function alloc(label) { const id = slots.size + 1; slots.set(id, { label, live: true }); events.push(['alloc', id, label]); return id; }
function free(id) { const item = slots.get(id); if (!item || !item.live) throw new Error(`invalid free: ${id}`); item.live = false; events.push(['free', id]); }
function read(id) { const item = slots.get(id); if (!item?.live) { events.push(['detected-stale-read', id]); return null; } events.push(['read', id, item.label]); return item.label; }
const first = alloc('toy-buffer');
read(first);
free(first);
read(first);
console.log(JSON.stringify({ events, note: 'Detection-only fixture; no memory corruption is performed.' }, null, 2));
