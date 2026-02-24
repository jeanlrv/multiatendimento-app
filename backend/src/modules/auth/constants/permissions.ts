export enum Permission {
    // ─── Tickets ──────────────────────────────────────────────────────────────
    TICKETS_READ = 'tickets:read',           // Ver tickets atribuídos a mim
    TICKETS_READ_ALL = 'tickets:read_all',   // Ver tickets de todos os departamentos
    TICKETS_CREATE = 'tickets:create',
    TICKETS_UPDATE = 'tickets:update',
    TICKETS_DELETE = 'tickets:delete',
    TICKETS_ASSIGN = 'tickets:assign',
    TICKETS_RESOLVE = 'tickets:resolve',

    // ─── Contatos ─────────────────────────────────────────────────────────────
    CONTACTS_READ = 'contacts:read',
    CONTACTS_CREATE = 'contacts:create',
    CONTACTS_UPDATE = 'contacts:update',
    CONTACTS_DELETE = 'contacts:delete',

    // ─── Departamentos ────────────────────────────────────────────────────────
    DEPARTMENTS_READ = 'departments:read',
    DEPARTMENTS_CREATE = 'departments:create',
    DEPARTMENTS_UPDATE = 'departments:update',
    DEPARTMENTS_DELETE = 'departments:delete',
    /** @deprecated alias retrocompatibilidade */
    DEPARTMENTS_MANAGE = 'departments:manage',

    // ─── Usuários ─────────────────────────────────────────────────────────────
    USERS_READ = 'users:read',
    USERS_CREATE = 'users:create',
    USERS_UPDATE = 'users:update',
    USERS_DELETE = 'users:delete',
    /** @deprecated alias retrocompatibilidade */
    USERS_MANAGE = 'users:manage',

    // ─── Perfis de Acesso ─────────────────────────────────────────────────────
    ROLES_READ = 'roles:read',
    ROLES_CREATE = 'roles:create',
    ROLES_UPDATE = 'roles:update',
    ROLES_DELETE = 'roles:delete',

    // ─── Configurações ────────────────────────────────────────────────────────
    SETTINGS_READ = 'settings:read',
    SETTINGS_UPDATE = 'settings:update',
    /** @deprecated alias retrocompatibilidade */
    SETTINGS_MANAGE = 'settings:manage',

    // ─── Conexões WhatsApp ────────────────────────────────────────────────────
    CONNECTIONS_READ = 'connections:read',
    CONNECTIONS_CREATE = 'connections:create',
    CONNECTIONS_UPDATE = 'connections:update',
    CONNECTIONS_DELETE = 'connections:delete',

    // ─── Workflows ────────────────────────────────────────────────────────────
    WORKFLOWS_READ = 'workflows:read',
    WORKFLOWS_CREATE = 'workflows:create',
    WORKFLOWS_UPDATE = 'workflows:update',
    WORKFLOWS_DELETE = 'workflows:delete',
    /** @deprecated alias retrocompatibilidade */
    WORKFLOWS_MANAGE = 'workflows:manage',

    // ─── IA & Agentes ─────────────────────────────────────────────────────────
    AI_READ = 'ai:read',
    AI_MANAGE = 'ai:manage',
    AI_CHAT = 'ai:chat',

    // ─── Relatórios ───────────────────────────────────────────────────────────
    REPORTS_READ = 'reports:read',
    REPORTS_EXPORT = 'reports:export',

    // ─── Auditoria ────────────────────────────────────────────────────────────
    AUDIT_READ = 'audit:read',

    // ─── Avaliações ───────────────────────────────────────────────────────────
    EVALUATIONS_READ = 'evaluations:read',

    // ─── Agendamentos ─────────────────────────────────────────────────────────
    SCHEDULING_READ = 'scheduling:read',
    SCHEDULING_CREATE = 'scheduling:create',
    SCHEDULING_UPDATE = 'scheduling:update',
    SCHEDULING_DELETE = 'scheduling:delete',

    // ─── Tags ─────────────────────────────────────────────────────────────────
    TAGS_READ = 'tags:read',
    TAGS_MANAGE = 'tags:manage',
}

/** Conjunto completo de permissões para o papel ADMIN */
export const ALL_PERMISSIONS = Object.values(Permission);

/** Mapa estático de permissões por nome de role (fallback quando role.permissions[] vazio no JWT) */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
    ATENDENTE: [
        Permission.TICKETS_READ,
        Permission.TICKETS_CREATE,
        Permission.TICKETS_UPDATE,
        Permission.TICKETS_RESOLVE,
        Permission.CONTACTS_READ,
        Permission.CONTACTS_CREATE,
        Permission.CONTACTS_UPDATE,
        Permission.SCHEDULING_READ,
        Permission.SCHEDULING_CREATE,
        Permission.SCHEDULING_UPDATE,
        Permission.AI_CHAT,
        Permission.TAGS_READ,
    ],
    AGENTE: [
        Permission.TICKETS_READ,
        Permission.TICKETS_CREATE,
        Permission.TICKETS_UPDATE,
        Permission.TICKETS_RESOLVE,
        Permission.CONTACTS_READ,
        Permission.CONTACTS_CREATE,
        Permission.CONTACTS_UPDATE,
        Permission.AI_CHAT,
        Permission.TAGS_READ,
    ],
    SUPERVISOR: [
        Permission.TICKETS_READ,
        Permission.TICKETS_READ_ALL,
        Permission.TICKETS_CREATE,
        Permission.TICKETS_UPDATE,
        Permission.TICKETS_ASSIGN,
        Permission.TICKETS_RESOLVE,
        Permission.CONTACTS_READ,
        Permission.CONTACTS_CREATE,
        Permission.CONTACTS_UPDATE,
        Permission.CONTACTS_DELETE,
        Permission.DEPARTMENTS_READ,
        Permission.USERS_READ,
        Permission.ROLES_READ,
        Permission.CONNECTIONS_READ,
        Permission.WORKFLOWS_READ,
        Permission.AI_READ,
        Permission.AI_CHAT,
        Permission.REPORTS_READ,
        Permission.EVALUATIONS_READ,
        Permission.SCHEDULING_READ,
        Permission.SCHEDULING_CREATE,
        Permission.SCHEDULING_UPDATE,
        Permission.SCHEDULING_DELETE,
        Permission.AUDIT_READ,
        Permission.TAGS_READ,
    ],
    ADMIN: ALL_PERMISSIONS,
    ADMINISTRADOR: ALL_PERMISSIONS,
    'ADMINISTRADOR GLOBAL': ALL_PERMISSIONS,
};
