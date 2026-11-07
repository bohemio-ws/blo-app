import { BloApp } from './core/app.js';
import { IndexedDbStorage } from './adapters/storage/indexeddb-storage.js';
import { BLO_DB_NAME, BLO_DB_VERSION, BLO_COLLECTIONS, BLO_REPOSITORIES } from './config/storage-schema.js';
import { planningModule } from './modules/planning/index.js';
import { Repository } from './repositories/repository.js';
import { PriorityEngine } from './services/priority-engine.js';
import { ContextService } from './services/context-service.js';
import { AuthorizationService } from './services/authorization-service.js';
import { DashboardService } from './modules/dashboard/dashboard-service.js';
import { AfroditaCommandRouter } from './modules/afrodita/command-router.js';
import { LocalAfroditaInterpreter } from './modules/afrodita/local-interpreter.js';
import { ProjectBuilder } from './modules/project-builder/index.js';
import { PlanningService } from './services/planning-service.js';
import { AuditService } from './modules/audit/audit-service.js';
import { OperationService } from './services/operation-service.js';
import { PttController } from './modules/voice/ptt-controller.js';
import { renderDashboard } from './ui/dashboard-view.js';
import { bindAfroditaPanel } from './ui/afrodita-panel.js';

const storage = new IndexedDbStorage({ dbName: BLO_DB_NAME, version: BLO_DB_VERSION, collections: BLO_COLLECTIONS });
const app = new BloApp({ storage, modules: [planningModule] });
const repositories = Object.fromEntries(BLO_REPOSITORIES.map((name) => [name, new Repository(storage, name)]));
const audit = new AuditService(repositories.auditLog);
const authorization = new AuthorizationService({ repository: repositories.authorizations });
const operations = new OperationService({ audit, eventBus: app.context.events, authorization });
const planning = new PlanningService(repositories, { operations, events: app.context.events });
const projectBuilder = new ProjectBuilder(repositories, app.context.events, operations);
const dashboard = new DashboardService({ repositories, priorityEngine: new PriorityEngine() });
const contextService = new ContextService({ projects: repositories.projects });
const afrodita = new AfroditaCommandRouter({ dashboard, projectBuilder, planning, contextService, interpreter: new LocalAfroditaInterpreter() });

async function refreshDashboard() {
  const { projectId = null } = await contextService.context();
  const snapshot = await dashboard.snapshot({ projectId });
  renderDashboard(document.querySelector('#priority-list'), snapshot);
  return snapshot;
}

app.context.events.on('blo:ready', async () => {
  document.documentElement.dataset.bloStatus = 'ready';
  await refreshDashboard();
  window.dispatchEvent(new CustomEvent('blo-ready'));
});
app.context.events.on('project.provisioned', refreshDashboard);
app.context.events.on('planning.task.created', refreshDashboard);
app.context.events.on('planning.task.changed', refreshDashboard);

const panel = bindAfroditaPanel({
  form: document.querySelector('#afrodita-form'), input: document.querySelector('#afrodita-input'), output: document.querySelector('#afrodita-answer'),
  execute: async (command) => {
    const result = await afrodita.execute(command);
    if (result.intent === 'what_now') renderDashboard(document.querySelector('#priority-list'), result.data);
    else await refreshDashboard();
    return result;
  }
});

const pttButton = document.querySelector('#ptt');
const ptt = new PttController({
  onTranscript: (text) => panel.run(text),
  onState: (state) => { pttButton.dataset.state = state; pttButton.textContent = state === 'listening' ? '🎙 Escuchando… suelta para enviar' : '🎙 Mantén para hablar'; }
});
if (!ptt.supported) { pttButton.textContent = '🎙 Voz no disponible en este navegador'; pttButton.disabled = true; }
else {
  pttButton.addEventListener('pointerdown', () => ptt.start());
  pttButton.addEventListener('pointerup', () => ptt.stop());
  pttButton.addEventListener('pointercancel', () => ptt.stop());
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch((error) => console.warn('BLO offline shell unavailable', error)));
}

app.start().catch((error) => { console.error('BLO startup failed', error); document.documentElement.dataset.bloStatus = 'error'; });

const projectSelect = document.querySelector('#workspace-project');
const taskList = document.querySelector('#workspace-tasks');
const workspaceMessage = document.querySelector('#workspace-message');
async function refreshWorkspace() {
  const [projects, tasks, context] = await Promise.all([
    repositories.projects.list(), repositories.tasks.list(), contextService.context()
  ]);
  projectSelect.replaceChildren(new Option('Selecciona un proyecto', ''));
  for (const project of projects) projectSelect.add(new Option(project.name, project.id));
  projectSelect.value = context.projectId ?? '';
  taskList.replaceChildren();
  if (!context.projectId) {
    taskList.textContent = 'Crea o selecciona un proyecto para gestionar sus tareas.';
    return;
  }
  const visible = tasks.filter(item => item.projectId === context.projectId);
  if (!visible.length) taskList.textContent = 'Este proyecto todavía no tiene tareas.';
  for (const task of visible) {
    const row = document.createElement('div');
    row.className = 'task-row';
    const label = document.createElement('strong');
    label.textContent = task.title + (task.status === 'done' ? ' ✓' : '');
    row.append(label);
    if (task.status !== 'done') {
      const done = document.createElement('button');
      done.type = 'button';
      done.textContent = 'Completar';
      done.addEventListener('click', async () => {
        try { await planning.completeTask(task.id); await refreshWorkspace(); await refreshDashboard(); }
        catch (error) { workspaceMessage.textContent = error.message; }
      });
      row.append(done);
    }
    taskList.append(row);
  }
}
projectSelect.addEventListener('change', async () => {
  if (!projectSelect.value) { await refreshWorkspace(); return; }
  try { await contextService.setActiveProject(projectSelect.value); await refreshWorkspace(); await refreshDashboard(); }
  catch (error) { workspaceMessage.textContent = error.message; }
});
document.querySelector('#project-form').addEventListener('submit', async event => {
  event.preventDefault();
  const name = document.querySelector('#project-name').value.trim();
  if (!name) return;
  try {
    const result = await projectBuilder.provision({ name });
    await contextService.setActiveProject(result.project.id);
    document.querySelector('#project-name').value = '';
    workspaceMessage.textContent = result.reused ? 'Proyecto existente seleccionado.' : 'Proyecto creado.';
    await refreshWorkspace(); await refreshDashboard();
  } catch (error) { workspaceMessage.textContent = error.message; }
});
document.querySelector('#task-form').addEventListener('submit', async event => {
  event.preventDefault();
  const title = document.querySelector('#task-title').value.trim();
  const { projectId } = await contextService.context();
  if (!projectId) { workspaceMessage.textContent = 'Selecciona primero un proyecto.'; return; }
  if (!title) return;
  try {
    await planning.createTask({ title, projectId });
    document.querySelector('#task-title').value = '';
    workspaceMessage.textContent = 'Tarea añadida.';
    await refreshWorkspace(); await refreshDashboard();
  } catch (error) { workspaceMessage.textContent = error.message; }
});
app.context.events.on('project.provisioned', refreshWorkspace);
app.context.events.on('planning.task.created', refreshWorkspace);
app.context.events.on('planning.task.changed', refreshWorkspace);
app.context.events.on('blo:ready', refreshWorkspace);

const dashboardWidgets = [
  { id: 'priorities', title: 'Prioridades' },
  { id: 'status', title: 'Estado' },
  { id: 'afrodita', title: 'Afrodita' }
];
const widgetSettingsKey = 'blo.dashboard.widgets.v1';
function readWidgetSettings() {
  try { return JSON.parse(localStorage.getItem(widgetSettingsKey) || '{}'); }
  catch { return {}; }
}
function renderWidgetControls() {
  const controls = document.querySelector('#widget-controls');
  if (!controls) return;
  controls.replaceChildren();
  const settings = readWidgetSettings();
  for (const widget of dashboardWidgets) {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = settings[widget.id] !== false;
    const section = document.querySelector('[data-widget="' + widget.id + '"]');
    if (section) section.hidden = !checkbox.checked;
    checkbox.addEventListener('change', () => {
      const next = { ...readWidgetSettings(), [widget.id]: checkbox.checked };
      try { localStorage.setItem(widgetSettingsKey, JSON.stringify(next)); }
      catch { document.querySelector('#workspace-message').textContent = 'No se han podido guardar las preferencias.'; }
      if (section) section.hidden = !checkbox.checked;
    });
    label.append(checkbox, document.createTextNode(widget.title));
    controls.append(label);
  }
}
renderWidgetControls();
