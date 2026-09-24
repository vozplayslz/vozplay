/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY STRUCTURED LOGGER
 * Sistema de logs auditáveis com níveis: INFO, WARN, ERROR, SECURITY, AUDIT
 */

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SECURITY' | 'AUDIT';

export interface LogContext {
  requestId?: string;
  establishmentId?: string;
  sessionId?: string;
  actorId?: string;
  actorRole?: string;
  ip?: string;
  path?: string;
  method?: string;
  [key: string]: any;
}

class Logger {
  private formatLog(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const cleanContext = { ...context };
    
    // Sanitização de dados sensíveis para nunca vazar nos logs
    if (cleanContext.password) cleanContext.password = '[REDACTED]';
    if (cleanContext.token) cleanContext.token = '[REDACTED]';
    if (cleanContext.secret) cleanContext.secret = '[REDACTED]';
    if (cleanContext.passwordHash) cleanContext.passwordHash = '[REDACTED]';

    return JSON.stringify({
      timestamp,
      level,
      message,
      ...cleanContext
    });
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatLog('INFO', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatLog('WARN', message, context));
  }

  error(message: string, error?: any, context?: LogContext): void {
    const errorDetails = error ? {
      errorMessage: error?.message || String(error),
      stack: error?.stack
    } : {};
    console.error(this.formatLog('ERROR', message, { ...context, ...errorDetails }));
  }

  security(message: string, context?: LogContext): void {
    console.warn(this.formatLog('SECURITY', `[ALERTA DE SEGURANÇA] ${message}`, context));
  }

  audit(message: string, context?: LogContext): void {
    console.log(this.formatLog('AUDIT', `[AUDITORIA] ${message}`, context));
  }
}

export const logger = new Logger();
