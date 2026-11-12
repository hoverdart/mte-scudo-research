import {validatePageBlocks} from './pdf-structure.mjs';
export const TOPICS = ['Research hub', 'Crustify', 'Unsafe Rust', 'FFI', 'Formal verification', 'Static analysis', 'MTE', 'Scudo', 'LLM evaluation', 'Targets', 'Literature', 'PAC & BTI', 'Research design', 'Meetings', 'Unsorted'];
export const KINDS = ['Note', 'Question', 'Finding', 'Meeting', 'Experiment', 'Reading note', 'Research note', 'Plan', 'Tasks', 'Study guide', 'Document'];
export const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function terms(query) { return query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean); }
export function searchable(r) { return [r.title, r.summary, r.body, r.sourceName, ...r.topics, ...(r.pages || [])].join('\n').toLocaleLowerCase(); }
export function matches(r, {query = '', topic = '', kind = ''} = {}) {
  return (!topic || r.topics.includes(topic)) && (!kind || r.kind === kind) && terms(query).every(t => searchable(r).includes(t));
}
export function matchingPage(r, query) {
  const q = terms(query);
  return q.length ? (r.pages || []).findIndex(p => q.some(t => p.toLocaleLowerCase().includes(t))) : -1;
}
export function snippet(r, query) {
  const p = matchingPage(r, query);
  const text = (p >= 0 ? r.pages[p] : r.summary || r.body || '').replace(/\s+/g, ' ');
  const term = terms(query).find(t => text.toLocaleLowerCase().includes(t));
  const start = term ? Math.max(0, text.toLocaleLowerCase().indexOf(term) - 50) : 0;
  return (start ? '…' : '') + text.slice(start, start + 180) + (text.length > start + 180 ? '…' : '');
}
export function highlight(text, query) {
  const words = terms(query).sort((a,b)=>b.length-a.length).map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  if (!words.length) return escapeHtml(text);
  return String(text).split(new RegExp(`(${words.join('|')})`, 'ig')).map(s => terms(query).includes(s.toLocaleLowerCase()) ? `<mark>${escapeHtml(s)}</mark>` : escapeHtml(s)).join('');
}
export function sortEntries(entries, mode = 'topic') {
  return [...entries].sort((a,b) => mode === 'date' ? (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title) : a.topics[0].localeCompare(b.topics[0]) || a.title.localeCompare(b.title));
}
export function validDate(date) {
  return date === '' || /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date;
}
export function validateRecord(r) {
  if (!r || typeof r !== 'object' || !/^[a-zA-Z0-9_-]{1,100}$/.test(r.id || '') || typeof r.title !== 'string' || !r.title.trim() || r.title.length > 500) throw new Error('An entry has an invalid ID or title.');
  if (!Array.isArray(r.topics) || !r.topics.length || r.topics.length > 20 || r.topics.some(t=>typeof t!=='string' || t.length>80)) throw new Error('An entry has invalid topics.');
  if (typeof r.kind !== 'string' || r.kind.length > 80 || typeof r.date !== 'string' || !validDate(r.date)) throw new Error('An entry has an invalid type or date.');
  for (const key of ['summary','body','sourceName','dateBasis','updatedAt','parentId']) if (r[key] !== undefined && (typeof r[key] !== 'string' || r[key].length > 2000000)) throw new Error(`Invalid ${key} in an entry.`);
  if (r.pages !== undefined && (!Array.isArray(r.pages) || r.pages.length > 3000 || r.pages.some(p=>typeof p!=='string' || p.length>2000000))) throw new Error('Invalid document pages.');
  if (r.pageBlocks !== undefined) validatePageBlocks(r.pageBlocks,r.pages?.length);
  if (r.file && !/^sources\/[a-z0-9-]+\.pdf$/.test(r.file)) throw new Error('Invalid source file path.');
  if (r.fileData && (typeof r.fileData!=='string' || !/^data:application\/pdf;base64,[A-Za-z0-9+/=]+$/.test(r.fileData))) throw new Error('Invalid PDF attachment.');
  return r;
}
export function validateBackup(data) {
  if (data?.format !== 'research-desk' || data.version !== 1 || !Array.isArray(data.records) || data.records.length > 10000 || !Array.isArray(data.meeting)) throw new Error('Choose a Research Desk backup JSON file.');
  const ids = new Set();
  data.records.forEach(r=>{validateRecord(r); if(ids.has(r.id)) throw new Error('Duplicate entry IDs in backup.'); ids.add(r.id);});
  if (data.meeting.some(id=>typeof id!=='string' || !ids.has(id))) throw new Error('A meeting item is missing from the backup.');
  return data;
}
export function markdownBrief(records) {
  return '# Marius Research Hub — Meeting brief\n\n' + records.map(r=>`## ${r.title}\n\n${r.kind} · ${r.topics.join(', ')} · ${r.date || 'Undated'}\n\n${r.summary || ''}\n\n${r.body || ''}${r.sourceName ? '\n\nSource: '+r.sourceName : ''}`).join('\n\n---\n\n') + '\n';
}
