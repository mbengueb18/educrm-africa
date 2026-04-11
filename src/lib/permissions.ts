// ─── Role-based permissions ───

export type Role = "SUPER_ADMIN" | "ADMIN" | "COMMERCIAL" | "TEACHER" | "ACCOUNTANT" | "VIEWER";

export type Permission =
  // Pipeline / Leads
  | "leads:view" | "leads:create" | "leads:edit" | "leads:delete" | "leads:assign"
  | "leads:import" | "leads:export" | "leads:convert"
  // Tasks
  | "tasks:view" | "tasks:create" | "tasks:edit" | "tasks:delete"
  // Calls
  | "calls:view" | "calls:create" | "calls:edit" | "calls:delete"
  // Appointments
  | "appointments:view" | "appointments:create" | "appointments:edit" | "appointments:delete"
  // Students
  | "students:view" | "students:edit" | "students:delete"
  // Payments
  | "payments:view" | "payments:create" | "payments:edit"
  // Campaigns
  | "campaigns:view" | "campaigns:create" | "campaigns:send"
  // Analytics
  | "analytics:view" | "analytics:export"
  // Settings
  | "settings:view" | "settings:edit"
  // Users
  | "users:view" | "users:create" | "users:edit" | "users:delete";

// Scope: "all" = see everything, "own" = only own data
export type Scope = "all" | "own" | "none";

type PermissionConfig = {
  allowed: boolean;
  scope?: Scope;
};

var ROLE_PERMISSIONS: Record<Role, Record<Permission, PermissionConfig>> = {
  SUPER_ADMIN: makeAll(true, "all"),
  ADMIN: makeAll(true, "all"),

  COMMERCIAL: {
    // Leads
    "leads:view": { allowed: true, scope: "own" },
    "leads:create": { allowed: true },
    "leads:edit": { allowed: true, scope: "own" },
    "leads:delete": { allowed: false },
    "leads:assign": { allowed: false },
    "leads:import": { allowed: false },
    "leads:export": { allowed: true, scope: "own" },
    "leads:convert": { allowed: true, scope: "own" },
    // Tasks
    "tasks:view": { allowed: true, scope: "own" },
    "tasks:create": { allowed: true },
    "tasks:edit": { allowed: true, scope: "own" },
    "tasks:delete": { allowed: true, scope: "own" },
    // Calls
    "calls:view": { allowed: true, scope: "own" },
    "calls:create": { allowed: true },
    "calls:edit": { allowed: true, scope: "own" },
    "calls:delete": { allowed: true, scope: "own" },
    // Appointments
    "appointments:view": { allowed: true, scope: "own" },
    "appointments:create": { allowed: true },
    "appointments:edit": { allowed: true, scope: "own" },
    "appointments:delete": { allowed: true, scope: "own" },
    // Students
    "students:view": { allowed: false },
    "students:edit": { allowed: false },
    "students:delete": { allowed: false },
    // Payments
    "payments:view": { allowed: false },
    "payments:create": { allowed: false },
    "payments:edit": { allowed: false },
    // Campaigns
    "campaigns:view": { allowed: true },
    "campaigns:create": { allowed: true },
    "campaigns:send": { allowed: true },
    // Analytics
    "analytics:view": { allowed: true, scope: "own" },
    "analytics:export": { allowed: false },
    // Settings
    "settings:view": { allowed: false },
    "settings:edit": { allowed: false },
    // Users
    "users:view": { allowed: false },
    "users:create": { allowed: false },
    "users:edit": { allowed: false },
    "users:delete": { allowed: false },
  },

  ACCOUNTANT: {
    // Leads
    "leads:view": { allowed: false },
    "leads:create": { allowed: false },
    "leads:edit": { allowed: false },
    "leads:delete": { allowed: false },
    "leads:assign": { allowed: false },
    "leads:import": { allowed: false },
    "leads:export": { allowed: false },
    "leads:convert": { allowed: false },
    // Tasks
    "tasks:view": { allowed: true, scope: "own" },
    "tasks:create": { allowed: true },
    "tasks:edit": { allowed: true, scope: "own" },
    "tasks:delete": { allowed: true, scope: "own" },
    // Calls
    "calls:view": { allowed: false },
    "calls:create": { allowed: false },
    "calls:edit": { allowed: false },
    "calls:delete": { allowed: false },
    // Appointments
    "appointments:view": { allowed: true, scope: "own" },
    "appointments:create": { allowed: true },
    "appointments:edit": { allowed: true, scope: "own" },
    "appointments:delete": { allowed: true, scope: "own" },
    // Students
    "students:view": { allowed: true },
    "students:edit": { allowed: false },
    "students:delete": { allowed: false },
    // Payments
    "payments:view": { allowed: true },
    "payments:create": { allowed: true },
    "payments:edit": { allowed: true },
    // Campaigns
    "campaigns:view": { allowed: false },
    "campaigns:create": { allowed: false },
    "campaigns:send": { allowed: false },
    // Analytics
    "analytics:view": { allowed: true, scope: "own" },
    "analytics:export": { allowed: true },
    // Settings
    "settings:view": { allowed: false },
    "settings:edit": { allowed: false },
    // Users
    "users:view": { allowed: false },
    "users:create": { allowed: false },
    "users:edit": { allowed: false },
    "users:delete": { allowed: false },
  },

  TEACHER: {
    // Leads
    "leads:view": { allowed: false },
    "leads:create": { allowed: false },
    "leads:edit": { allowed: false },
    "leads:delete": { allowed: false },
    "leads:assign": { allowed: false },
    "leads:import": { allowed: false },
    "leads:export": { allowed: false },
    "leads:convert": { allowed: false },
    // Tasks
    "tasks:view": { allowed: true, scope: "own" },
    "tasks:create": { allowed: true },
    "tasks:edit": { allowed: true, scope: "own" },
    "tasks:delete": { allowed: true, scope: "own" },
    // Calls
    "calls:view": { allowed: false },
    "calls:create": { allowed: false },
    "calls:edit": { allowed: false },
    "calls:delete": { allowed: false },
    // Appointments
    "appointments:view": { allowed: true, scope: "own" },
    "appointments:create": { allowed: true },
    "appointments:edit": { allowed: true, scope: "own" },
    "appointments:delete": { allowed: true, scope: "own" },
    // Students
    "students:view": { allowed: true },
    "students:edit": { allowed: false },
    "students:delete": { allowed: false },
    // Payments
    "payments:view": { allowed: false },
    "payments:create": { allowed: false },
    "payments:edit": { allowed: false },
    // Campaigns
    "campaigns:view": { allowed: false },
    "campaigns:create": { allowed: false },
    "campaigns:send": { allowed: false },
    // Analytics
    "analytics:view": { allowed: false },
    "analytics:export": { allowed: false },
    // Settings
    "settings:view": { allowed: false },
    "settings:edit": { allowed: false },
    // Users
    "users:view": { allowed: false },
    "users:create": { allowed: false },
    "users:edit": { allowed: false },
    "users:delete": { allowed: false },
  },

  VIEWER: {
    // Leads
    "leads:view": { allowed: true, scope: "all" },
    "leads:create": { allowed: false },
    "leads:edit": { allowed: false },
    "leads:delete": { allowed: false },
    "leads:assign": { allowed: false },
    "leads:import": { allowed: false },
    "leads:export": { allowed: false },
    "leads:convert": { allowed: false },
    // Tasks
    "tasks:view": { allowed: true, scope: "all" },
    "tasks:create": { allowed: false },
    "tasks:edit": { allowed: false },
    "tasks:delete": { allowed: false },
    // Calls
    "calls:view": { allowed: true, scope: "all" },
    "calls:create": { allowed: false },
    "calls:edit": { allowed: false },
    "calls:delete": { allowed: false },
    // Appointments
    "appointments:view": { allowed: true, scope: "all" },
    "appointments:create": { allowed: false },
    "appointments:edit": { allowed: false },
    "appointments:delete": { allowed: false },
    // Students
    "students:view": { allowed: true },
    "students:edit": { allowed: false },
    "students:delete": { allowed: false },
    // Payments
    "payments:view": { allowed: true },
    "payments:create": { allowed: false },
    "payments:edit": { allowed: false },
    // Campaigns
    "campaigns:view": { allowed: true },
    "campaigns:create": { allowed: false },
    "campaigns:send": { allowed: false },
    // Analytics
    "analytics:view": { allowed: true, scope: "all" },
    "analytics:export": { allowed: false },
    // Settings
    "settings:view": { allowed: false },
    "settings:edit": { allowed: false },
    // Users
    "users:view": { allowed: false },
    "users:create": { allowed: false },
    "users:edit": { allowed: false },
    "users:delete": { allowed: false },
  },
};

// ─── Helper to generate all permissions as true ───
function makeAll(allowed: boolean, scope: Scope): Record<Permission, PermissionConfig> {
  var permissions: any = {};
  var allPerms: Permission[] = [
    "leads:view", "leads:create", "leads:edit", "leads:delete", "leads:assign",
    "leads:import", "leads:export", "leads:convert",
    "tasks:view", "tasks:create", "tasks:edit", "tasks:delete",
    "calls:view", "calls:create", "calls:edit", "calls:delete",
    "appointments:view", "appointments:create", "appointments:edit", "appointments:delete",
    "students:view", "students:edit", "students:delete",
    "payments:view", "payments:create", "payments:edit",
    "campaigns:view", "campaigns:create", "campaigns:send",
    "analytics:view", "analytics:export",
    "settings:view", "settings:edit",
    "users:view", "users:create", "users:edit", "users:delete",
  ];
  allPerms.forEach(function(p) { permissions[p] = { allowed, scope }; });
  return permissions;
}

// ─── Check if role has permission ───
export function hasPermission(role: string, permission: Permission): boolean {
  var rolePerms = ROLE_PERMISSIONS[role as Role];
  if (!rolePerms) return false;
  var config = rolePerms[permission];
  return config?.allowed || false;
}

// ─── Get scope for permission ───
export function getScope(role: string, permission: Permission): Scope {
  var rolePerms = ROLE_PERMISSIONS[role as Role];
  if (!rolePerms) return "none";
  var config = rolePerms[permission];
  if (!config?.allowed) return "none";
  return config.scope || "all";
}

// ─── Check if role can access a nav item ───
export type NavItem = {
  label: string;
  href: string;
  permission: Permission;
};

export function getVisibleNavItems(role: string, items: NavItem[]): NavItem[] {
  return items.filter(function(item) {
    return hasPermission(role, item.permission);
  });
}

// ─── Require permission in server action (throws if denied) ───
export function requirePermission(role: string, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error("Accès refusé : vous n'avez pas la permission requise");
  }
}