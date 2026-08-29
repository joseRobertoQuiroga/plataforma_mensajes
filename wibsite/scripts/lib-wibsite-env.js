// lib-wibsite-env.js — Acceso a credenciales locales sin almacenarlas en git.
// Resolución: variable de entorno → wibsite/.env (no versionado) → undefined.
const fs = require('fs');
const path = require('path');

function wibsiteEnv(key) {
  if (process.env[key]) return process.env[key];
  try {
    const envPath = path.join(__dirname, '..', '.env');
    const content = fs.readFileSync(envPath, 'utf8');
    const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = content.match(new RegExp('^' + safeKey + '=(.*)$', 'm'));
    return match ? match[1].trim() : undefined;
  } catch {
    return undefined;
  }
}

module.exports = { wibsiteEnv };