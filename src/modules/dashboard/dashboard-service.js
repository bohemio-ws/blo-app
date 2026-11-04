export class DashboardService {
  constructor({ repositories, priorityEngine }) {
    if (!repositories || !priorityEngine) throw new TypeError('Dashboard requires repositories and priority engine.');
    this.repositories = repositories;
    this.priorityEngine = priorityEngine;
  }

  async snapshot({ now = new Date(), limit = 7, projectId = null } = {}) {
    const [allProjects, allObjectives, allMilestones, allTasks] = await Promise.all([
      this.repositories.projects.list(),
      this.repositories.objectives.list(),
      this.repositories.milestones.list(),
      this.repositories.tasks.list()
    ]);
    const projects = projectId ? allProjects.filter(item => item.id === projectId) : allProjects;
    const objectives = projectId ? allObjectives.filter(item => item.projectId === projectId) : allObjectives;
    const milestones = projectId ? allMilestones.filter(item => item.projectId === projectId) : allMilestones;
    const tasks = projectId ? allTasks.filter(item => item.projectId === projectId) : allTasks;
    const activeTasks = tasks.filter(task => !['done', 'cancelled'].includes(task.status));
    const priorities = this.priorityEngine.rank(activeTasks, { now }).slice(0, limit);
    const blocked = activeTasks.filter(task => task.status === 'blocked');
    const overdue = activeTasks.filter(task => task.dueAt && new Date(task.dueAt) < now);

    return Object.freeze({
      generatedAt: now.toISOString(), projectId,
      projectName: projectId ? (projects[0]?.name ?? null) : null,
      counts: { projects: projects.length, objectives: objectives.length, milestones: milestones.length, activeTasks: activeTasks.length },
      nextAction: priorities[0] ?? null,
      priorities,
      alerts: { blocked, overdue }
    });
  }
}
