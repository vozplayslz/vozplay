/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA AI CREDENTIAL MANAGER & SECRET VAULT
 * Gerenciador seguro de credenciais, múltiplos projetos Gemini e gateways com isolamento multi-tenant.
 * Criptografia AES-256-GCM de segredos e mascaramento estrito para frontend e logs.
 */

import crypto from 'node:crypto';
import { AICredential, MaIAProviderType, CredentialStatus, ValidationResult } from '../types.js';
import { pgClient } from '../../pgClient.js';
import { logger } from '../../logger.js';
import { aiAudit } from '../audit/aiAudit.js';
import { GeminiProvider } from '../providers/gemini.js';
import { RouterProvider } from '../providers/routerProvider.js';

// Chave mestra de cofre (32 bytes) derivada do ambiente ou gerada para o ciclo de vida
const ENCRYPTION_SECRET = process.env.ENCRYPTION_KEY || process.env.SUPERVISOR_PASSWORD || 'VozPlay-Enlace-Secure-MaIA-Secret-Vault-Key-32';
const MASTER_KEY = crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();

/**
 * Criptografa segredo utilizando AES-256-GCM
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decriptografa segredo cifrado com AES-256-GCM (Uso exclusivo do backend)
 */
export function decryptSecret(encryptedPayload: string): string {
  if (!encryptedPayload) return '';
  try {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) return '';
    const [ivHex, authTagHex, encryptedHex] = parts;
    const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    logger.error('[CredentialManager] Erro ao decriptografar segredo do cofre:', err);
    return '';
  }
}

/**
 * Mascara API Key para apresentação segura (NUNCA expõe a chave real)
 * Exemplo: AIzaSy...4F8x
 */
export function maskApiKey(apiKey: string | undefined): string {
  if (!apiKey || apiKey.trim() === '') return 'Não configurada';
  const clean = apiKey.trim();
  if (clean.length <= 8) return '••••••••';
  const prefix = clean.slice(0, 6);
  const suffix = clean.slice(-4);
  return `${prefix}...${suffix}`;
}

class AICredentialManager {
  // Cache de credenciais em memória indexado por: `${establishmentId}:${provider}`
  private credentialsMap: Map<string, AICredential> = new Map();
  // Cofre seguro de segredos decriptados em memória para execução rápida sem I/O desnecessário
  private secretVault: Map<string, string> = new Map();

  constructor() {
    this.seedDefaultEnlaceCredential();
  }

  /**
   * Inicializa credencial padrão do Gemini Enlace a partir de variáveis de ambiente
   */
  private seedDefaultEnlaceCredential() {
    const defaultKey = process.env.GEMINI_API_KEY || '';
    const hasDefaultKey = defaultKey && defaultKey !== 'SUA_CHAVE_GEMINI_API_AQUI' && defaultKey.length >= 10;
    
    const defaultEnlaceCred: AICredential = {
      id: 'cred-gemini-enlace-default',
      tenant_id: 'enlace-platform',
      establishment_id: 'est-slz-lounge',
      provider: 'gemini_enlace',
      credential_type: 'API_KEY',
      secret_reference: hasDefaultKey ? encryptSecret(defaultKey) : '',
      project_id: 'enlace-ai-platform',
      display_name: 'Gemini Enlace (Padrão)',
      status: hasDefaultKey ? 'ACTIVE' : 'PENDING_KEY',
      allowed_tasks: ['CHAT', 'LIVE_VOICE', 'REASONING', 'TTS', 'TRANSCRIPTION', 'MUSIC_ASSISTANCE'],
      allowed_models: ['gemini-3.8-flash', 'gemini-3.8-live', 'gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts', 'gemini-3.1-pro-preview', 'gemini-3.5-transcribe'],
      priority: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_validated_at: hasDefaultKey ? new Date().toISOString() : undefined,
      masked_key: maskApiKey(defaultKey)
    };

    const key = `est-slz-lounge:gemini_enlace`;
    this.credentialsMap.set(key, defaultEnlaceCred);
    if (hasDefaultKey) {
      this.secretVault.set(key, defaultKey);
    }
  }

  /**
   * Salva ou atualiza uma credencial de IA com isolamento estrito por estabelecimento
   */
  public async saveCredential(
    establishmentId: string,
    payload: {
      provider: MaIAProviderType;
      apiKey?: string;
      projectId?: string;
      displayName?: string;
      allowedTasks?: any[];
      allowedModels?: string[];
      priority?: number;
      actorName?: string;
    }
  ): Promise<AICredential> {
    const provider = payload.provider;
    const key = `${establishmentId}:${provider}`;
    const existing = this.credentialsMap.get(key);

    let rawKey = payload.apiKey?.trim();
    // Se o frontend enviar a chave mascarada, mantém a chave real existente
    if (rawKey && (rawKey.includes('...') || rawKey.includes('••••'))) {
      rawKey = this.secretVault.get(key) || '';
    }

    const hasKey = Boolean(rawKey && rawKey.length >= 8);
    const secretRef = hasKey ? encryptSecret(rawKey!) : (existing?.secret_reference || '');

    const credential: AICredential = {
      id: existing?.id || `cred-${provider}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      tenant_id: establishmentId,
      establishment_id: establishmentId,
      provider,
      credential_type: 'API_KEY',
      secret_reference: secretRef,
      project_id: payload.projectId?.trim() || existing?.project_id || (provider === 'gemini_enlace' ? 'enlace-ai-platform' : 'meu-projeto-gemini'),
      display_name: payload.displayName?.trim() || existing?.display_name || (provider === 'gemini_customer' ? 'Meu projeto Gemini' : provider === '9router' ? '9router Gateway' : 'Gemini Enlace'),
      status: hasKey ? (existing?.status === 'ACTIVE' ? 'ACTIVE' : 'VALIDATED') : 'PENDING_KEY',
      allowed_tasks: payload.allowedTasks || existing?.allowed_tasks || ['CHAT', 'REASONING', 'MUSIC_ASSISTANCE'],
      allowed_models: payload.allowedModels || existing?.allowed_models || ['gemini-3.8-flash'],
      priority: payload.priority ?? existing?.priority ?? (provider === 'gemini_customer' ? 2 : provider === 'gemini_enlace' ? 1 : 3),
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_validated_at: existing?.last_validated_at,
      masked_key: maskApiKey(rawKey || this.secretVault.get(key))
    };

    this.credentialsMap.set(key, credential);
    if (hasKey) {
      this.secretVault.set(key, rawKey!);
    }

    // Persistência segura em PostgreSQL se conectado
    if (pgClient.isConnected) {
      try {
        await pgClient.query(
          `INSERT INTO maia_ai_credentials (
            id, tenant_id, establishment_id, provider, credential_type,
            secret_reference, project_id, display_name, status,
            allowed_tasks, allowed_models, priority, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (id) DO UPDATE SET
            secret_reference = EXCLUDED.secret_reference,
            project_id = EXCLUDED.project_id,
            display_name = EXCLUDED.display_name,
            status = EXCLUDED.status,
            allowed_tasks = EXCLUDED.allowed_tasks,
            allowed_models = EXCLUDED.allowed_models,
            priority = EXCLUDED.priority,
            updated_at = EXCLUDED.updated_at`,
          [
            credential.id, credential.tenant_id, credential.establishment_id, credential.provider, credential.credential_type,
            credential.secret_reference, credential.project_id, credential.display_name, credential.status,
            JSON.stringify(credential.allowed_tasks), JSON.stringify(credential.allowed_models), credential.priority, credential.updated_at
          ]
        );
      } catch (err) {
        logger.error('[CredentialManager] Erro ao sincronizar credencial no PostgreSQL:', err);
      }
    }

    aiAudit.record({
      actor: payload.actorName || 'Supervisor',
      tenant_id: establishmentId,
      establishment_id: establishmentId,
      event_type: existing ? 'AI_CREDENTIAL_ROTATED' : 'AI_PROVIDER_CONNECTED',
      provider,
      reason: `Credencial de ${credential.display_name} salva com sucesso.`
    });

    return { ...credential };
  }

  /**
   * Obtém credencial por estabelecimento e provedor (apenas com chave mascarada)
   */
  public getCredential(establishmentId: string, provider: MaIAProviderType): AICredential | null {
    const key = `${establishmentId}:${provider}`;
    const cred = this.credentialsMap.get(key);
    if (!cred) {
      if (provider === 'gemini_enlace' || provider === 'gemini') {
        return this.credentialsMap.get(`est-slz-lounge:gemini_enlace`) || null;
      }
      return null;
    }
    return { ...cred };
  }

  /**
   * Lista todas as credenciais do estabelecimento com dados sensíveis mascarados
   * Garante isolamento estrito: um estabelecimento NUNCA vê dados de outro.
   */
  public getCredentialsList(establishmentId: string): AICredential[] {
    const list: AICredential[] = [];
    
    // Sempre inclui a credencial Enlace pública/padrão
    const enlaceCred = this.getCredential(establishmentId, 'gemini_enlace');
    if (enlaceCred) list.push(enlaceCred);

    // Adiciona credenciais específicas registradas pelo próprio estabelecimento
    for (const [key, cred] of this.credentialsMap.entries()) {
      if (key.startsWith(`${establishmentId}:`) && cred.provider !== 'gemini_enlace') {
        list.push({ ...cred });
      }
    }

    // Se o 9router ainda não tiver registro criado para o lounge, expõe o placeholder não configurado
    if (!list.some(c => c.provider === '9router')) {
      list.push({
        id: `cred-9router-placeholder`,
        tenant_id: establishmentId,
        establishment_id: establishmentId,
        provider: '9router',
        credential_type: 'API_KEY',
        secret_reference: '',
        project_id: '9router-gateway',
        display_name: '9router Gateway (Opcional)',
        status: 'PENDING_KEY',
        allowed_tasks: ['CHAT', 'REASONING', 'MUSIC_ASSISTANCE'],
        allowed_models: ['gemini-3.8-flash'],
        priority: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        masked_key: 'Não configurada'
      });
    }

    // Se o Gemini do cliente ainda não tiver registro criado para o lounge, expõe o placeholder
    if (!list.some(c => c.provider === 'gemini_customer')) {
      list.push({
        id: `cred-gemini-customer-placeholder`,
        tenant_id: establishmentId,
        establishment_id: establishmentId,
        provider: 'gemini_customer',
        credential_type: 'API_KEY',
        secret_reference: '',
        project_id: '',
        display_name: 'Meu projeto Gemini (Google Cloud)',
        status: 'PENDING_KEY',
        allowed_tasks: ['CHAT', 'LIVE_VOICE', 'REASONING', 'TTS', 'TRANSCRIPTION', 'MUSIC_ASSISTANCE'],
        allowed_models: ['gemini-3.8-flash', 'gemini-3.8-live', 'gemini-3.8-flash-lite-tts'],
        priority: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        masked_key: 'Não configurada'
      });
    }

    return list.map(c => {
      const { secret_reference, ...safe } = c;
      return safe as AICredential;
    });
  }

  /**
   * Obtém a chave decriptada em tempo de execução (USO EXCLUSIVO DO CORE MAIA)
   */
  public getDecryptedSecret(establishmentId: string, provider: MaIAProviderType): string {
    const key = `${establishmentId}:${provider}`;
    let secret = this.secretVault.get(key);
    if (!secret) {
      const cred = this.credentialsMap.get(key);
      if (cred && cred.secret_reference) {
        secret = decryptSecret(cred.secret_reference);
        if (secret) {
          this.secretVault.set(key, secret);
        }
      }
    }
    // Fallback para Enlace se solicitado
    if (!secret && (provider === 'gemini_enlace' || provider === 'gemini')) {
      return process.env.GEMINI_API_KEY || '';
    }
    return secret || '';
  }

  /**
   * Ativa uma credencial validada como provedor preferencial do estabelecimento
   */
  public async activateCredential(
    establishmentId: string,
    credentialId: string,
    actorName = 'Supervisor'
  ): Promise<{ success: boolean; credential?: AICredential; error?: string }> {
    let targetKey: string | null = null;
    let targetCred: AICredential | null = null;

    for (const [key, cred] of this.credentialsMap.entries()) {
      if (cred.id === credentialId && cred.establishment_id === establishmentId) {
        targetKey = key;
        targetCred = cred;
        break;
      }
    }

    if (!targetCred || !targetKey) {
      return { success: false, error: 'Credencial não encontrada ou acesso negado (isolamento multitenant).' };
    }

    const secret = this.getDecryptedSecret(establishmentId, targetCred.provider);
    if (!secret && targetCred.provider !== 'gemini_enlace') {
      return { success: false, error: 'Não é possível ativar um provedor sem credencial válida cadastrada.' };
    }

    targetCred.status = 'ACTIVE';
    targetCred.updated_at = new Date().toISOString();
    this.credentialsMap.set(targetKey, targetCred);

    aiAudit.record({
      actor: actorName,
      tenant_id: establishmentId,
      establishment_id: establishmentId,
      event_type: 'AI_PROVIDER_ACTIVATED',
      provider: targetCred.provider,
      reason: `Provedor ${targetCred.display_name} ativado como preferencial.`
    });

    return { success: true, credential: { ...targetCred } };
  }

  /**
   * Revoga e desativa uma credencial
   */
  public async revokeCredential(
    establishmentId: string,
    credentialId: string,
    actorName = 'Supervisor'
  ): Promise<{ success: boolean; error?: string }> {
    for (const [key, cred] of this.credentialsMap.entries()) {
      if (cred.id === credentialId && cred.establishment_id === establishmentId) {
        cred.status = 'DISABLED';
        cred.secret_reference = '';
        cred.masked_key = 'Revogada';
        cred.updated_at = new Date().toISOString();
        this.secretVault.delete(key);

        aiAudit.record({
          actor: actorName,
          tenant_id: establishmentId,
          establishment_id: establishmentId,
          event_type: 'AI_CREDENTIAL_REVOKED',
          provider: cred.provider,
          reason: `Credencial ${cred.display_name} revogada e desativada.`
        });

        return { success: true };
      }
    }
    return { success: false, error: 'Credencial não encontrada para o estabelecimento.' };
  }

  /**
   * Testa e valida detalhadamente uma credencial ("Testar conexão")
   */
  public async testCredential(
    establishmentId: string,
    params: {
      provider: MaIAProviderType;
      apiKey?: string;
      projectId?: string;
      gatewayUrl?: string;
    }
  ): Promise<ValidationResult> {
    const provider = params.provider;
    let key = params.apiKey?.trim();

    // Se chave for mascarada ou vazia, recupera do cofre seguro
    if (key && (key.includes('...') || key.includes('••••'))) {
      key = this.getDecryptedSecret(establishmentId, provider);
    } else if (!key) {
      key = this.getDecryptedSecret(establishmentId, provider);
    }

    let validation: ValidationResult;
    if (provider === '9router' || provider === 'custom_gateway') {
      const routerProvider = new RouterProvider(params.gatewayUrl, key);
      validation = await routerProvider.testConnection({
        gatewayUrl: params.gatewayUrl,
        apiKey: key,
        projectId: params.projectId
      });
    } else {
      const geminiProvider = new GeminiProvider(key, provider);
      validation = await geminiProvider.testConnection({
        apiKey: key,
        projectId: params.projectId
      });
    }

    aiAudit.record({
      actor: 'Supervisor',
      tenant_id: establishmentId,
      establishment_id: establishmentId,
      event_type: 'AI_PROVIDER_VALIDATED',
      provider,
      reason: validation.valid 
        ? `Validação de conexão com ${provider} concluída com sucesso.`
        : `Validação de conexão com ${provider} falhou: ${validation.error || 'Erro desconhecido'}`
    });

    return validation;
  }
}

export const aiCredentialManager = new AICredentialManager();
