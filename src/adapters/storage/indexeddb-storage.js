import { StorageContract } from '../../contracts/storage.js';

export class IndexedDbStorage extends StorageContract {
  #dbName; #version; #collections; #dbPromise;
  constructor({ dbName = 'blo-local', version = 2, collections = [] } = {}) { super(); this.#dbName=dbName; this.#version=version; this.#collections=[...new Set(collections)]; }
  #open(){ if(this.#dbPromise)return this.#dbPromise; this.#dbPromise=new Promise((resolve,reject)=>{ const request=indexedDB.open(this.#dbName,this.#version); request.onupgradeneeded=()=>{const db=request.result; for(const collection of this.#collections){if(!db.objectStoreNames.contains(collection))db.createObjectStore(collection,{keyPath:'id'});}}; request.onsuccess=()=>{const db=request.result; db.onversionchange=()=>db.close(); resolve(db);}; request.onerror=()=>reject(request.error); request.onblocked=()=>reject(new Error('BLO local database upgrade is blocked by another open tab.'));}); return this.#dbPromise; }
  async #request(collection,mode,operation){const db=await this.#open(); if(!db.objectStoreNames.contains(collection))throw new Error(`Unknown BLO collection: ${collection}`); return new Promise((resolve,reject)=>{const tx=db.transaction(collection,mode); const request=operation(tx.objectStore(collection)); request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error); tx.onabort=()=>reject(tx.error??new Error(`BLO transaction aborted: ${collection}`));});}
  get(collection,id){return this.#request(collection,'readonly',store=>store.get(id));}
  list(collection){return this.#request(collection,'readonly',store=>store.getAll());}
  put(collection,entity){if(!entity?.id)throw new TypeError('Stored entities require an id.'); const copy=globalThis.structuredClone?structuredClone(entity):JSON.parse(JSON.stringify(entity)); return this.#request(collection,'readwrite',store=>store.put(copy));}
  remove(collection,id){return this.#request(collection,'readwrite',store=>store.delete(id));}
}
