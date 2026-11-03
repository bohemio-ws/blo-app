import { AssistantIntent } from '../../contracts/assistant.js';

const clean = (value) => String(value ?? '').trim().replace(/[.!?]+$/, '').trim();
const normalize = (value) => clean(value).toLocaleLowerCase('es-ES').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function parseDue(reference, now = new Date()) {
  const value = normalize(reference);
  const date = new Date(now);
  if (value === 'hoy') { date.setHours(23, 59, 0, 0); return date.toISOString(); }
  if (value === 'mañana' || value === 'manana') { date.setDate(date.getDate() + 1); date.setHours(23, 59, 0, 0); return date.toISOString(); }
  const match = value.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$/);
  if (!match) return null;
  const year = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : date.getFullYear();
  const parsed = new Date(year, Number(match[2]) - 1, Number(match[1]), 23, 59, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export class LocalAfroditaInterpreter {
  async interpret(command, context = {}) {
    const text = clean(command), normalized = normalize(text);
    if (/^(?:afrodita[, ]+)?(?:que )?(?:tengo que hacer|tengo pendiente|es importante|hago)(?: ahora| hoy)?$/.test(normalized) || /^(?:afrodita[, ]+)?(?:que|cual) es (?:lo )?importante(?: ahora| hoy)?$/.test(normalized)) return { intent: AssistantIntent.WHAT_NOW, payload: {} };
    let match = text.match(/^(?:Afrodita[, ]+)?(?:abre|activa|cambia a|trabaja en|selecciona)\s+(?:el\s+)?proyecto\s+(.+)$/i);
    if (match) return { intent: AssistantIntent.SELECT_PROJECT, payload: { projectRef: clean(match[1]) } };
    match = text.match(/^(?:Afrodita[, ]+)?(?:crea|crear|nuevo|nueva)\s+(?:un\s+)?proyecto(?:\s+(?:llamado|que se llame))?\s+(.+)$/i);
    if (match) return { intent: AssistantIntent.CREATE_PROJECT, payload: { name: clean(match[1]) } };
    match = text.match(/^(?:Afrodita[, ]+)?(?:crea|crear|añade|anota|apunta)\s+(?:una\s+)?tarea(?:\s+(?:llamada|que se llame))?\s+(.+?)(?:\s+en\s+(?:el\s+)?proyecto\s+(.+))?$/i);
    if (match) return { intent: AssistantIntent.CREATE_TASK, payload: { title: clean(match[1]), projectId: context.projectId ?? null, projectRef: match[2] ? clean(match[2]) : null } };
    match = text.match(/^(?:Afrodita[, ]+)?(?:pon|programa|agenda|fija)\s+(?:la\s+)?tarea\s+(.+?)\s+(?:para|el)\s+(hoy|mañana|manana|\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)$/i);
    if (match) return { intent: AssistantIntent.SET_TASK_DUE, payload: { taskRef: clean(match[1]), dueAt: parseDue(match[2]), projectId: context.projectId ?? null } };
    const lifecycle = [[AssistantIntent.COMPLETE_TASK,/^(?:Afrodita[, ]+)?(?:completa|termina|finaliza|marca como hecha|da por terminada)\s+(?:la\s+)?tarea\s+(.+)$/i],[AssistantIntent.BLOCK_TASK,/^(?:Afrodita[, ]+)?(?:bloquea|marca como bloqueada)\s+(?:la\s+)?tarea\s+(.+)$/i],[AssistantIntent.RESUME_TASK,/^(?:Afrodita[, ]+)?(?:reanuda|reactiva|desbloquea|continua con|continúa con)\s+(?:la\s+)?tarea\s+(.+)$/i]];
    for (const [intent, pattern] of lifecycle) { match = text.match(pattern); if (match) return { intent, payload: { taskRef: clean(match[1]), projectId: context.projectId ?? null } }; }
    return { intent: AssistantIntent.UNKNOWN, payload: { text } };
  }
}
