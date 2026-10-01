/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA AGENT RUNTIME ERRORS
 * Hierarquia formal de erros para o Agent Runtime e Planner.
 */

import { MaiaCoreError } from '../errors.js';

export {
  MaiaCoreError,
  MaiaSecurityError,
  MaiaPolicyViolationError,
  MaiaAuthenticationError,
  MaiaValidationError,
  MaiaNotFoundError,
  MaiaToolExecutionError,
  MaiaProviderError,
  MaiaRateLimitError,
  MaiaContextError
} from '../errors.js';

export class MaiaAgentLoopDetectedError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_AGENT_LOOP_DETECTED';
  public readonly statusCode = 409;
}

export class MaiaAgentConfirmationExpiredError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_AGENT_CONFIRMATION_EXPIRED';
  public readonly statusCode = 410;
}

export class MaiaAgentArgumentMismatchError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_AGENT_ARGUMENT_MISMATCH';
  public readonly statusCode = 400;
}

export class MaiaAgentBudgetExceededError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_AGENT_BUDGET_EXCEEDED';
  public readonly statusCode = 429;
}

export class MaiaAgentMaxStepsExceededError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_AGENT_MAX_STEPS_EXCEEDED';
  public readonly statusCode = 400;
}

export class MaiaAgentTimeoutError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_AGENT_TIMEOUT';
  public readonly statusCode = 408;
}

export class MaiaAgentTaskCancelledError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_AGENT_TASK_CANCELLED';
  public readonly statusCode = 409;
}

export class MaiaAgentInvalidPlanError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_AGENT_INVALID_PLAN';
  public readonly statusCode = 422;
}

export class MaiaAgentPolicyRejectedError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_AGENT_POLICY_REJECTED';
  public readonly statusCode = 403;
}

export class MaiaAgentToolNotFoundError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_AGENT_TOOL_NOT_FOUND';
  public readonly statusCode = 404;
}

export class MaiaAgentAwaitingConfirmationError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_AGENT_AWAITING_CONFIRMATION';
  public readonly statusCode = 202;
}
