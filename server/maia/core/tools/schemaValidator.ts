/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA TOOL SCHEMA VALIDATOR
 * Validador rigoroso de esquemas de entrada e saída para ferramentas.
 * Impede que entradas malformadas, tipos inválidos ou campos perigosos cheguem ao domínio.
 */

import { ToolInputSchema, ToolParameterProperty } from './types.js';

export interface ToolValidationResult {
  valid: boolean;
  errors: string[];
}

export class ToolSchemaValidator {
  /**
   * Valida parâmetros de entrada contra o esquema da ferramenta
   */
  public static validateInput(schema: ToolInputSchema, params: any): ToolValidationResult {
    const errors: string[] = [];

    if (params === null || params === undefined || typeof params !== 'object') {
      if (schema.required && schema.required.length > 0) {
        errors.push(`Parâmetros inválidos: esperado um objeto contendo os campos [${schema.required.join(', ')}].`);
        return { valid: false, errors };
      }
      return { valid: true, errors: [] };
    }

    // 1. Checagem de Campos Obrigatórios
    if (schema.required) {
      for (const reqKey of schema.required) {
        if (params[reqKey] === undefined || params[reqKey] === null) {
          errors.push(`Campo obrigatório ausente: '${reqKey}'.`);
        }
      }
    }

    // 2. Checagem de Propriedades Extras (se additionalProperties === false)
    if (schema.additionalProperties === false) {
      const allowedKeys = new Set(Object.keys(schema.properties || {}));
      for (const paramKey of Object.keys(params)) {
        if (!allowedKeys.has(paramKey)) {
          errors.push(`Campo não permitido: '${paramKey}' não faz parte do contrato da ferramenta.`);
        }
      }
    }

    // 3. Validação de Tipos, Enums e Restrições por Campo
    for (const [propName, propDef] of Object.entries(schema.properties || {})) {
      const val = params[propName];
      if (val === undefined || val === null) continue; // Campos opcionais vazios são aceitos

      this.validateProperty(propName, propDef, val, errors);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private static validateProperty(
    propName: string,
    propDef: ToolParameterProperty,
    val: any,
    errors: string[]
  ): void {
    // Validação de Tipo
    const actualType = Array.isArray(val) ? 'array' : typeof val;
    if (actualType !== propDef.type) {
      errors.push(`Tipo inválido para '${propName}': esperado '${propDef.type}', recebido '${actualType}'.`);
      return;
    }

    // Validação de Enums
    if (propDef.enum && !propDef.enum.includes(val)) {
      errors.push(`Valor inválido para '${propName}': '${val}' não é uma opção válida [${propDef.enum.join(', ')}].`);
    }

    // Validação Numérica
    if (propDef.type === 'number') {
      if (propDef.minimum !== undefined && val < propDef.minimum) {
        errors.push(`Valor de '${propName}' (${val}) é menor que o mínimo permitido (${propDef.minimum}).`);
      }
      if (propDef.maximum !== undefined && val > propDef.maximum) {
        errors.push(`Valor de '${propName}' (${val}) é maior que o máximo permitido (${propDef.maximum}).`);
      }
    }

    // Validação de Strings
    if (propDef.type === 'string') {
      if (propDef.minLength !== undefined && val.length < propDef.minLength) {
        errors.push(`Tamanho de '${propName}' (${val.length}) é menor que o mínimo de ${propDef.minLength} caracteres.`);
      }
      if (propDef.maxLength !== undefined && val.length > propDef.maxLength) {
        errors.push(`Tamanho de '${propName}' (${val.length}) excede o limite máximo de ${propDef.maxLength} caracteres.`);
      }
    }
  }
}
