const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const https = require('https');

async function main() {
    try {
        const agent = await prisma.aIAgent.findFirst({
            where: { name: 'SUPORTE SISTEMA - KSAGRO' }
        });

        if (!agent) {
            console.log('Agente não encontrado.');
            return;
        }

        const apiKeyRecord = await prisma.apiKey.findFirst({
            where: { companyId: agent.companyId, isActive: true }
        });

        if (!apiKeyRecord) {
            console.log('API Key não encontrada.');
            return;
        }

        const payload = JSON.stringify({
            message: 'onde lanço uma NF de insumos?',
            history: []
        });

        const options = {
            hostname: 'motivated-endurance-production-98ca.up.railway.app',
            port: 443,
            path: `/api/ai/agents/${agent.id}/chat-public`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKeyRecord.key}`,
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        console.log('Disparando para:', options.hostname + options.path);

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('Status HTTP:', res.statusCode);
                console.log('Resposta da IA:', data);
            });
        });

        req.on('error', (e) => console.error('Request error:', e));
        req.write(payload);
        req.end();

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
