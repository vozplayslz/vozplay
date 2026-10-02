/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA VOICE ERRORS
 * Hierarquia formal de erros para o subsistema de voz, streaming e interrupções.
 */

import { MaiaCoreError } from '../errors.js';

export class MaiaVoiceError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_VOICE';
  public readonly statusCode = 500;
}

export class MaiaVoiceSessionError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_VOICE_SESSION';
  public readonly statusCode = 400;
}

export class MaiaVoiceInterruptedError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_VOICE_INTERRUPTED';
  public readonly statusCode = 409;
}

export class MaiaVoiceProviderUnavailableError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_VOICE_PROVIDER_UNAVAILABLE';
  public readonly statusCode = 503;
}

export class MaiaVoiceTimeoutError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_VOICE_TIMEOUT';
  public readonly statusCode = 408;
}

export class MaiaVoiceInjectionBlockedError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_VOICE_INJECTION_BLOCKED';
  public readonly statusCode = 400;
}
