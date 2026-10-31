import { EventBus } from './event-bus.js';
import { ModuleRegistry } from './module-registry.js';
export class BloApp { constructor({storage,modules=[]}){if(!storage)throw new TypeError('BLO requires a storage adapter.');this.context=Object.freeze({storage,events:new EventBus()});this.modules=new ModuleRegistry();modules.forEach(module=>this.modules.register(module));} async start(){for(const {id} of this.modules.status())await this.modules.start(id,this.context);await this.context.events.emit('blo:ready',{at:new Date().toISOString()});}}
