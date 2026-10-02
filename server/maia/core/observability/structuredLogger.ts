/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA STRUCTURED OBSERVABILITY LOGGER (FASE 11)
 * Logs estruturados em formato JSON com redaction automático de segredos,
 * correlationId, traceId e padronização para OpenTelemetry/Datadog/CloudWatch.
 */

import { MaiaRedactor } from '../security/redactor.js';
import { maiaPromptShield } from '../security/promptShield.js';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface StructuredLogRecord {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  correlationId?: string;
  traceId?: string;
  tenantId?: string;
  actorRole?: string;
  data?: unknown;
}

export class MaiaStructuredLogger {
  private componentName: string;

  constructor(componentName: string = 'MaiaCore') {
    this.componentName = componentName;
  }

  private write(level: LogLevel, message: string, meta?: {
    correlationId?: string;
    traceId?: string;
    tenantId?: string;
    actorRole?: string;
    data?: unknown;
  }): void {
    const rawData = meta?.data;
    const redactedData = rawData ? MaiaRedactor.redactObject(rawData) : undefined;
    const redactedMessage = MaiaRedactor.redactText(message);

    if (redactedMessage !== message) {
      maiaPromptShield.incrementSecretsRedacted();
    }

    const record: StructuredLogRecord = {
      timestamp: new Date().toISOString(),
      level,
      component: this.componentName,
      message: redactedMessage,
      correlationId: meta?.correlationId,
      traceId: meta?.traceId,
      tenantId: meta?.tenantId,
      actorRole: meta?.actorRole,
      data: redactedData
    };

    const serialized = JSON.stringify(record);

    if (level === 'ERROR') {
      console.error(serialized);
    } else if (level === 'WARN') {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }
  }

  public info(message: string, meta?: { correlationId?: string; traceId?: string; tenantId?: string; actorRole?: string; data?: unknown }): void {
    this.write('INFO', message, meta);
  }

  public warn(message: string, meta?: { correlationId?: string; traceId?: string; tenantId?: string; actorRole?: string; data?: unknown }): void {
    this.write('WARN', message, meta);
  }

  public error(message: string, meta?: { correlationId?: string; traceId?: string; tenantId?: string; actorRole?: string; data?: unknown }): void {
    this.write('ERROR', message, meta);
  }

  public debug(message: string, meta?: { correlationId?: string; traceId?: string; tenantId?: string; actorRole?: string; data?: unknown }): void {
    this.write('DEBUG', message, meta);
  }
}

export const maiaStructuredLogger = new MaiaStructuredLogger('MaiaSystem');
