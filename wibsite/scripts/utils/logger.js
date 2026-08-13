/**
 * logger.js — Sistema de Logging Estructurado para Scripts y Pruebas
 * 
 * Registra logs tanto en consola con código de colores como en archivos persistentes en `scripts/logs/`.
 * Soporta niveles: INFO, WARN, ERROR, DEBUG, SUCCESS.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

const AUDIT_LOG_FILE = path.join(LOGS_DIR, 'audit.log');
const SIMULATION_LOG_FILE = path.join(LOGS_DIR, 'simulation.log');

const COLOR_CODES = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  info: '\x1b[36m',       // Cyan
  success: '\x1b[32m',    // Green
  warn: '\x1b[33m',       // Yellow
  error: '\x1b[31m',      // Red
  debug: '\x1b[90m',      // Gray
  module: '\x1b[35m'      // Magenta
};

function formatTimestamp() {
  return new Date().toISOString();
}

function writeToFile(filePath, level, moduleName, message, metadata = null) {
  const time = formatTimestamp();
  const metaStr = metadata ? ` | Metadata: ${JSON.stringify(metadata)}` : '';
  const logLine = `[${time}] [${level.padEnd(7, ' ')}] [${moduleName}] ${message}${metaStr}\n`;
  try {
    fs.appendFileSync(filePath, logLine, 'utf8');
  } catch (e) {
    // Ignore file write errors
  }
}

class Logger {
  constructor(moduleName = 'System', logFile = AUDIT_LOG_FILE) {
    this.moduleName = moduleName;
    this.logFile = logFile;
  }

  info(msg, meta = null) {
    console.log(`${COLOR_CODES.info}[INFO]${COLOR_CODES.reset} [${COLOR_CODES.module}${this.moduleName}${COLOR_CODES.reset}] ${msg}`);
    writeToFile(this.logFile, 'INFO', this.moduleName, msg, meta);
  }

  success(msg, meta = null) {
    console.log(`${COLOR_CODES.success}[SUCCESS]${COLOR_CODES.reset} [${COLOR_CODES.module}${this.moduleName}${COLOR_CODES.reset}] ${msg}`);
    writeToFile(this.logFile, 'SUCCESS', this.moduleName, msg, meta);
  }

  warn(msg, meta = null) {
    console.log(`${COLOR_CODES.warn}[WARN]${COLOR_CODES.reset} [${COLOR_CODES.module}${this.moduleName}${COLOR_CODES.reset}] ${msg}`);
    writeToFile(this.logFile, 'WARN', this.moduleName, msg, meta);
  }

  error(msg, err = null, meta = null) {
    let errorDetails = msg;
    if (err) {
      const errStr = err.stack || err.message || String(err);
      errorDetails += ` | Cause: ${errStr}`;
    }
    console.error(`${COLOR_CODES.error}[ERROR]${COLOR_CODES.reset} [${COLOR_CODES.module}${this.moduleName}${COLOR_CODES.reset}] ${COLOR_CODES.error}${errorDetails}${COLOR_CODES.reset}`);
    writeToFile(this.logFile, 'ERROR', this.moduleName, errorDetails, meta);
  }

  debug(msg, meta = null) {
    console.log(`${COLOR_CODES.debug}[DEBUG] [${this.moduleName}] ${msg}${COLOR_CODES.reset}`);
    writeToFile(this.logFile, 'DEBUG', this.moduleName, msg, meta);
  }

  header(title) {
    const border = '='.repeat(75);
    console.log(`\n${COLOR_CODES.bold}${COLOR_CODES.info}${border}\n ${title}\n${border}${COLOR_CODES.reset}\n`);
    writeToFile(this.logFile, 'HEADER', this.moduleName, `=== ${title} ===`);
  }
}

module.exports = {
  Logger,
  AUDIT_LOG_FILE,
  SIMULATION_LOG_FILE
};
