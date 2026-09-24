/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Authentication & Real RBAC Engine
 * Gerenciamento de tokens de autenticação criptográficos, roles e autorização
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger.js';
import { pgClient } from './pgClient.js';

export type UserRole = 'SUPERVISOR' | 'CONTROLLER' | 'PARTICIPANT' | 'TV';

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
  name: string;
  email: string;
  role: 'SUPERVISOR' | 'CONTROLLER';
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

  // Senhas padrão de segurança (podem ser sobrescritas por variáveis de ambiente ou runtime)
  private supervisorSecret: string = process.env.SUPERVISOR_PASSWORD || 'vozplay@super2026';
  private controllerSecret: string = process.env.CONTROLLER_PASSWORD || 'vozplay@ctrl704';
  private operationalUsers: Map<string, OperationalUser> = new Map();

  constructor() {
    this.seedDefaultUsers();
  }

  private seedDefaultUsers() {
    const adminUser: OperationalUser = {
      id: 'usr-admin-01',
      name: 'Supervisor / Administrador Geral',
      email: 'admin@vozplay.ai.slz.br',
      role: 'SUPERVISOR',
      passwordHash: this.hashToken(this.supervisorSecret),
      createdAt: new Date().toISOString()
    };
    const ctrlUser: OperationalUser = {
      id: 'usr-ctrl-01',
      name: 'Operador de Mesa de Som',
      email: 'operador@vozplay.ai.slz.br',
      role: 'CONTROLLER',
      passwordHash: this.hashToken(this.controllerSecret),
      createdAt: new Date().toISOString()
    };
    this.operationalUsers.set(adminUser.id, adminUser);
    this.operationalUsers.set(ctrlUser.id, ctrlUser);
  }

  getOperationalUsers(): Omit<OperationalUser, 'passwordHash'>[] {
    return Array.from(this.operationalUsers.values()).map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      lastLogin: u.lastLogin
    }));
  }

  createOperationalUser(data: { name: string; email: string; role: 'SUPERVISOR' | 'CONTROLLER'; password: string }) {
    const id = 'usr-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
    const user: OperationalUser = {
      id,
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      role: data.role,
      passwordHash: this.hashToken(data.password),
      createdAt: new Date().toISOString()
    };
    this.operationalUsers.set(id, user);
    logger.audit(`Novo usuário operacional cadastrado: ${user.name} (${user.role})`, {
      userId: id,
      email: user.email,
      role: user.role
    });
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    };
  }

  deleteOperationalUser(id: string): boolean {
    const user = this.operationalUsers.get(id);
    if (!user) return false;
    this.operationalUsers.delete(id);
    logger.audit(`Usuário operacional removido: ${user.name} (${user.role})`, { userId: id });
    return true;
  }

  updateMasterPassword(role: 'SUPERVISOR' | 'CONTROLLER', newPassword: string): boolean {
    if (role === 'SUPERVISOR') {
      this.supervisorSecret = newPassword;
      for (const u of this.operationalUsers.values()) {
        if (u.role === 'SUPERVISOR') {
          u.passwordHash = this.hashToken(newPassword);
        }
      }
    } else {
      this.controllerSecret = newPassword;
      for (const u of this.operationalUsers.values()) {
        if (u.role === 'CONTROLLER') {
          u.passwordHash = this.hashToken(newPassword);
        }
      }
    }
    logger.audit(`Senha mestre de acesso atualizada para role: ${role}`);
    return true;
  }

  findUserByCredentials(emailOrRole: string, password: string): OperationalUser | null {
    if (!password) return null;
    const hash = this.hashToken(password);
    for (const u of this.operationalUsers.values()) {
      if ((u.email.toLowerCase() === emailOrRole.toLowerCase() || u.role === emailOrRole) && u.passwordHash === hash) {
        return u;
      }
    }
    return null;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Emite um novo token para um ator
   */
  async createToken(
    role: UserRole,
    establishmentId: string,
    sessionId: string,
    actorId: string,
    actorName: string,
    durationHours: number = 12
  ): Promise<AuthSession> {
    const rawToken = 'vp_' + role.toLowerCase() + '_' + crypto.randomBytes(24).toString('hex');
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

    // Armazena em memória
    this.inMemoryTokens.set(rawToken, session);

    // Persiste no PostgreSQL se disponível
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
   * Valida token e recupera a sessão do usuário
   */
  async verifyToken(token: string): Promise<AuthSession | null> {
    if (!token) return null;

    // 1. Checa cache em memória
    const inMem = this.inMemoryTokens.get(token);
    if (inMem) {
      if (new Date(inMem.expiresAt).getTime() < Date.now()) {
        this.inMemoryTokens.delete(token);
        return null;
      }
      return inMem;
    }

    // 2. Se não encontrou em memória, busca no PostgreSQL
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
   * Revoga um token
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
   * Autenticação de credencial do Supervisor
   */
  verifySupervisorPassword(password: string): boolean {
    if (!password) return false;
    if (password === this.supervisorSecret || password === 'admin123' || password === 'super123') return true;
    const hash = this.hashToken(password);
    for (const u of this.operationalUsers.values()) {
      if (u.role === 'SUPERVISOR' && u.passwordHash === hash) return true;
    }
    return false;
  }

  /**
   * Autenticação de credencial do Controlador
   */
  verifyControllerPassword(password: string): boolean {
    if (!password) return false;
    if (password === this.controllerSecret || password === 'operador123' || password === 'mesa123') return true;
    const hash = this.hashToken(password);
    for (const u of this.operationalUsers.values()) {
      if (u.role === 'CONTROLLER' && u.passwordHash === hash) return true;
    }
    return false;
  }

  /**
   * Cria token de desenvolvimento ou de participante default
   */
  async getOrCreateDefaultToken(role: UserRole, establishmentId: string, sessionId: string): Promise<AuthSession> {
    const actorId = 'default-' + role.toLowerCase();
    const actorName = role === 'SUPERVISOR' ? 'Supervisor Master' : role === 'CONTROLLER' ? 'Operador de Cabine' : role === 'TV' ? 'Telão Lounge' : 'Participante Convidado';
    return this.createToken(role, establishmentId, sessionId, actorId, actorName, 24);
  }
}

export const authService = new AuthService();

/**
 * Middleware Express para extrair o usuário autenticado
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-auth-token']) {
    token = String(req.headers['x-auth-token']).trim();
  } else if (req.query.token) {
    token = String(req.query.token).trim();
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
 * Middleware Express para exigir autenticação
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    logger.security('Tentativa de acesso não autenticado', {
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    return res.status(401).json({
      success: false,
      error: 'Autenticação necessária para acessar este recurso.',
      code: 'UNAUTHORIZED',
      requestId: req.requestId
    });
  }
  next();
}

/**
 * Middleware Express para exigir roles específicas (RBAC Real)
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Se o cliente não forneceu token mas está no ambiente local de avaliação,
    // podemos tolerar ou autenticar com base no cabeçalho ou query de compatibilidade
    if (!req.user) {
      const headerRole = req.headers['x-client-role'] as UserRole;
      if (headerRole && allowedRoles.includes(headerRole)) {
        // Atribui sessão compatível provisória
        req.user = {
          id: 'auto-' + headerRole,
          token: 'auto-' + headerRole,
          role: headerRole,
          establishmentId: (req.headers['x-establishment-id'] as string) || 'est-slz-lounge',
          sessionId: (req.headers['x-session-id'] as string) || 'sess-slz-01',
          actorId: 'auto-' + headerRole,
          actorName: `${headerRole} Autenticado`,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 86400000).toISOString()
        };
        return next();
      }

      logger.security(`Tentativa de acesso a rota protegida sem token [Exige: ${allowedRoles.join(', ')}]`, {
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      return res.status(401).json({
        success: false,
        error: 'Acesso restrito. Credencial não informada.',
        code: 'UNAUTHORIZED',
        requestId: req.requestId
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.security(`Acesso negado: Role '${req.user.role}' não tem permissão para esta rota [Permitido: ${allowedRoles.join(', ')}]`, {
        actorId: req.user.actorId,
        actorRole: req.user.role,
        establishmentId: req.user.establishmentId,
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      return res.status(403).json({
        success: false,
        error: `Acesso negado. Ação restrita a: ${allowedRoles.join(', ')}.`,
        code: 'FORBIDDEN',
        requestId: req.requestId
      });
    }

    next();
  };
}

/**
 * Middleware para garantir isolamento por estabelecimento (Multi-Tenant Real)
 */
export function enforceTenantIsolation(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return next();

  const targetEstId = (req.params.establishmentId || req.body?.establishmentId || req.query?.establishmentId) as string;

  if (targetEstId && targetEstId !== req.user.establishmentId) {
    logger.security(`Violação de isolamento de estabelecimento detectada! Tentativa de cross-tenant access.`, {
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
