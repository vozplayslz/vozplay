/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PROMPT 01 — AUDITORIA CORRETIVA: FUNDAÇÃO, SEGURANÇA E ISOLAMENTO MULTIESTABELECIMENTO
 * Validação rigorosa dos Lotes 1A e 1B:
 * - Lote 1A: PostgreSQL, Transações atômicas, RLS Fail-Closed e Integridade de Migrações.
 * - Lote 1B: Autorização, Sessão, Matriz de Risco, Confirmação Humana e Auditoria.
 */

import fs from 'fs';
import path from 'path';
import { db } from '../server/db.js';
import { pgClient, DatabaseClient } from '../server/pgClient.js';
import { migrationEngine, MigrationEngine } from '../server/migrations/migrator.js';
import { maiaAuthorizationEngine } from '../server/maia/authorization/maiaAuthorizationEngine.js';
import { maiaConfigManager } from '../server/maia/config.js';
import { aiAudit } from '../server/maia/audit/aiAudit.js';
import { MaIAToolContext, MaIAToolDefinition } from '../server/maia/types.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string, details?: string): void {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${message}: ${details || 'Condição não satisfeita'}`);
  }
}

async function runPrompt01Audit() {
  console.log('================================================================');
  console.log('  PROMPT 01 — AUDITORIA E EVIDÊNCIAS: FUNDAÇÃO & SEGURANÇA      ');
  console.log('  VozPlay / MaIA Karaokê — vozplay.ai.slz.br                     ');
  console.log('================================================================\n');

  // ============================================================================
  // LOTE 1A — POSTGRESQL, TRANSAÇÕES E RLS FAIL-CLOSED
  // ============================================================================
  console.log('🔒 [LOTE 1A] PostgreSQL, Transações e Isolamento RLS Fail-Closed\n');

  // 1A.1 Validação do Mecanismo de Contexto de Tenant
  {
    console.log('1. Testando validação de identificador de estabelecimento em runWithTenantContext...');
    let emptyTenantBlocked = false;
    try {
      await pgClient.runWithTenantContext('', async () => {});
    } catch (err: any) {
      emptyTenantBlocked = err.message.includes('[CRITICAL_SECURITY_ERROR]');
    }
    assert(emptyTenantBlocked, 'runWithTenantContext rejeita identificador vazio com [CRITICAL_SECURITY_ERROR]');

    let whitespaceTenantBlocked = false;
    try {
      await pgClient.runWithTenantContext('   ', async () => {});
    } catch (err: any) {
      whitespaceTenantBlocked = err.message.includes('[CRITICAL_SECURITY_ERROR]');
    }
    assert(whitespaceTenantBlocked, 'runWithTenantContext rejeita identificador composto apenas de espaços');

    let nullTenantBlocked = false;
    try {
      await pgClient.runWithTenantContext(null as any, async () => {});
    } catch (err: any) {
      nullTenantBlocked = err.message.includes('[CRITICAL_SECURITY_ERROR]');
    }
    assert(nullTenantBlocked, 'runWithTenantContext rejeita valor nulo');
  }

  // 1A.2 Inspecionando Arquitetura de Transação e Liberação em pgClient.ts
  {
    console.log('\n2. Auditando ciclo transacional atômico e limpeza de sessão em pgClient.ts...');
    const pgClientCode = fs.readFileSync(path.resolve(process.cwd(), 'server/pgClient.ts'), 'utf8');

    assert(pgClientCode.includes("client.query('BEGIN')"), 'runWithTenantContext inicia transação explícita com BEGIN');
    assert(pgClientCode.includes("client.query('COMMIT')"), 'runWithTenantContext confirma transação com COMMIT no caminho feliz');
    assert(pgClientCode.includes("client.query('ROLLBACK')"), 'runWithTenantContext reverte transação com ROLLBACK em caso de erro');
    assert(pgClientCode.includes('this.clearTenantContext(client)'), 'runWithTenantContext invoca clearTenantContext no bloco finally');
    assert(pgClientCode.includes('client.release()'), 'runWithTenantContext garante client.release() em todos os caminhos');
    assert(pgClientCode.includes('queryWithTenant'), 'pgClient fornece método queryWithTenant protegido por contexto');
  }

  // 1A.3 Auditoria de Políticas RLS em 005_rls_fail_closed.sql
  {
    console.log('\n3. Auditando políticas estritamente FAIL-CLOSED em 005_rls_fail_closed.sql...');
    const rlsSql = fs.readFileSync(path.resolve(process.cwd(), 'migrations/005_rls_fail_closed.sql'), 'utf8');

    const protectedTables = [
      'sessions',
      'queue_items',
      'leads',
      'users',
      'establishment_branding',
      'maia_config',
      'maia_credentials',
      'maia_memories',
      'devices',
      'maia_usage'
    ];

    for (const table of protectedTables) {
      const hasForceRls = rlsSql.includes(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      assert(hasForceRls, `Tabela '${table}' possui FORCE ROW LEVEL SECURITY ativo`);
    }

    // Regra Fail-Closed: Não pode conter fail-open (ex: "IS NULL OR")
    const hasFailOpen = /NULLIF\(.*?,\s*''\)\s+IS\s+NULL\s+OR/i.test(rlsSql);
    assert(!hasFailOpen, 'Políticas RLS NÃO contêm bypass fail-open ("IS NULL OR" eliminado)');

    // Cláusula Fail-Closed estrita
    const hasFailClosedCheck = rlsSql.includes("NULLIF(current_setting('app.current_establishment_id', true), '') IS NOT NULL");
    assert(hasFailClosedCheck, 'Políticas exigem explicitamente contexto NÃO-NULO (IS NOT NULL)');

    // Limpeza em nível de sessão
    const clearsAtSessionLevel = rlsSql.includes("set_config('app.current_establishment_id', '', false)");
    assert(clearsAtSessionLevel, 'Função clear_tenant_context() limpa contexto no nível de sessão (is_local = false)');
  }

  // 1A.4 Integridade do Motor de Migrações (Migrator)
  {
    console.log('\n4. Testando integridade do motor de migrações e checksums SHA-256...');
    const files = migrationEngine.getMigrationFiles();
    assert(files.length >= 5, `Total de ${files.length} migrações oficiais identificadas`);

    const sampleContent = 'SELECT 1;';
    const hash1 = migrationEngine.computeChecksum(sampleContent);
    const hash2 = migrationEngine.computeChecksum(sampleContent);
    assert(hash1 === hash2, 'Checksum SHA-256 é determinístico e reprodutível');

    const modifiedContent = 'SELECT 2;';
    const hash3 = migrationEngine.computeChecksum(modifiedContent);
    assert(hash1 !== hash3, 'Qualquer alteração de conteúdo altera o checksum');

    const migratorCode = fs.readFileSync(path.resolve(process.cwd(), 'server/migrations/migrator.ts'), 'utf8');
    assert(migratorCode.includes('pg_advisory_lock'), 'Motor de migrações adquire advisory lock contra concorrência de startup');
    assert(migratorCode.includes('CRITICAL_MIGRATION_INTEGRITY'), 'Motor bloqueia modificações retroativas com erro de integridade');
  }

  // ============================================================================
  // LOTE 1B — AUTORIZAÇÃO E ESTADO DE SESSÃO
  // ============================================================================
  console.log('\n🛡️ [LOTE 1B] Autorização, Estado de Sessão e Matriz de Riscos\n');

  // Ferramentas mock para teste de governança
  const testReadTool: MaIAToolDefinition = {
    name: 'test.read.catalog',
    description: 'Consulta leitura',
    category: 'READ',
    allowedRoles: ['PARTICIPANT', 'CONTROLLER', 'SUPERVISOR', 'SYSTEM_ADMIN'],
    parameters: {},
    execute: async () => ({ data: 'ok' })
  };

  const testActionTool: MaIAToolDefinition = {
    name: 'test.action.skip',
    description: 'Ação operacional de escrita',
    category: 'ACTION',
    allowedRoles: ['CONTROLLER', 'SUPERVISOR', 'SYSTEM_ADMIN'],
    parameters: {},
    execute: async () => ({ status: 'skipped' })
  };

  const testCriticalTool: MaIAToolDefinition = {
    name: 'test.critical.takeover',
    description: 'Ação crítica de emergência',
    category: 'CRITICAL',
    allowedRoles: ['SUPERVISOR', 'SYSTEM_ADMIN'],
    parameters: {},
    execute: async () => ({ status: 'taken_over' })
  };

  const testFailingTool: MaIAToolDefinition = {
    name: 'test.action.failing',
    description: 'Ferramenta que lança exceção em execução',
    category: 'ACTION',
    allowedRoles: ['CONTROLLER', 'SUPERVISOR'],
    parameters: {},
    execute: async () => {
      throw new Error('Falha de hardware simulada no mixer');
    }
  };

  const validEstId = db.session.establishmentId;
  const validSessionId = db.session.id;

  // 1B.1 Papéis não autorizados são bloqueados
  {
    console.log('5. Testando bloqueio de papéis não autorizados...');
    const result = maiaAuthorizationEngine.evaluatePolicy(
      {
        establishmentId: validEstId,
        sessionId: validSessionId,
        actorRole: 'PARTICIPANT',
        actorName: 'Cliente João'
      },
      testActionTool,
      {}
    );
    assert(result.allowed === false, 'Participante é bloqueado para ferramenta ACTION');
    assert(Boolean(result.reason?.includes('não tem permissão')), 'Motivo indica falta de permissão');
  }

  // 1B.2 Ferramenta de escrita bloqueada para papel de leitura
  {
    console.log('\n6. Testando bloqueio de escrita para papéis estritamente de leitura...');
    const tvResult = maiaAuthorizationEngine.evaluatePolicy(
      {
        establishmentId: validEstId,
        sessionId: validSessionId,
        actorRole: 'TV',
        actorName: 'Telão Principal'
      },
      testActionTool,
      {}
    );
    assert(tvResult.allowed === false, 'Perfil TV é bloqueado para qualquer ferramenta de escrita');
  }

  // 1B.3 Chamada sem estabelecimento rejeitada
  {
    console.log('\n7. Testando rejeição de chamada sem identificador de estabelecimento...');
    const missingEstResult = maiaAuthorizationEngine.evaluatePolicy(
      {
        establishmentId: '',
        sessionId: validSessionId,
        actorRole: 'SUPERVISOR',
        actorName: 'Supervisor Geral'
      },
      testReadTool,
      {}
    );
    assert(missingEstResult.allowed === false, 'Chamada sem estabelecimento é rejeitada');
    assert(Boolean(missingEstResult.reason?.includes('multi-tenant')), 'Motivo indica violação multi-tenant');
  }

  // 1B.4 Chamada sem sessão rejeitada
  {
    console.log('\n8. Testando rejeição de chamada sem identificador de sessão...');
    const missingSessionResult = maiaAuthorizationEngine.evaluatePolicy(
      {
        establishmentId: validEstId,
        sessionId: '',
        actorRole: 'SUPERVISOR',
        actorName: 'Supervisor Geral'
      },
      testReadTool,
      {}
    );
    assert(missingSessionResult.allowed === false, 'Chamada sem sessão é terminantemente rejeitada');
    assert(Boolean(missingSessionResult.reason?.includes('sessão')), 'Motivo indica violação de isolamento de sessão');
  }

  // 1B.5 Chamada com estabelecimento cruzado rejeitada
  {
    console.log('\n9. Testando rejeição de chamada com estabelecimento cruzado...');
    const crossEstResult = maiaAuthorizationEngine.evaluatePolicy(
      {
        establishmentId: 'est-outro-bar-xyz',
        sessionId: validSessionId, // Sessão pertence a validEstId
        actorRole: 'SUPERVISOR',
        actorName: 'Supervisor Geral'
      },
      testReadTool,
      {}
    );
    assert(crossEstResult.allowed === false, 'Tentativa de acessar sessão de outro estabelecimento é bloqueada');
  }

  // 1B.6 Sessão inexistente ou inativa rejeitada
  {
    console.log('\n10. Testando rejeição de sessão inexistente ou inativa...');
    const invalidSessResult = maiaAuthorizationEngine.evaluatePolicy(
      {
        establishmentId: validEstId,
        sessionId: 'sess-fantasma-999',
        actorRole: 'CONTROLLER',
        actorName: 'Operador'
      },
      testReadTool,
      {}
    );
    assert(invalidSessResult.allowed === false, 'Sessão inexistente resulta em negação de acesso');
  }

  // 1B.7 Confirmação obrigatória exigida para ferramentas CRITICAL
  {
    console.log('\n11. Testando exigência de confirmação para ferramentas CRITICAL...');
    const unconfirmedResult = maiaAuthorizationEngine.evaluatePolicy(
      {
        establishmentId: validEstId,
        sessionId: validSessionId,
        actorRole: 'SUPERVISOR',
        actorName: 'Supervisor Geral'
      },
      testCriticalTool,
      { confirmed: false }
    );
    assert(unconfirmedResult.allowed === false, 'Ação CRITICAL sem confirmação é negada');
    assert(Boolean(unconfirmedResult.reason?.includes('confirmação explícita')), 'Mensagem exige confirmed: true');

    const confirmedResult = maiaAuthorizationEngine.evaluatePolicy(
      {
        establishmentId: validEstId,
        sessionId: validSessionId,
        actorRole: 'SUPERVISOR',
        actorName: 'Supervisor Geral'
      },
      testCriticalTool,
      { confirmed: true }
    );
    assert(confirmedResult.allowed === true, 'Ação CRITICAL com confirmação é autorizada para SUPERVISOR');
  }

  // 1B.8 Falha na execução da ferramenta registra auditoria
  {
    console.log('\n12. Testando gravação de auditoria em falha de execução de ferramenta...');
    let caughtError = false;
    try {
      await maiaAuthorizationEngine.executeAuthorizedTool(
        {
          establishmentId: validEstId,
          sessionId: validSessionId,
          actorRole: 'SUPERVISOR',
          actorName: 'Supervisor Chefe'
        },
        testFailingTool,
        { secretToken: 'segredo-123', safeParam: 'ok' }
      );
    } catch (err: any) {
      caughtError = err.message.includes('Falha de hardware simulada');
    }
    assert(caughtError, 'Exceção da ferramenta propagada normalmente para o chamador');

    // Verifica eventos no log de auditoria da MaIA
    const recentEvents = aiAudit.getEvents(validEstId, 5);
    const failureEvent = recentEvents.find(e => e.reason && e.reason.includes('FALHA_EXECUCAO_TOOL'));
    assert(Boolean(failureEvent), 'Evento estruturado de falha de ferramenta gravado em aiAudit');
    assert(failureEvent?.details?.tool === 'test.action.failing', 'Nome da ferramenta registrado no evento');
  }

  // 1B.9 Sanitização de Segredos na Auditoria
  {
    console.log('\n13. Testando sanitização de segredos em logs de auditoria...');
    const sanitized = (maiaAuthorizationEngine as any).sanitizeParamsForAudit({
      password: 'super_secret_password',
      token: 'jwt.bearer.token',
      apiKey: 'AIzaSyTestKey123',
      whatsapp: '98991234567',
      phone: '98991234567',
      authToken: 'secret_auth',
      secret: 'secret_key',
      publicTitle: 'Música Válida'
    });

    assert(sanitized.password === undefined, 'Campo password removido dos logs');
    assert(sanitized.token === undefined, 'Campo token removido dos logs');
    assert(sanitized.apiKey === undefined, 'Campo apiKey removido dos logs');
    assert(sanitized.whatsapp === undefined, 'Campo whatsapp removido dos logs');
    assert(sanitized.authToken === undefined, 'Campo authToken removido dos logs');
    assert(sanitized.secret === undefined, 'Campo secret removido dos logs');
    assert(sanitized.publicTitle === 'Música Válida', 'Campos públicos e operacionais preservados');
  }

  // 1B.10 Persistência e Recuperação de Configurações Multiestabelecimento
  {
    console.log('\n14. Testando persistência e recuperação de configurações por estabelecimento...');
    const tenantA = 'est-tenant-a-test';
    const tenantB = 'est-tenant-b-test';

    const cfgA = maiaConfigManager.updateConfig(tenantA, { cost_tier: 'ECONOMICO' });
    const cfgB = maiaConfigManager.updateConfig(tenantB, { cost_tier: 'ALTA_CAPACIDADE' });

    assert(cfgA.cost_tier === 'ECONOMICO', 'Configuração do Tenant A salva como ECONOMICO');
    assert(cfgB.cost_tier === 'ALTA_CAPACIDADE', 'Configuração do Tenant B salva como ALTA_CAPACIDADE');

    const retrievedA = maiaConfigManager.getConfig(tenantA);
    const retrievedB = maiaConfigManager.getConfig(tenantB);

    assert(retrievedA.cost_tier === 'ECONOMICO', 'Tenant A recupera seu próprio cost_tier');
    assert(retrievedB.cost_tier === 'ALTA_CAPACIDADE', 'Tenant B recupera seu próprio cost_tier');
    assert(retrievedA.models.CHAT !== retrievedB.models.CHAT, 'Modelos de IA isolados entre perfis de cada tenant');
  }

  // ============================================================================
  // RELATÓRIO FINAL
  // ============================================================================
  console.log('\n================================================================');
  console.log(`TOTAL DE ASSERÇÕES: ${totalTests}`);
  console.log(`PASSOU:             ${passedTests}`);
  console.log(`FALHOU:             ${failedTests}`);
  console.log('================================================================');

  if (failedTests > 0) {
    console.error(`❌ ${failedTests} testes falharam no Prompt 01.`);
    process.exit(1);
  } else {
    console.log('✅ AUDITORIA DO PROMPT 01 CONCLUÍDA COM 100% DE APROVAÇÃO!');
  }
}

runPrompt01Audit().catch((err) => {
  console.error('Erro fatal executando auditoria do Prompt 01:', err);
  process.exit(1);
});
