// ====================================
// MAIN SERVER FILE
// ====================================
const app = require('./src/app');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════╗
    ║   HOSPITAL CLINIC BACKEND SERVER          ║
    ╠═══════════════════════════════════════════╣
    ║   Status  : Running                       ║
    ║   Port    : ${PORT}                           ║
    ║   Mode    : ${process.env.NODE_ENV || 'development'}                  ║
    ║   Health  : http://localhost:${PORT}/api/health ║
    ╚═══════════════════════════════════════════╝
    `);
});
