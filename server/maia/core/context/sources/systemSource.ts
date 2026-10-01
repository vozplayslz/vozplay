/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA SYSTEM, PERMISSIONS & CAPABILITIES CONTEXT SOURCE
 * Fornece permissões reais (para validação pelo Policy Engine), capacidades do ambiente,
 * canal de interação e parâmetros de voz preparados.
 */

import {
  IContextSource,
  PermissionContext,
  CapabilityContext,
  EnvironmentContext,
  VoiceContext,
  ContextSourceResolutionContext,
  ContextPriorityLevel,
  ContextChannel,
  ContextInterface
} from '../types.js';

export interface SystemResolution {
  permissions: PermissionContext;
  capabilities: CapabilityContext;
  environment: EnvironmentContext;
  voice: VoiceContext;
}

export class SystemContextSource implements IContextSource<SystemResolution> {
  public readonly name = 'SystemSource';
  public readonly priority: ContextPriorityLevel = 'P1_USER_SESSION';

  public resolve(context: ContextSourceResolutionContext): SystemResolution {
    const role = (context.role || 'ANONYMOUS').toUpperCase();

    // Mapeamento de permissões canônicas reais
    let perms: readonly string[] = ['queue.read', 'music.browse'];
    let canActions = false;
    let canCritical = false;

    if (role === 'SUPERVISOR' || role === 'SYSTEM_ADMIN') {
      perms = ['*'];
      canActions = true;
      canCritical = true;
    } else if (role === 'CONTROLLER') {
      perms = ['queue.read', 'queue.write', 'session.read', 'soundboard.play', 'alert.broadcast'];
      canActions = true;
      canCritical = false;
    } else if (role === 'PARTICIPANT') {
      perms = ['queue.read', 'music.browse', 'participant.turn.read'];
      canActions = false;
      canCritical = false;
    }

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
      permissions: {
        permissions: perms,
        effectiveScope: role === 'SUPERVISOR' ? 'TENANT_ADMIN' : 'SELF_TENANT',
        canExecuteActions: canActions,
        canExecuteCritical: canCritical
      },
      capabilities: {
        voice: context.profile === 'voice' || channel === 'voice',
        queue: true,
        notifications: true,
        tv: true,
        djSoundboard: role === 'CONTROLLER' || role === 'SUPERVISOR',
        songRecommendations: true
      },
      environment: {
        channel,
        interface: iface,
        clientVersion: '2.0.0',
        runtime: 'node-express'
      },
      voice: {
        isVoiceActive: context.profile === 'voice' || channel === 'voice',
        preferredVoiceId: 'Aoede',
        speechRate: 1.0
      }
    };
  }
}

export const systemContextSource = new SystemContextSource();
