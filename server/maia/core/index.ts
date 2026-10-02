/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA CORE ENTRYPOINT
 * Núcleo desacoplado de Inteligência Artificial do ecossistema MaIA.
 * 
 * Componentes:
 * - Identity Engine: Identidade imutável MaIA e princípios universais
 * - Context Engine: Criação, sanitização e isolamento multi-tenant
 * - Policy Engine: Governança, RBAC e mitigação de risco de execução
 * - Tool Registry: Catálogo de ferramentas, validação de esquemas e sandbox
 * - Event Bus: Barramento assíncrono com wildcards e anti-spam
 * - AI Router: Roteador de provedores plugáveis com fallback resiliente
 * - Memory Engine: Memória em camadas (turno, sessão e persistência)
 * - Agent Runtime: Ciclo integrado de percepção, raciocínio, ferramentas e síntese
 */

export * from './types.js';
export * from './errors.js';
export * from './identity/identityEngine.js';
export * from './context/index.js';
export * from './policy/policyEngine.js';
export * from './tools/index.js';
export * from './events/index.js';
export * from './perception/index.js';
export * from './router/index.js';
export * from './memory/index.js';
export * from './runtime/index.js';
export * from './voice/index.js';
export * from './autonomy/index.js';
export * from './security/index.js';
export * from './observability/index.js';
