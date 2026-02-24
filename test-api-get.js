const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/api',
    method: 'GET'
};

console.log('Enviando requisição GET para localhost:3002/api...');

const req = http.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (error) => {
    console.error('❌ Erro na requisição:', error.message);
});

req.end();
