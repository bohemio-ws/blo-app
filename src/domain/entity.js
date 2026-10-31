export function createId(prefix='blo'){if(globalThis.crypto?.randomUUID)return`${prefix}_${crypto.randomUUID()}`;return`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;}
export function timestamps(now=new Date()){const iso=now.toISOString();return{createdAt:iso,updatedAt:iso};}
export function requireText(value,field){const text=String(value??'').trim();if(!text)throw new Error(`${field} es obligatorio`);return text;}
