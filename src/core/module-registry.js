export class ModuleRegistry {
  #modules=new Map();
  register(module){if(!module?.id||typeof module.start!=='function')throw new TypeError('A BLO module requires an id and start(context).');if(this.#modules.has(module.id))throw new Error(`Module already registered: ${module.id}`);this.#modules.set(module.id,{module,status:'registered'});return this;}
  async start(id,context){const entry=this.#modules.get(id);if(!entry)throw new Error(`Unknown module: ${id}`);if(entry.status==='active')return;await entry.module.start(context);entry.status='active';}
  async stop(id,context){const entry=this.#modules.get(id);if(!entry||entry.status!=='active')return;if(typeof entry.module.stop==='function')await entry.module.stop(context);entry.status='registered';}
  status(){return[...this.#modules.entries()].map(([id,entry])=>({id,status:entry.status}));}
}
