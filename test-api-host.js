const http = require('http');

const data = JSON.stringify({
    email: 'admin@whatsapp-saas.com',
    password: 'Admin@123'
});

const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

console.log('Enviando requisição de login para localhost:3002...');

const req = http.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (error) => {
    console.error('❌ Erro na requisição:', error.message);
});

req.write(data);
req.end();
