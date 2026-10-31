export class EventBus {
  #listeners = new Map();
  on(eventName,handler){if(!this.#listeners.has(eventName))this.#listeners.set(eventName,new Set());this.#listeners.get(eventName).add(handler);return()=>this.#listeners.get(eventName)?.delete(handler);}
  async emit(eventName,payload){const handlers=[...(this.#listeners.get(eventName)??[])];await Promise.all(handlers.map(handler=>handler(payload)));}
}
