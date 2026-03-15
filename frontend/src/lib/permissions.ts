export interface PermissionItem {
    key: string;
    label: string;
    desc: string;
}

export interface PermissionGroup {
    group: string;
    icon: string;
    items: PermissionItem[];
}

/** Grupos de permissões para a UI de gerenciamento de perfis */
export const PERMISSION_GROUPS: PermissionGroup[] = [
    {
        group: 'Tickets',
        icon: '🎫',
        items: [
            { key: 'tickets:read',       label: 'Visualizar',      desc: 'Ver tickets atribuídos a mim' },
            { key: 'tickets:read_all',   label: 'Visualizar Todos', desc: 'Ver todos os tickets da empresa' },
            { key: 'tickets:create',     label: 'Criar',           desc: 'Abrir novos tickets' },
            { key: 'tickets:update',     label: 'Editar',          desc: 'Modificar dados dos tickets' },
            { key: 'tickets:delete',     label: 'Excluir',         desc: 'Remover tickets do sistema' },
            { key: 'tickets:assign',     label: 'Atribuir',        desc: 'Designar tickets a outros agentes' },
            { key: 'tickets:resolve',    label: 'Resolver',        desc: 'Fechar tickets como resolvidos' },
        ],
    },
    {
        group: 'Contatos',
        icon: '👤',
        items: [
            { key: 'contacts:read',   label: 'Visualizar', desc: 'Ver lista de contatos' },
            { key: 'contacts:create', label: 'Criar',      desc: 'Adicionar novos contatos' },
            { key: 'contacts:update', label: 'Editar',     desc: 'Modificar dados de contatos' },
            { key: 'contacts:delete', label: 'Excluir',    desc: 'Remover contatos' },
        ],
    },
    {
        group: 'Clientes',
        icon: '🤝',
        items: [
            { key: 'customers:read',   label: 'Visualizar', desc: 'Ver lista de clientes e detalhes do mini-CRM' },
            { key: 'customers:create', label: 'Criar',      desc: 'Cadastrar novos clientes' },
            { key: 'customers:update', label: 'Editar',     desc: 'Editar dados, notas, tags e campos customizados de clientes' },
            { key: 'customers:delete', label: 'Excluir',    desc: 'Remover clientes do sistema e mesclar duplicatas' },
        ],
    },
    {
        group: 'Departamentos',
        icon: '🏢',
        items: [
            { key: 'departments:read',   label: 'Visualizar', desc: 'Ver departamentos' },
            { key: 'departments:create', label: 'Criar',      desc: 'Criar departamentos' },
            { key: 'departments:update', label: 'Editar',     desc: 'Editar departamentos' },
            { key: 'departments:delete', label: 'Excluir',    desc: 'Excluir departamentos' },
            { key: 'departments:manage', label: 'Gerenciar (legado)', desc: 'Alias de retrocompatibilidade' },
        ],
    },
    {
        group: 'Usuários',
        icon: '👥',
        items: [
            { key: 'users:read',   label: 'Visualizar', desc: 'Ver equipe de trabalho' },
            { key: 'users:create', label: 'Recrutar',   desc: 'Criar novos usuários' },
            { key: 'users:update', label: 'Editar',     desc: 'Modificar dados de usuários' },
            { key: 'users:delete', label: 'Remover',    desc: 'Excluir usuários' },
            { key: 'users:manage', label: 'Gerenciar (legado)', desc: 'Alias de retrocompatibilidade' },
        ],
    },
    {
        group: 'Perfis de Acesso',
        icon: '🛡️',
        items: [
            { key: 'roles:read',   label: 'Visualizar', desc: 'Ver perfis de acesso' },
            { key: 'roles:create', label: 'Criar',      desc: 'Criar perfis de acesso' },
            { key: 'roles:update', label: 'Editar',     desc: 'Editar permissões dos perfis' },
            { key: 'roles:delete', label: 'Excluir',    desc: 'Excluir perfis de acesso' },
        ],
    },
    {
        group: 'Configurações',
        icon: '⚙️',
        items: [
            { key: 'settings:read',   label: 'Visualizar', desc: 'Ver configurações do sistema' },
            { key: 'settings:update', label: 'Editar',     desc: 'Alterar configurações' },
            { key: 'settings:manage', label: 'Gerenciar (legado)', desc: 'Alias de retrocompatibilidade' },
        ],
    },
    {
        group: 'Conexões WhatsApp',
        icon: '💬',
        items: [
            { key: 'connections:read',   label: 'Visualizar', desc: 'Ver conexões WhatsApp' },
            { key: 'connections:create', label: 'Criar',      desc: 'Adicionar novas conexões' },
            { key: 'connections:update', label: 'Editar',     desc: 'Modificar conexões' },
            { key: 'connections:delete', label: 'Excluir',    desc: 'Remover conexões' },
        ],
    },
    {
        group: 'Workflows & Automações',
        icon: '⚡',
        items: [
            { key: 'workflows:read',    label: 'Visualizar', desc: 'Ver automações' },
            { key: 'workflows:create',  label: 'Criar',      desc: 'Criar automações' },
            { key: 'workflows:update',  label: 'Editar',     desc: 'Editar automações' },
            { key: 'workflows:delete',  label: 'Excluir',    desc: 'Remover automações' },
            { key: 'workflows:manage',  label: 'Gerenciar (legado)', desc: 'Alias de retrocompatibilidade' },
        ],
    },
    {
        group: 'IA & Agentes',
        icon: '🤖',
        items: [
            { key: 'ai:read',    label: 'Visualizar',    desc: 'Ver agentes de IA' },
            { key: 'ai:manage',  label: 'Gerenciar',     desc: 'Configurar agentes de IA' },
            { key: 'ai:chat',    label: 'Usar no Chat',  desc: 'Utilizar IA durante atendimento' },
        ],
    },
    {
        group: 'Relatórios',
        icon: '📈',
        items: [
            { key: 'reports:read',   label: 'Visualizar', desc: 'Ver relatórios e analytics' },
            { key: 'reports:export', label: 'Exportar',   desc: 'Exportar dados em PDF/Excel' },
        ],
    },
    {
        group: 'Auditoria',
        icon: '📋',
        items: [
            { key: 'audit:read', label: 'Visualizar', desc: 'Ver logs de auditoria do sistema' },
        ],
    },
    {
        group: 'Avaliações',
        icon: '⭐',
        items: [
            { key: 'evaluations:read', label: 'Visualizar', desc: 'Ver avaliações de atendimento' },
        ],
    },
    {
        group: 'Agendamentos',
        icon: '📅',
        items: [
            { key: 'scheduling:read',   label: 'Visualizar', desc: 'Ver agenda' },
            { key: 'scheduling:create', label: 'Criar',      desc: 'Criar agendamentos' },
            { key: 'scheduling:update', label: 'Editar',     desc: 'Editar agendamentos' },
            { key: 'scheduling:delete', label: 'Excluir',    desc: 'Cancelar agendamentos' },
        ],
    },
    {
        group: 'Tags',
        icon: '🏷️',
        items: [
            { key: 'tags:read',   label: 'Visualizar', desc: 'Ver etiquetas' },
            { key: 'tags:manage', label: 'Gerenciar',  desc: 'Criar, editar e excluir tags' },
        ],
    },
];

/** Todas as chaves de permissão disponíveis no sistema */
export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap(g => g.items.map(i => i.key));

/**
 * Verifica se o usuário tem uma permissão específica.
 * Também retorna true para usuários ADMIN (independente do array permissions).
 */
export const hasPermission = (
    user: { permissions?: string[]; role?: string } | null | undefined,
    permission: string,
): boolean => {
    if (!user) return false;
    const role = (user.role ?? '').toUpperCase();
    if (role.includes('ADMIN') || role.includes('ADMINISTRADOR')) return true;
    return user.permissions?.includes(permission) ?? false;
};

/** Retorna true se o usuário for admin */
export const isAdmin = (user: { role?: string } | null | undefined): boolean => {
    if (!user?.role) return false;
    const r = user.role.toUpperCase();
    return r.includes('ADMIN') || r.includes('ADMINISTRADOR');
};
