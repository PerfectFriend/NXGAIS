/**
 * NeXXUs Protocol - Production Structured Logger
 * 
 * Provides unified, colorized console logging and persistent append-only file logging
 * for Linux Daemons and P2P Nodes.
 */

import fs from 'fs';
import path from 'path';

export type LogLevel = 'DEBUG' | 'INFO' | 'P2P' | 'POR' | 'REED_SOLOMON' | 'HEAL' | 'WARN' | 'ERROR';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  tag: string;
  message: string;
  metadata?: Record<string, any>;
  error?: string;
}

class NexxusLogger {
  private logFilePath: string | null = null;
  private minLevel: LogLevel = 'DEBUG';
  private isNodeEnv: boolean = typeof process !== 'undefined' && Boolean(process.versions?.node);

  private readonly levelWeights: Record<LogLevel, number> = {
    DEBUG: 10,
    INFO: 20,
    P2P: 25,
    POR: 25,
    REED_SOLOMON: 25,
    HEAL: 25,
    WARN: 30,
    ERROR: 40,
  };

  private readonly colorCodes: Record<LogLevel, string> = {
    DEBUG: '\x1b[90m',       // Gray
    INFO: '\x1b[36m',        // Cyan
    P2P: '\x1b[35m',         // Magenta
    POR: '\x1b[33m',         // Yellow
    REED_SOLOMON: '\x1b[34m', // Blue
    HEAL: '\x1b[32m',        // Green
    WARN: '\x1b[33;1m',      // Bright Yellow
    ERROR: '\x1b[31;1m',     // Bright Red
  };

  private readonly resetCode = '\x1b[0m';

  public setLogFile(filePath: string) {
    this.logFilePath = filePath;
    if (this.isNodeEnv) {
      try {
        const dir = path.dirname(filePath);
        fs.mkdirSync(dir, { recursive: true });
        const initBanner = `\n--- NeXXUs Logger Initialized at ${new Date().toISOString()} ---\n`;
        fs.appendFileSync(filePath, initBanner, 'utf8');
      } catch (err: any) {
        console.error(`[LOGGER WARNING] Failed to initialize log file ${filePath}:`, err.message);
      }
    }
  }

  public setMinLevel(level: LogLevel) {
    this.minLevel = level;
  }

  public log(level: LogLevel, tag: string, message: string, metadata?: Record<string, any>, err?: any) {
    if (this.levelWeights[level] < this.levelWeights[this.minLevel]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const errorStr = err ? (err.stack || err.message || String(err)) : undefined;

    const entry: LogEntry = {
      timestamp,
      level,
      tag: tag.toUpperCase(),
      message,
      metadata,
      error: errorStr,
    };

    // 1. Console Output
    const color = this.colorCodes[level] || '';
    const reset = this.resetCode;
    const metaStr = metadata && Object.keys(metadata).length > 0 ? ` ${JSON.stringify(metadata)}` : '';
    const formattedConsole = `${timestamp} ${color}[${level}]${reset} \x1b[1m[${entry.tag}]\x1b[0m ${message}${metaStr}`;

    if (level === 'ERROR') {
      console.error(formattedConsole);
      if (errorStr) console.error(`\x1b[31m${errorStr}\x1b[0m`);
    } else if (level === 'WARN') {
      console.warn(formattedConsole);
    } else {
      console.log(formattedConsole);
    }

    // 2. Persistent File Output
    if (this.isNodeEnv && this.logFilePath) {
      try {
        const fileLine = JSON.stringify(entry) + '\n';
        fs.appendFileSync(this.logFilePath, fileLine, 'utf8');
      } catch (writeErr: any) {
        // avoid recursive crash
        console.error(`[LOGGER FILE WRITE ERROR] ${writeErr.message}`);
      }
    }
  }

  public debug(tag: string, message: string, metadata?: Record<string, any>) {
    this.log('DEBUG', tag, message, metadata);
  }

  public info(tag: string, message: string, metadata?: Record<string, any>) {
    this.log('INFO', tag, message, metadata);
  }

  public p2p(tag: string, message: string, metadata?: Record<string, any>) {
    this.log('P2P', tag, message, metadata);
  }

  public por(tag: string, message: string, metadata?: Record<string, any>) {
    this.log('POR', tag, message, metadata);
  }

  public reedSolomon(tag: string, message: string, metadata?: Record<string, any>) {
    this.log('REED_SOLOMON', tag, message, metadata);
  }

  public heal(tag: string, message: string, metadata?: Record<string, any>) {
    this.log('HEAL', tag, message, metadata);
  }

  public warn(tag: string, message: string, metadata?: Record<string, any>, err?: any) {
    this.log('WARN', tag, message, metadata, err);
  }

  public error(tag: string, message: string, metadata?: Record<string, any>, err?: any) {
    this.log('ERROR', tag, message, metadata, err);
  }
}

export const logger = new NexxusLogger();
