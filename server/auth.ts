/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Hardened Authentication & Authoritative RBAC Engine
 * - Zero bypass por headers (x-client-role, etc. completamente ignorados)
 * - Hash com Argon2id para senhas
 * - Zero senhas default/hardcoded no código
 * - Tokens criptográficos com hash no banco, expiração e revogação
 * - Isolamento multi-tenant real por establishment_id
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';
import { logger } from './logger.js';
import { pgClient } from './pgClient.js';

export type UserRole = 'SUPERVISOR' | 'CONTROLLER' | 'PARTICIPANT' | 'TV' | 'SYSTEM_ADMIN';

export interface AuthSession {
  id: string;
  token: string;
  role: UserRole;
  establishmentId: string;
  sessionId: string;
  actorId: string;
  actorName: string;
  createdAt: string;
  expiresAt: string;
}

export interface OperationalUser {
  id: string;
  establishmentId: string;
  name: string;
  email: string;
  role: 'SUPERVISOR' | 'CONTROLLER' | 'SYSTEM_ADMIN';
  passwordHash: string;
  createdAt: string;
  lastLogin?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthSession;
      requestId?: string;
    }
  }
}

class AuthService {
  private inMemoryTokens: Map<string, AuthSession> = new Map();
  private operationalUsers: Map<string, OperationalUser> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    // Construtor puro sem efeitos colaterais assíncronos descontrolados (Prompt 14.2 - Seção 4)
  }

  /**
   * Inicializa credenciais com Argon2id controlado unicamente pelo ciclo de bootstrap
   */
  public async initDefaultCredentials(establishmentId?: string): Promise<void> {
    const isProduction = process.env.NODE_ENV === 'production';
    const supervisorPass = process.env.SUPERVISOR_PASSWORD;
    const controllerPass = process.env.CONTROLLER_PASSWORD;
    const estId = establishmentId || process.env.DEFAULT_ESTABLISHMENT_ID || 'est-default';

    const isCloudRun = Boolean(
      process.env.K_SERVICE || 
      process.env.K_REVISION || 
      process.env.CLOUD_RUN_TIMEOUT_SECONDS || 
      process.env.GAE_ENV ||
      process.env.DEFAULT_APP_PORT
    );

    if (isProduction && (!supervisorPass || !controllerPass)) {
      if (isCloudRun) {
        logger.warn('[VozPlay Auth] Cloud Run sem credenciais de produção injetadas. Usuários mestres aguardam configuração de secrets.');
        this.isInitialized = true;
        return;
      }
      throw new Error('[CRITICAL_AUTH_ERROR] SUPERVISOR_PASSWORD e CONTROLLER_PASSWORD são estritamente obrigatórias em produção.');
    }

    if (pgClient.isConnected) {
      try {
        await pgClient.query(
          `INSERT INTO establishments (id, name, domain, unit_code, active)
           VALUES ($1, $2, $3, $4, TRUE)
           ON CONFLICT (id) DO NOTHING`,
          [estId, 'VozPlay Unidade Principal', 'vozplay.ai.slz.br', 'unit-main']
        );
      } catch (err: any) {
        logger.warn('[VozPlay Auth] Aviso ao garantir estabelecimento padrão: ' + (err?.message || String(err)));
      }
    }

    if (supervisorPass) {
      const superHash = await this.hashPassword(supervisorPass);
      const adminUser: OperationalUser = {
        id: 'usr-admin-master',
        establishmentId: estId,
        name: 'Supervisor / Administrador Geral',
        email: 'admin@vozplay.ai.slz.br',
        role: 'SUPERVISOR',
        passwordHash: superHash,
        createdAt: new Date().toISOString()
      };
      this.operationalUsers.set(adminUser.id, adminUser);

      if (pgClient.isConnected) {
        try {
          await pgClient.query(
            `INSERT INTO users (id, establishment_id, name, email, role, password_hash, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
            [adminUser.id, estId, adminUser.name, adminUser.email, adminUser.role, adminUser.passwordHash, adminUser.createdAt]
          );
        } catch (err) {
          logger.error('Erro ao persistir usuário master no PostgreSQL:', err);
        }
      }
    }

    if (controllerPass) {
      const ctrlHash = await this.hashPassword(controllerPass);
      const ctrlUser: OperationalUser = {
        id: 'usr-ctrl-booth',
        establishmentId: estId,
        name: 'Operador de Mesa de Som',
        email: 'operador@vozplay.ai.slz.br',
        role: 'CONTROLLER',
        passwordHash: ctrlHash,
        createdAt: new Date().toISOString()
      };
      this.operationalUsers.set(ctrlUser.id, ctrlUser);

      if (pgClient.isConnected) {
        try {
          await pgClient.query(
            `INSERT INTO users (id, establishment_id, name, email, role, password_hash, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
            [ctrlUser.id, estId, ctrlUser.name, ctrlUser.email, ctrlUser.role, ctrlUser.passwordHash, ctrlUser.createdAt]
          );
        } catch (err) {
          logger.error('Erro ao persistir operador de som no PostgreSQL:', err);
        }
      }
    }

    // Hidrata cache de usuários a partir do PostgreSQL
    if (pgClient.isConnected) {
      try {
        const res = await pgClient.query(
          'SELECT id, establishment_id, name, email, role, password_hash, created_at, last_login FROM users'
        );
        for (const row of res.rows) {
          this.operationalUsers.set(row.id, {
            id: row.id,
            establishmentId: row.establishment_id || estId,
            name: row.name,
            email: row.email,
            role: row.role,
            passwordHash: row.password_hash,
            createdAt: row.created_at,
            lastLogin: row.last_login
          });
        }
      } catch (err) {
        logger.error('Erro ao hidratar usuários operacionais do PostgreSQL:', err);
      }
    }

    this.isInitialized = true;
  }

  /**
   * Hasheia senha utilizando Argon2id (RFC 9106)
   */
  async hashPassword(password: string): Promise<string> {
    return argon2Hash(password, {
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1
    });
  }

  /**
   * Compara com segurança senha candidata contra hash Argon2id
   */
  async verifyPassword(storedHash: string, candidatePassword: string): Promise<boolean> {
    if (!storedHash || !candidatePassword) return false;
    try {
      return await argon2Verify(storedHash, candidatePassword);
    } catch {
      return false;
    }
  }

  async getOperationalUsers(establishmentId?: string): Promise<Omit<OperationalUser, 'passwordHash'>[]> {
    if (pgClient.isConnected) {
      try {
        const queryText = establishmentId
          ? 'SELECT id, establishment_id, name, email, role, created_at, last_login FROM users WHERE establishment_id = $1 ORDER BY created_at ASC'
          : 'SELECT id, establishment_id, name, email, role, created_at, last_login FROM users ORDER BY created_at ASC';
        const params = establishmentId ? [establishmentId] : [];
        const res = await pgClient.query(queryText, params);
        if (res.rows.length > 0) {
          return res.rows.map(r => ({
            id: r.id,
            establishmentId: r.establishment_id,
            name: r.name,
            email: r.email,
            role: r.role,
            createdAt: r.created_at,
            lastLogin: r.last_login
          }));
        }
      } catch (err) {
        logger.error('Erro ao buscar usuários operacionais no PostgreSQL:', err);
      }
    }

    return Array.from(this.operationalUsers.values())
      .filter(u => !establishmentId || u.establishmentId === establishmentId)
      .map(u => ({
        id: u.id,
        establishmentId: u.establishmentId,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        lastLogin: u.lastLogin
      }));
  }

  async createOperationalUser(data: {
    establishmentId?: string;
    name: string;
    email: string;
    role: 'SUPERVISOR' | 'CONTROLLER' | 'SYSTEM_ADMIN';
    password: string;
  }): Promise<Omit<OperationalUser, 'passwordHash'>> {
    const estId = data.establishmentId || process.env.DEFAULT_ESTABLISHMENT_ID || 'est-default';
    const id = 'usr-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    const passwordHash = await this.hashPassword(data.password);
    const user: OperationalUser = {
      id,
      establishmentId: estId,
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      role: data.role,
      passwordHash,
      createdAt: new Date().toISOString()
    };
    this.operationalUsers.set(id, user);

    if (pgClient.isConnected) {
      try {
        await pgClient.query(
          `INSERT INTO establishments (id, name, domain, unit_code, active)
           VALUES ($1, $2, $3, $4, TRUE)
           ON CONFLICT (id) DO NOTHING`,
          [estId, 'VozPlay Estabelecimento Operacional', 'vozplay.ai.slz.br', 'unit-' + estId.slice(-6)]
        );

        await pgClient.query(
          `INSERT INTO users (id, establishment_id, name, email, role, password_hash, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name, role = EXCLUDED.role`,
          [id, estId, user.name, user.email, user.role, user.passwordHash, user.createdAt]
        );
      } catch (err) {
        logger.error('Erro ao persistir novo usuário operacional no PostgreSQL:', err);
      }
    }

    logger.audit(`Novo usuário operacional cadastrado: ${user.name} (${user.role})`, {
      userId: id,
      establishmentId: estId,
      email: user.email,
      role: user.role
    });

    return {
      id: user.id,
      establishmentId: user.establishmentId,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    };
  }

  async deleteOperationalUser(id: string, establishmentId?: string): Promise<boolean> {
    const user = this.operationalUsers.get(id);
    if (!user) {
      if (pgClient.isConnected) {
        try {
          const res = await pgClient.query('DELETE FROM users WHERE id = $1', [id]);
          return (res.rowCount || 0) > 0;
        } catch {
          return false;
        }
      }
      return false;
    }

    this.operationalUsers.delete(id);

    if (pgClient.isConnected) {
      try {
        const queryText = establishmentId
          ? 'DELETE FROM users WHERE id = $1 AND establishment_id = $2'
          : 'DELETE FROM users WHERE id = $1';
        const params = establishmentId ? [id, establishmentId] : [id];
        await pgClient.query(queryText, params);
      } catch (err) {
        logger.error('Erro ao deletar usuário operacional no PostgreSQL:', err);
      }
    }

    logger.audit(`Usuário operacional removido: ${user.name} (${user.role})`, { userId: id });
    return true;
  }

  async logout(token: string): Promise<boolean> {
    if (!token) return false;
    await this.revokeToken(token);
    logger.audit('Logout efetuado com sucesso (token revogado)');
    return true;
  }

  async updateMasterPassword(role: 'SUPERVISOR' | 'CONTROLLER', newPassword: string, establishmentId?: string): Promise<boolean> {
    const estId = establishmentId || process.env.DEFAULT_ESTABLISHMENT_ID || 'est-default';
    const newHash = await this.hashPassword(newPassword);
    let updated = false;

    for (const u of this.operationalUsers.values()) {
      if (u.role === role && (!establishmentId || u.establishmentId === establishmentId)) {
        u.passwordHash = newHash;
        updated = true;
      }
    }

    if (!updated) {
      const id = 'usr-' + role.toLowerCase() + '-master';
      this.operationalUsers.set(id, {
        id,
        establishmentId: estId,
        name: role === 'SUPERVISOR' ? 'Supervisor Master' : 'Controlador Master',
        email: `${role.toLowerCase()}@vozplay.ai.slz.br`,
        role,
        passwordHash: newHash,
        createdAt: new Date().toISOString()
      });
    }

    if (pgClient.isConnected) {
      try {
        const queryText = establishmentId
          ? 'UPDATE users SET password_hash = $1 WHERE role = $2 AND establishment_id = $3'
          : 'UPDATE users SET password_hash = $1 WHERE role = $2';
        const params = establishmentId ? [newHash, role, establishmentId] : [newHash, role];
        await pgClient.query(queryText, params);
      } catch (err) {
        logger.error('Erro ao atualizar senha no PostgreSQL:', err);
      }
    }

    logger.audit(`Senha mestre atualizada com Argon2id para perfil: ${role}`);
    return true;
  }

  async findUserByCredentials(emailOrRole: string, password: string, establishmentId?: string): Promise<OperationalUser | null> {
    if (!password) return null;

    // 1. Checa PostgreSQL com prioridade autoritativa
    if (pgClient.isConnected) {
      try {
        const queryText = establishmentId
          ? 'SELECT id, establishment_id, name, email, role, password_hash, created_at, last_login FROM users WHERE (email = $1 OR role = $1) AND (establishment_id = $2 OR role = \'SYSTEM_ADMIN\')'
          : 'SELECT id, establishment_id, name, email, role, password_hash, created_at, last_login FROM users WHERE email = $1 OR role = $1';
        const params = establishmentId ? [emailOrRole, establishmentId] : [emailOrRole];
        const res = await pgClient.query(queryText, params);
        if (res.rows.length > 0) {
          const row = res.rows[0];
          const matches = await this.verifyPassword(row.password_hash, password);
          if (matches) {
            const user: OperationalUser = {
              id: row.id,
              establishmentId: row.establishment_id,
              name: row.name,
              email: row.email,
              role: row.role,
              passwordHash: row.password_hash,
              createdAt: row.created_at,
              lastLogin: row.last_login
            };
            this.operationalUsers.set(user.id, user);
            return user;
          }
        }
      } catch (err) {
        logger.error('Erro ao consultar usuário operacional no PostgreSQL:', err);
      }
    }

    // 2. Checa cache em memória
    for (const u of this.operationalUsers.values()) {
      if (
        (u.email.toLowerCase() === emailOrRole.toLowerCase() || u.role === emailOrRole) &&
        (!establishmentId || u.establishmentId === establishmentId || u.role === 'SYSTEM_ADMIN')
      ) {
        const matches = await this.verifyPassword(u.passwordHash, password);
        if (matches) return u;
      }
    }

    return null;
  }

  /**
   * Hasheia token em SHA-256 para indexação segura no banco (nunca armazenar raw token)
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Emite um novo token com alta entropia criptográfica
   */
  async createToken(
    role: UserRole,
    establishmentId: string,
    sessionId: string,
    actorId: string,
    actorName: string,
    durationHours: number = 12
  ): Promise<AuthSession> {
    const rawToken = 'vp_' + role.toLowerCase() + '_' + crypto.randomBytes(32).toString('hex');
    const id = 'tok-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationHours * 3600 * 1000).toISOString();

    const session: AuthSession = {
      id,
      token: rawToken,
      role,
      establishmentId,
      sessionId,
      actorId,
      actorName,
      createdAt: now.toISOString(),
      expiresAt
    };

    // Armazena no cache de tokens ativos
    this.inMemoryTokens.set(rawToken, session);

    // Persiste no PostgreSQL com hash SHA-256
    if (pgClient.isConnected) {
      try {
        const tokenHash = this.hashToken(rawToken);
        await pgClient.query(
          `INSERT INTO auth_tokens (id, token_hash, role, establishment_id, session_id, actor_id, actor_name, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (token_hash) DO NOTHING`,
          [id, tokenHash, role, establishmentId, sessionId, actorId, actorName, expiresAt]
        );
      } catch (err) {
        logger.warn('Falha ao persistir token no PostgreSQL:', { error: String(err) });
      }
    }

    logger.audit(`Token emitido para ${role}: ${actorName}`, {
      actorRole: role,
      actorId,
      establishmentId,
      sessionId
    });

    return session;
  }

  /**
   * Valida token e recupera a sessão do usuário autoritativa
   */
  async verifyToken(token: string): Promise<AuthSession | null> {
    if (!token || typeof token !== 'string') return null;

    // 1. Checa memória
    const inMem = this.inMemoryTokens.get(token);
    if (inMem) {
      if (new Date(inMem.expiresAt).getTime() < Date.now()) {
        this.inMemoryTokens.delete(token);
        return null;
      }
      return inMem;
    }

    // 2. Checa PostgreSQL
    if (pgClient.isConnected) {
      try {
        const tokenHash = this.hashToken(token);
        const res = await pgClient.query(
          `SELECT id, role, establishment_id, session_id, actor_id, actor_name, expires_at, is_revoked
           FROM auth_tokens
           WHERE token_hash = $1 AND is_revoked = FALSE`,
          [tokenHash]
        );

        if (res.rows.length > 0) {
          const row = res.rows[0];
          if (new Date(row.expires_at).getTime() < Date.now()) {
            return null;
          }

          const session: AuthSession = {
            id: row.id,
            token,
            role: row.role as UserRole,
            establishmentId: row.establishment_id,
            sessionId: row.session_id,
            actorId: row.actor_id,
            actorName: row.actor_name,
            createdAt: new Date().toISOString(),
            expiresAt: row.expires_at
          };

          this.inMemoryTokens.set(token, session);
          return session;
        }
      } catch (err) {
        logger.error('Erro ao verificar token no PostgreSQL:', err);
      }
    }

    return null;
  }

  /**
   * Revoga um token ativo
   */
  async revokeToken(token: string): Promise<void> {
    this.inMemoryTokens.delete(token);
    if (pgClient.isConnected) {
      try {
        const tokenHash = this.hashToken(token);
        await pgClient.query('UPDATE auth_tokens SET is_revoked = TRUE WHERE token_hash = $1', [tokenHash]);
      } catch (err) {
        logger.error('Erro ao revogar token no PostgreSQL:', err);
      }
    }
  }

  /**
   * Revoga todos os tokens ativos para um papel específico (ex: revogar controladores no takeover - Requisito 18)
   */
  async revokeRoleTokens(role: UserRole, establishmentId?: string): Promise<number> {
    let count = 0;
    for (const [token, session] of this.inMemoryTokens.entries()) {
      if (session.role === role && (!establishmentId || session.establishmentId === establishmentId)) {
        this.inMemoryTokens.delete(token);
        count++;
      }
    }

    if (pgClient.isConnected) {
      try {
        if (establishmentId) {
          await pgClient.query(
            'UPDATE auth_tokens SET is_revoked = TRUE WHERE role = $1 AND establishment_id = $2',
            [role, establishmentId]
          );
        } else {
          await pgClient.query('UPDATE auth_tokens SET is_revoked = TRUE WHERE role = $1', [role]);
        }
      } catch (err) {
        logger.error('Erro ao revogar tokens por papel no PostgreSQL:', err);
      }
    }

    logger.security(`Tokens do papel ${role} revogados (${count} em cache) para estabelecimento ${establishmentId || 'global'}`);
    return count;
  }

  /**
   * Autenticação de credencial do Supervisor (Argon2id estrito, sem fallback hardcoded)
   */
  async verifySupervisorPassword(password: string, establishmentId?: string): Promise<boolean> {
    if (!password) return false;
    if (pgClient.isConnected) {
      try {
        const queryText = establishmentId
          ? 'SELECT password_hash FROM users WHERE (role = \'SUPERVISOR\' OR role = \'SYSTEM_ADMIN\') AND (establishment_id = $1 OR role = \'SYSTEM_ADMIN\')'
          : 'SELECT password_hash FROM users WHERE role = \'SUPERVISOR\' OR role = \'SYSTEM_ADMIN\'';
        const params = establishmentId ? [establishmentId] : [];
        const res = await pgClient.query(queryText, params);
        for (const row of res.rows) {
          if (await this.verifyPassword(row.password_hash, password)) {
            return true;
          }
        }
      } catch (err) {
        logger.error('Erro ao verificar senha de supervisor no PostgreSQL:', err);
      }
    }
    for (const u of this.operationalUsers.values()) {
      if ((u.role === 'SUPERVISOR' || u.role === 'SYSTEM_ADMIN') && (!establishmentId || u.establishmentId === establishmentId || u.role === 'SYSTEM_ADMIN')) {
        const matches = await this.verifyPassword(u.passwordHash, password);
        if (matches) return true;
      }
    }
    return false;
  }

  /**
   * Autenticação de credencial do Controlador (Argon2id estrito, sem fallback hardcoded)
   */
  async verifyControllerPassword(password: string, establishmentId?: string): Promise<boolean> {
    if (!password) return false;
    if (pgClient.isConnected) {
      try {
        const queryText = establishmentId
          ? 'SELECT password_hash FROM users WHERE role = \'CONTROLLER\' AND (establishment_id = $1 OR establishment_id IS NULL)'
          : 'SELECT password_hash FROM users WHERE role = \'CONTROLLER\'';
        const params = establishmentId ? [establishmentId] : [];
        const res = await pgClient.query(queryText, params);
        for (const row of res.rows) {
          if (await this.verifyPassword(row.password_hash, password)) {
            return true;
          }
        }
      } catch (err) {
        logger.error('Erro ao verificar senha de controlador no PostgreSQL:', err);
      }
    }
    for (const u of this.operationalUsers.values()) {
      if (u.role === 'CONTROLLER' && (!establishmentId || u.establishmentId === establishmentId)) {
        const matches = await this.verifyPassword(u.passwordHash, password);
        if (matches) return true;
      }
    }
    return false;
  }
}

export const authService = new AuthService();

/**
 * Middleware Express para extrair o usuário autenticado EXCLUSIVAMENTE via Bearer Token
 * Nenhum cabeçalho x-client-role ou equivalente confere permissões.
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  if (token) {
    const session = await authService.verifyToken(token);
    if (session) {
      req.user = session;
    }
  }

  next();
}

/**
 * Middleware Express para exigir autenticação válida
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    logger.security('Acesso bloqueado: Credencial não autenticada', {
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    return res.status(401).json({
      success: false,
      error: 'Autenticação necessária para acessar este recurso. Forneça Authorization: Bearer <token>.',
      code: 'UNAUTHORIZED',
      requestId: req.requestId
    });
  }
  next();
}

/**
 * Middleware Express para exigir papéis específicos (RBAC Real e Rígido)
 * Proibido qualquer bypass por x-client-role. A autoridade é 100% derivada do token validado.
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      logger.security(`Acesso rejeitado (401): Rota protegida requer token para papéis [${allowedRoles.join(', ')}]`, {
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      return res.status(401).json({
        success: false,
        error: 'Acesso restrito. Credencial de autorização não fornecida ou inválida.',
        code: 'UNAUTHORIZED',
        requestId: req.requestId
      });
    }

    if (!allowedRoles.includes(req.user.role) && req.user.role !== 'SYSTEM_ADMIN') {
      logger.security(`Acesso negado (403): Papel '${req.user.role}' tentou acessar rota restrita a [${allowedRoles.join(', ')}]`, {
        actorId: req.user.actorId,
        actorRole: req.user.role,
        establishmentId: req.user.establishmentId,
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      return res.status(403).json({
        success: false,
        error: `Acesso negado. Ação restrita aos papéis: ${allowedRoles.join(', ')}.`,
        code: 'FORBIDDEN',
        requestId: req.requestId
      });
    }

    next();
  };
}

/**
 * Middleware para garantir isolamento por estabelecimento (Multi-Tenant Real)
 * Impede que um usuário com token de um bar/lounge acesse dados de outro estabelecimento.
 */
export function enforceTenantIsolation(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return next();

  const targetEstId = (req.params.establishmentId || req.body?.establishmentId || req.query?.establishmentId) as string;

  if (targetEstId && targetEstId !== req.user.establishmentId) {
    logger.security(`Violação multi-tenant bloqueada: Tentativa de cross-tenant access.`, {
      actorId: req.user.actorId,
      actorEstablishment: req.user.establishmentId,
      targetEstablishment: targetEstId,
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    return res.status(403).json({
      success: false,
      error: 'Acesso negado. Você não tem permissão para interagir com dados de outro estabelecimento.',
      code: 'CROSS_TENANT_FORBIDDEN',
      requestId: req.requestId
    });
  }

  next();
}
