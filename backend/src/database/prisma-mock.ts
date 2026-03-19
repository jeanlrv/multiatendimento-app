/**
 * Utilitário Centralizado de Mocks para o PrismaService.
 * Evita erros de "is not a function" ao garantir que todos os métodos
 * básicos de CRUD existam como mocks do Jest por padrão.
 */
export const createPrismaMock = () => {
    const mockModel = {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
        upsert: jest.fn(),
        updateMany: jest.fn(),
    };

    return {
        user: { ...mockModel },
        refreshToken: { ...mockModel },
        ticket: { ...mockModel },
        message: { ...mockModel },
        whatsAppInstance: { ...mockModel },
        integration: { ...mockModel },
        contact: { ...mockModel },
        department: { ...mockModel },
        company: { ...mockModel },
        role: { ...mockModel },
        workflow: { ...mockModel },
        workflowNode: { ...mockModel },
        workflowEdge: { ...mockModel },
        workflowActionMetric: { ...mockModel },
        $transaction: jest.fn((cb) => cb(this)),
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        $executeRaw: jest.fn(),
        $queryRaw: jest.fn(),
    };
};
