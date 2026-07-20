const bcrypt = require('/usr/local/lib/node_modules/n8n/node_modules/.pnpm/bcryptjs@2.4.3/node_modules/bcryptjs');
const hash = bcrypt.hashSync('Admin@123', 10);
console.log('New hash:', hash);
