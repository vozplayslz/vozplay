/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA AUTONOMY ERRORS
 * Hierarquia formal de erros da camada de Autonomia Controlada.
 */

import { MaiaCoreError } from '../errors.js';

export class MaiaAutonomyError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_AUTONOMY';
  public readonly statusCode = 400;
}

export class MaiaAutonomyDisabledError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_AUTONOMY_DISABLED';
  public readonly statusCode = 403;
}

export class MaiaAutonomyPolicyDeniedError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_AUTONOMY_POLICY_DENIED';
  public readonly statusCode = 403;
}

export class MaiaAutonomyCircuitBreakerOpenError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_AUTONOMY_CIRCUIT_OPEN';
  public readonly statusCode = 503;
}

export class MaiaAutonomyEmergencyStopActiveError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_AUTONOMY_EMERGENCY_STOP';
  public readonly statusCode = 423; // Locked
}

export class MaiaAutonomyCooldownActiveError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_AUTONOMY_COOLDOWN_ACTIVE';
  public readonly statusCode = 429;
}

export class MaiaAutonomyLimitExceededError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_AUTONOMY_LIMIT_EXCEEDED';
  public readonly statusCode = 429;
}

export class MaiaAutonomyLevelNotPermittedError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_AUTONOMY_LEVEL_NOT_PERMITTED';
  public readonly statusCode = 403;
}
