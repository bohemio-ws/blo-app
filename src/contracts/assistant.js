export const AssistantIntent = Object.freeze({
  WHAT_NOW: 'what_now',
  SELECT_PROJECT: 'select_project',
  CREATE_PROJECT: 'create_project',
  CREATE_TASK: 'create_task',
  COMPLETE_TASK: 'complete_task',
  BLOCK_TASK: 'block_task',
  RESUME_TASK: 'resume_task',
  SET_TASK_DUE: 'set_task_due',
  SEARCH_COMMUNICATIONS: 'search_communications',
  REGISTER_FLIGHT: 'register_flight',
  REPORT: 'report',
  UNKNOWN: 'unknown'
});

export class AssistantPort {
  async interpret(_input, _context = {}) {
    throw new Error('AssistantPort.interpret must be implemented by an adapter.');
  }
}
