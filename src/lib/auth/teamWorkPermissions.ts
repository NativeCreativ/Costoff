/**
 * Task Log and To-Do List permissions. Prisma-free so the UI can use the same predicates.
 *
 * Task Log  — everyone records their own tasks. Only Super Admin (Delivery Head) sees and
 *             manages everyone's (filter by person); others see and edit their own only.
 * To-Do     — Super Admin, Account Managers and SPOCs write items and publish them. A published
 *             item is visible to everyone while active; a draft only to its author. Only the
 *             author (or Super Admin) edits, publishes, completes or deletes it.
 */

interface Actor {
  role?: string | null;
  id?: string | null;
}

export const TODO_AUTHOR_ROLES = ['super_admin', 'account_manager', 'spoc'];

export function canViewAllTaskLogs(role?: string | null): boolean {
  return role === 'super_admin';
}

export function canManageTaskLog(actor: Actor, row: { user_id: string }): boolean {
  if (!actor.id) return false;
  return canViewAllTaskLogs(actor.role) || row.user_id === actor.id;
}

export function canCreateTodo(role?: string | null): boolean {
  return !!role && TODO_AUTHOR_ROLES.includes(role);
}

export function canManageTodo(actor: Actor, row: { created_by: string }): boolean {
  if (!actor.id || !actor.role) return false;
  if (actor.role === 'super_admin') return true;
  return canCreateTodo(actor.role) && row.created_by === actor.id;
}

/** Whether this actor may see the item at all: published, or their own draft (or Super Admin). */
export function canSeeTodo(actor: Actor, row: { created_by: string; is_published: boolean }): boolean {
  return row.is_published || canManageTodo(actor, row);
}
