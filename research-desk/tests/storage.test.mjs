import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readState,writeState,mutateState} from '../dist/db.mjs';
test('notes, attachment data, meeting selections and removals survive a storage roundtrip',async()=>{const blank=await readState();assert.deepEqual(blank,{records:[],meeting:[],hidden:[]});const state={records:[{id:'test',title:'Saved note',body:'A real observation',fileData:'data:application/pdf;base64,YQ=='}],meeting:['test'],hidden:['source-old']};await writeState(state);assert.deepEqual(await readState(),state);});

test('concurrent saves merge through one read-write transaction',async()=>{await writeState({records:[],meeting:[],hidden:[]});await Promise.all([mutateState(s=>s.records.push({id:'a'})),mutateState(s=>s.records.push({id:'b'}))]);assert.deepEqual((await readState()).records.map(r=>r.id),['a','b']);});
