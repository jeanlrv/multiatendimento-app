import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const prisma = new PrismaClient();

// Verifica se o seed deve ser executado
const SEED_ENABLED = process.env.SEED_ON_STARTUP?.toLowerCase() === 'true';

if (!SEED_ENABLED) {
    console.log('ℹ️  Seed desabilitado (SEED_ON_STARTUP=false)');
    prisma.$disconnect();
    process.exit(0);
}

// ─── Permissões atualizadas (alinhadas com o Permission enum do backend) ───────
const ALL_PERMISSIONS = [
    // Tickets
    'tickets:read', 'tickets:read_all', 'tickets:create', 'tickets:update',
    'tickets:delete', 'tickets:assign', 'tickets:resolve',
    // Contatos
    'contacts:read', 'contacts:create', 'contacts:update', 'contacts:delete',
    // Departamentos
    'departments:read', 'departments:create', 'departments:update', 'departments:delete',
    'departments:manage',
    // Usuários
    'users:read', 'users:create', 'users:update', 'users:delete', 'users:manage',
    // Perfis de acesso
    'roles:read', 'roles:create', 'roles:update', 'roles:delete',
    // Configurações
    'settings:read', 'settings:update', 'settings:manage',
    // Conexões WhatsApp
    'connections:read', 'connections:create', 'connections:update', 'connections:delete',
    // Workflows
    'workflows:read', 'workflows:create', 'workflows:update', 'workflows:delete',
    'workflows:manage',
    // IA
    'ai:read', 'ai:manage', 'ai:chat',
    // Relatórios
    'reports:read', 'reports:export',
    // Auditoria
    'audit:read',
    // Avaliações
    'evaluations:read',
    // Agendamentos
    'scheduling:read', 'scheduling:create', 'scheduling:update', 'scheduling:delete',
    // Tags
    'tags:read', 'tags:manage',
];

const SUPERVISOR_PERMISSIONS = [
    'tickets:read', 'tickets:read_all', 'tickets:create', 'tickets:update',
    'tickets:assign', 'tickets:resolve',
    'contacts:read', 'contacts:create', 'contacts:update', 'contacts:delete',
    'departments:read',
    'users:read',
    'roles:read',
    'connections:read',
    'workflows:read',
    'ai:read', 'ai:chat',
    'reports:read',
    'evaluations:read',
    'scheduling:read', 'scheduling:create', 'scheduling:update', 'scheduling:delete',
    'audit:read',
    'tags:read',
];

const ATENDENTE_PERMISSIONS = [
    'tickets:read', 'tickets:create', 'tickets:update', 'tickets:resolve',
    'contacts:read', 'contacts:create', 'contacts:update',
    'scheduling:read', 'scheduling:create', 'scheduling:update',
    'ai:chat',
    'tags:read',
];

const AUDITOR_PERMISSIONS = [
    'tickets:read', 'tickets:read_all',
    'reports:read', 'reports:export',
    'audit:read',
    'evaluations:read',
];

async function main() {
    console.log('🌱 Iniciando seed do banco de dados...');

    // Limpar dados existentes em ordem reversa de dependência
    // Colaboração interna (tabelas novas)
    try { await (prisma as any).internalChatMessage.deleteMany(); } catch { /* tabela pode não existir */ }
    try { await (prisma as any).internalChatMember.deleteMany(); } catch { /* tabela pode não existir */ }
    try { await (prisma as any).internalChat.deleteMany(); } catch { /* tabela pode não existir */ }
    try { await (prisma as any).savedFilter.deleteMany(); } catch { /* tabela pode não existir */ }

    // Workflows
    await prisma.workflowSuspension.deleteMany();
    await prisma.workflowExecution.deleteMany();
    await prisma.workflowActionMetric.deleteMany();
    await prisma.workflowVersion.deleteMany();
    await prisma.workflowRule.deleteMany();
    // Avaliações e tickets
    await prisma.evaluation.deleteMany();
    await prisma.ticketTag.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.scheduleReminder.deleteMany();
    await prisma.schedule.deleteMany();
    await prisma.message.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.contact.deleteMany();
    // Usuários
    await prisma.userDepartment.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    // Infraestrutura
    await prisma.whatsAppInstance.deleteMany();
    await prisma.scheduleConfig.deleteMany();
    await prisma.departmentFlow.deleteMany();
    await prisma.department.deleteMany();
    await prisma.aIAgent.deleteMany();
    await prisma.role.deleteMany();
    await prisma.aIUsage.deleteMany();
    await prisma.quickReply.deleteMany();
    await prisma.featureFlag.deleteMany();
    await prisma.setting.deleteMany();
    await prisma.sMTPConfig.deleteMany();
    await prisma.integration.deleteMany();
    await prisma.company.deleteMany();

    // ============================================
    // COMPANY
    // ============================================

    const mainCompany = await prisma.company.create({
        data: {
            name: 'KSZap Oficial',
        },
    });

    console.log('✅ Empresa criada');

    // ============================================
    // ROLES (Perfis de Acesso)
    // Permissões no formato atual do enum Permission
    // ============================================

    const adminRole = await prisma.role.create({
        data: {
            name: 'Administrador Global',
            description: 'Acesso total ao sistema',
            companyId: mainCompany.id,
            permissions: ALL_PERMISSIONS,
        },
    });

    const supervisorRole = await prisma.role.create({
        data: {
            name: 'Supervisor',
            description: 'Supervisão de equipe e relatórios',
            companyId: mainCompany.id,
            permissions: SUPERVISOR_PERMISSIONS,
        },
    });

    const agentRole = await prisma.role.create({
        data: {
            name: 'Atendente',
            description: 'Atendimento de tickets',
            companyId: mainCompany.id,
            permissions: ATENDENTE_PERMISSIONS,
        },
    });

    const auditorRole = await prisma.role.create({
        data: {
            name: 'Auditor',
            description: 'Auditoria e consulta',
            companyId: mainCompany.id,
            permissions: AUDITOR_PERMISSIONS,
        },
    });

    console.log('✅ Roles criados');

    // ============================================
    // AI AGENTS
    // ============================================

    const defaultAIAgent = await prisma.aIAgent.create({
        data: {
            name: 'Assistente Geral',
            description: 'Agente de IA padrão para análise sentimental',
            anythingllmWorkspaceId: 'default-workspace',
            companyId: mainCompany.id,
            configuration: {
                model: 'gpt-3.5-turbo',
                temperature: 0.7,
            },
        },
    });

    console.log('✅ AI Agents criados');

    // ============================================
    // DEPARTMENTS
    // ============================================

    const supportDept = await prisma.department.create({
        data: {
            name: 'Suporte',
            description: 'Departamento de suporte técnico',
            businessHours: {
                monday: { start: '09:00', end: '18:00' },
                tuesday: { start: '09:00', end: '18:00' },
                wednesday: { start: '09:00', end: '18:00' },
                thursday: { start: '09:00', end: '18:00' },
                friday: { start: '09:00', end: '18:00' },
                saturday: null,
                sunday: null,
            },
            slaFirstResponseMin: 60,
            autoDistribute: true,
            aiAgentId: defaultAIAgent.id,
            companyId: mainCompany.id,
            outOfHoursMessage: 'Nosso horário de atendimento é de segunda a sexta, das 9h às 18h.',
        },
    });

    const salesDept = await prisma.department.create({
        data: {
            name: 'Vendas',
            description: 'Departamento comercial',
            businessHours: {
                monday: { start: '08:00', end: '20:00' },
                tuesday: { start: '08:00', end: '20:00' },
                wednesday: { start: '08:00', end: '20:00' },
                thursday: { start: '08:00', end: '20:00' },
                friday: { start: '08:00', end: '20:00' },
                saturday: { start: '09:00', end: '14:00' },
                sunday: null,
            },
            slaFirstResponseMin: 30,
            autoDistribute: true,
            aiAgentId: defaultAIAgent.id,
            companyId: mainCompany.id,
        },
    });

    console.log('✅ Departamentos criados');

    // ============================================
    // USERS
    // ============================================

    const hashedPassword = await bcrypt.hash('Admin@123', 10);

    const adminUser = await prisma.user.create({
        data: {
            email: 'admin@kszap.com',
            password: hashedPassword,
            name: 'Administrador',
            role: { connect: { id: adminRole.id } },
            departments: {
                create: [
                    { department: { connect: { id: supportDept.id } } }
                ]
            },
            company: { connect: { id: mainCompany.id } },
        },
    });

    const supervisorUser = await prisma.user.create({
        data: {
            email: 'supervisor@kszap.com',
            password: hashedPassword,
            name: 'Supervisor',
            role: { connect: { id: supervisorRole.id } },
            departments: {
                create: [
                    { department: { connect: { id: supportDept.id } } }
                ]
            },
            company: { connect: { id: mainCompany.id } },
        },
    });

    const agentUser = await prisma.user.create({
        data: {
            email: 'atendente@kszap.com',
            password: hashedPassword,
            name: 'Atendente',
            role: { connect: { id: agentRole.id } },
            departments: {
                create: [
                    { department: { connect: { id: supportDept.id } } }
                ]
            },
            company: { connect: { id: mainCompany.id } },
        },
    });

    console.log('✅ Usuários criados');

    // ============================================
    // TAGS
    // ============================================
    await prisma.tag.createMany({
        data: [
            { name: 'Urgente', color: '#EF4444', companyId: mainCompany.id },
            { name: 'Bug', color: '#F59E0B', companyId: mainCompany.id },
            { name: 'Dúvida', color: '#3B82F6', companyId: mainCompany.id },
            { name: 'Sugestão', color: '#10B981', companyId: mainCompany.id },
            { name: 'Reclamação', color: '#8B5CF6', companyId: mainCompany.id },
        ],
    });
    console.log('✅ Tags criadas');

    // ============================================
    // SETTINGS
    // ============================================
    await prisma.setting.createMany({
        data: [
            { key: 'ui.show_contacts', value: true, description: 'Mostrar seção de contatos', companyId: mainCompany.id },
            { key: 'ui.show_tags', value: true, description: 'Mostrar seção de tags', companyId: mainCompany.id },
            { key: 'ui.show_connections', value: true, description: 'Mostrar seção de conexões', companyId: mainCompany.id },
            { key: 'ui.show_deleted_messages', value: false, description: 'Mostrar mensagens deletadas', companyId: mainCompany.id },
            { key: 'ui.show_dashboard', value: true, description: 'Mostrar dashboard', companyId: mainCompany.id },
            { key: 'ui.show_message_notes', value: true, description: 'Mostrar notas das mensagens', companyId: mainCompany.id },
            { key: 'ui.group_media', value: true, description: 'Agrupar mídias', companyId: mainCompany.id },
            { key: 'feature.auto_distribution', value: true, description: 'Distribuição automática de tickets', companyId: mainCompany.id },
            { key: 'feature.customer_wallet', value: true, description: 'Carteira de clientes', companyId: mainCompany.id },
            { key: 'feature.evaluation_required', value: true, description: 'Avaliação obrigatória', companyId: mainCompany.id },
            { key: 'feature.ticket_metrics', value: true, description: 'Métricas de tickets', companyId: mainCompany.id },
            { key: 'feature.groups', value: true, description: 'Habilitar grupos', companyId: mainCompany.id },
            { key: 'feature.group_history', value: true, description: 'Histórico de grupos', companyId: mainCompany.id },
            { key: 'feature.ignore_assigned_connection', value: false, description: 'Ignorar conexão atribuída', companyId: mainCompany.id },
            { key: 'feature.start_group_waiting', value: false, description: 'Iniciar grupo em aguardando', companyId: mainCompany.id },
            { key: 'feature.transfer_group', value: true, description: 'Transferir grupo', companyId: mainCompany.id },
            { key: 'notification.bots', value: false, description: 'Notificações para bots', companyId: mainCompany.id },
            { key: 'notification.groups', value: false, description: 'Notificações para grupos', companyId: mainCompany.id },
            { key: 'security.admin_confirmation', value: true, description: 'Confirmação de ações admin', companyId: mainCompany.id },
            { key: 'security.force_download', value: false, description: 'Forçar download', companyId: mainCompany.id },
            { key: 'security.show_download_confirmation', value: true, description: 'Mostrar confirmação de download', companyId: mainCompany.id },
            { key: 'workflow.sentiment_threshold_score', value: 7, description: 'Score mínimo (0-10) que dispara workflow de alerta', companyId: mainCompany.id },
            { key: 'evaluation.customer_required', value: false, description: 'Se avaliação do cliente é obrigatória', companyId: mainCompany.id },
            { key: 'ai.auto_analysis', value: true, description: 'Se análise sentimental é automática ao fechar ticket', companyId: mainCompany.id },
        ],
    });
    console.log('✅ Settings criados');

    // ============================================
    // SMTP CONFIG (Mock para desenvolvimento)
    // ============================================
    await prisma.sMTPConfig.create({
        data: {
            name: 'Servidor Principal (Mock)',
            host: 'smtp.ethereal.email',
            port: 587,
            user: 'mock_user@ethereal.email',
            password: 'mock_password',
            fromEmail: 'noreply@kszap.com',
            fromName: 'KSZap Alertas',
            isDefault: true,
            isActive: true,
            companyId: mainCompany.id,
        },
    });
    console.log('✅ Configuração SMTP criada');

    // ============================================
    // WHATSAPP INSTANCES (Exemplo)
    // ============================================
    const mainConnection = await prisma.whatsAppInstance.create({
        data: {
            name: 'WhatsApp Principal',
            phoneNumber: '5511999999999',
            zapiInstanceId: 'INST-SAMPLE-001',
            zapiToken: 'TOKEN-SAMPLE-001',
            status: 'CONNECTED',
            companyId: mainCompany.id,
            departmentId: supportDept.id,
        },
    });
    console.log('✅ Conexão WhatsApp criada');

    // ============================================
    // CONTACTS & TICKETS (Exemplo)
    // ============================================
    const contactsData = [
        { name: 'João Silva', phoneNumber: '5511912345678' },
        { name: 'Maria Oliveira', phoneNumber: '5511987654321' },
        { name: 'Pedro Santos', phoneNumber: '5511955554444' },
    ];

    for (const data of contactsData) {
        const contact = await prisma.contact.create({ data: { ...data, companyId: mainCompany.id } });

        const ticket = await prisma.ticket.create({
            data: {
                contactId: contact.id,
                departmentId: supportDept.id,
                connectionId: mainConnection.id,
                companyId: mainCompany.id,
                subject: `Dúvida de ${data.name}`,
                status: data.name === 'João Silva' ? 'OPEN' : data.name === 'Maria Oliveira' ? 'IN_PROGRESS' : 'RESOLVED',
                assignedUserId: data.name === 'Maria Oliveira' ? agentUser.id : null,
            }
        });

        await prisma.message.createMany({
            data: [
                {
                    ticketId: ticket.id,
                    fromMe: false,
                    content: 'Olá, gostaria de saber mais sobre o sistema KSZap.',
                    messageType: 'TEXT',
                    sentAt: new Date(Date.now() - 3600000),
                },
                {
                    ticketId: ticket.id,
                    fromMe: true,
                    content: 'Olá! Sou o assistente virtual. Em que posso ajudar?',
                    messageType: 'TEXT',
                    sentAt: new Date(Date.now() - 3500000),
                }
            ]
        });
    }
    console.log('✅ Contatos e Tickets de exemplo criados');

    // ============================================
    // WORKFLOW RULES
    // ============================================
    await prisma.workflowRule.create({
        data: {
            name: 'Aero Default Flow (V1)',
            description: 'Fluxo completo: Recepção IA, Transferência de Setor e Análise Sentimental após 30min.',
            companyId: mainCompany.id,
            isActive: true,
            priority: 200,
            trigger: { event: 'message.received' },
            actions: [],
            nodes: [
                {
                    id: 'node_start', type: 'trigger', position: { x: 0, y: 100 },
                    data: { event: 'message.received', label: 'Mensagem Recebida' }
                },
                {
                    id: 'node_reception', type: 'ai_intent', position: { x: 250, y: 100 },
                    data: {
                        label: 'Recepção IA', agentId: defaultAIAgent.id,
                        promptTemplate: 'Você é um assistente de recepção. Analise a mensagem: "{{message}}". Identifique o departamento (Suporte, Vendas, Financeiro) e responda JSON: {"intent": "TRANSFERENCIA", "department": "nome-do-departamento", "message": "resposta educada ao cliente"}'
                    }
                },
                {
                    id: 'node_transfer', type: 'action', position: { x: 500, y: 100 },
                    data: { label: 'Transferir Setor', actionType: 'update_ticket', params: { mode: 'HUMANO', departmentId: salesDept.id } }
                },
                {
                    id: 'node_wait_resolve', type: 'wait_for_event', position: { x: 750, y: 100 },
                    data: { label: 'Aguardar Resolução', eventToWait: 'ticket.status_changed', timeoutMs: 0 }
                },
                {
                    id: 'node_delay_feedback', type: 'delay', position: { x: 1000, y: 100 },
                    data: { label: 'Esperar 30min', delayMs: 1800000, delayType: 'fixed' }
                },
                {
                    id: 'node_sentiment', type: 'action', position: { x: 1250, y: 100 },
                    data: { label: 'Análise Sentimental', actionType: 'analyze_sentiment' }
                },
                {
                    id: 'node_end', type: 'end', position: { x: 1500, y: 100 },
                    data: { label: 'Fim' }
                }
            ],
            edges: [
                { id: 'e1', source: 'node_start', target: 'node_reception' },
                { id: 'e2', source: 'node_reception', target: 'node_transfer' },
                { id: 'e3', source: 'node_transfer', target: 'node_wait_resolve' },
                { id: 'e4', source: 'node_wait_resolve', target: 'node_delay_feedback', sourceHandle: 'success' },
                { id: 'e5', source: 'node_delay_feedback', target: 'node_sentiment' },
                { id: 'e6', source: 'node_sentiment', target: 'node_end' }
            ]
        } as any
    });

    await prisma.workflowRule.create({
        data: {
            name: 'Alerta de Sentimento Negativo',
            description: 'Notifica gestores quando score sentimental é baixo',
            companyId: mainCompany.id,
            trigger: {
                event: 'evaluation.created',
                conditions: [{ field: 'aiSentimentScore', operator: 'lt', value: 7 }],
            },
            actions: [
                { type: 'send_email', to: 'supervisors', template: 'low_sentiment_alert' },
                { type: 'update_ticket', priority: 'CRITICAL' },
                { type: 'create_notification', message: 'Ticket com sentimento negativo detectado' },
            ],
        },
    });

    console.log('✅ Workflow rules criados');

    console.log('');
    console.log('🎉 Seed concluído com sucesso!');
    console.log('');
    console.log('📧 Usuários criados: admin@kszap.com | supervisor@kszap.com | atendente@kszap.com');
    console.log('');
}

main()
    .catch((e) => {
        console.error('❌ Erro ao executar seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
