'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SECRETS_DIR = path.join(__dirname, '..', 'data', 'secrets');
if (!fs.existsSync(SECRETS_DIR)) fs.mkdirSync(SECRETS_DIR, { recursive: true });

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

class SecretManager {
  constructor(masterKey = null) {
    this.masterKey = masterKey || process.env.MASTER_SECRET_KEY || this._generateKey();
    this._cache = new Map();
  }

  encrypt(plaintext) {
    const key = crypto.scryptSync(this.masterKey, 'wibsite-salt', KEY_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return {
      iv: iv.toString('hex'),
      encrypted,
      tag: tag.toString('hex'),
      algorithm: ALGORITHM,
      created_at: new Date().toISOString(),
    };
  }

  decrypt(encryptedData) {
    const key = crypto.scryptSync(this.masterKey, 'wibsite-salt', KEY_LENGTH);
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const tag = Buffer.from(encryptedData.tag, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  storeSecret(name, value) {
    const encrypted = this.encrypt(value);
    const file = path.join(SECRETS_DIR, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify(encrypted, null, 2));
    this._cache.set(name, value);
    return { name, stored: true, created_at: encrypted.created_at };
  }

  getSecret(name) {
    if (this._cache.has(name)) return this._cache.get(name);
    const file = path.join(SECRETS_DIR, `${name}.json`);
    if (!fs.existsSync(file)) return null;
    const encrypted = JSON.parse(fs.readFileSync(file, 'utf8'));
    const decrypted = this.decrypt(encrypted);
    this._cache.set(name, decrypted);
    return decrypted;
  }

  deleteSecret(name) {
    const file = path.join(SECRETS_DIR, `${name}.json`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    this._cache.delete(name);
    return true;
  }

  listSecrets() {
    if (!fs.existsSync(SECRETS_DIR)) return [];
    return fs.readdirSync(SECRETS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => ({ name: f.replace('.json', ''), created_at: new Date().toISOString() }));
  }

  validateKeyStrength(key) {
    const issues = [];
    if (!key || key.length < 16) issues.push('Key too short (min 16 chars)');
    if (!/[A-Z]/.test(key)) issues.push('Missing uppercase letters');
    if (!/[a-z]/.test(key)) issues.push('Missing lowercase letters');
    if (!/[0-9]/.test(key)) issues.push('Missing numbers');
    if (!/[^A-Za-z0-9]/.test(key)) issues.push('Missing special characters');
    return { valid: issues.length === 0, issues, score: Math.max(0, 100 - issues.length * 25) };
  }

  rotateSecret(name) {
    const oldValue = this.getSecret(name);
    if (!oldValue) return null;
    const newValue = this._generateKey();
    this.storeSecret(name, newValue);
    return { name, rotated: true, old_preview: oldValue.substring(0, 4) + '***' };
  }

  _generateKey() {
    return crypto.randomBytes(KEY_LENGTH).toString('hex');
  }
}

function secretMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const apiKey = req.headers['x-api-key'] || '';
  const helperApiKey = process.env.HELPER_API_KEY || '';

  if (helperApiKey) {
    if (authHeader === `Bearer ${helperApiKey}` || apiKey === helperApiKey) {
      req.authenticated = true;
      req.auth_method = 'api_key';
      return next();
    }
  }

  if (req.path.startsWith('/api/health') || req.path.startsWith('/api/seed')) {
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized', message: 'Valid API key required' });
}

module.exports = { SecretManager, secretMiddleware };
