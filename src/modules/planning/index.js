export const planningModule={id:'planning',async start({events}){await events.emit('module:ready',{id:'planning'});}};
