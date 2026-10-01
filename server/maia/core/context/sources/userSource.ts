/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA USER & ROLE CONTEXT SOURCE
 * Fornece a identidade do usuário e o papel RBAC derivados estritamente da autenticação real.
 * Rejeita categoricamente qualquer tentativa do usuário de declarar seu papel via texto.
 */

import {
  IContextSource,
  UserContext,
  RoleContext,
  ContextSourceResolutionContext,
  ContextPriorityLevel,
  ContextChannel,
  ContextInterface
} from '../types.js';

export interface UserAndRoleResolution {
  user: UserContext;
  role: RoleContext;
}

export class UserContextSource implements IContextSource<UserAndRoleResolution> {
  public readonly name = 'UserSource';
  public readonly priority: ContextPriorityLevel = 'P1_USER_SESSION';

  public resolve(context: ContextSourceResolutionContext): UserAndRoleResolution {
    const rawRole = (context.role || 'ANONYMOUS').toUpperCase();

    // Validação estrita do papel do usuário contra a matriz oficial
    let validRole: RoleContext['role'] = 'ANONYMOUS';
    let isPrivileged = false;

    if (rawRole === 'SUPERVISOR' || rawRole === 'SYSTEM_ADMIN') {
      validRole = rawRole as RoleContext['role'];
      isPrivileged = true;
    } else if (rawRole === 'CONTROLLER') {
      validRole = 'CONTROLLER';
      isPrivileged = true;
    } else if (rawRole === 'PARTICIPANT') {
      validRole = 'PARTICIPANT';
      isPrivileged = false;
    } else if (rawRole === 'TV') {
      validRole = 'TV';
      isPrivileged = false;
    }

    const userId = context.userId || 'anon-actor';
    const rawDisplayName = context.profile === 'tv'
      ? 'Telão Lounge'
      : (context.profile === 'operator' ? 'Operador de Mesa' : 'Participante');

    const channel: ContextChannel = context.channel || (
      context.profile === 'tv' ? 'tv' :
      context.profile === 'operator' ? 'controller' :
      context.profile === 'voice' ? 'voice' : 'mobile'
    );

    const iface: ContextInterface = context.interface || (
      context.profile === 'tv' ? 'tv-display' :
      context.profile === 'operator' ? 'controller-desk' :
      context.profile === 'supervisor' ? 'supervisor-pwa' :
      context.profile === 'voice' ? 'voice-interface' : 'participant-pwa'
    );

    return {
      user: {
        userId,
        displayName: rawDisplayName,
        isDisplayNameUntrusted: false, // Normalizado pelo sistema
        authenticated: validRole !== 'ANONYMOUS',
        authSource: validRole !== 'ANONYMOUS' ? 'BEARER_TOKEN' : 'ANONYMOUS',
        channel,
        interface: iface
      },
      role: {
        role: validRole,
        roleSource: validRole !== 'ANONYMOUS' ? 'AUTHENTICATED_CREDENTIAL' : 'SYSTEM_DEFAULT',
        isPrivileged
      }
    };
  }
}

export const userContextSource = new UserContextSource();
