let handle;
export async function database() {
  if (handle) return handle;
  handle = await new Promise((resolve,reject)=>{
    const request = indexedDB.open('mte-scudo-research-desk',1);
    request.onupgradeneeded = () => request.result.createObjectStore('workspace');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return handle;
}
export async function readState() {
  const db=await database();
  return new Promise((resolve,reject)=>{const r=db.transaction('workspace').objectStore('workspace').get('state'); r.onsuccess=()=>resolve(r.result || {records:[],meeting:[],hidden:[]});r.onerror=()=>reject(r.error);});
}
export async function writeState(state) {
  const db=await database();
  return new Promise((resolve,reject)=>{const tx=db.transaction('workspace','readwrite');tx.objectStore('workspace').put(state,'state');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error || new Error('Save interrupted'));});
}
export async function mutateState(change) {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('workspace','readwrite');
    const store=tx.objectStore('workspace');
    const request=store.get('state');
    let next;
    request.onsuccess=()=>{
      next=request.result || {records:[],meeting:[],hidden:[]};
      try { change(next); store.put(next,'state'); } catch(e) { tx.abort(); reject(e); }
    };
    tx.oncomplete=()=>resolve(next);
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error || new Error('Save interrupted'));
  });
}
