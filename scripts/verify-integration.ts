/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Script de Verificação e Bateria de Testes de Integração & Hardening - VozPlay
 * Cobre: Zero Bypass por Headers, RBAC Real com Bearer Tokens, Argon2id,
 * Transições de Fila, Sanitização de TVSessionDTO, Anti-Monopólio, LGPD e Recuperação.
 */

import 'dotenv/config';

const BASE_URL = 'http://127.0.0.1:3000';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

async function assert(condition: boolean, name: string, failureDetails?: string) {
  if (condition) {
    results.push({ name, passed: true });
    console.log(`  ✅ [PASS] ${name}`);
  } else {
    results.push({ name, passed: false, details: failureDetails });
    console.error(`  ❌ [FAIL] ${name}: ${failureDetails || 'Assertion failed'}`);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('  VOZPLAY - BATERIA DE TESTES DE INTEGRAÇÃO & HARDENING CRÍTICO ');
  console.log('================================================================\n');

  try {
    // 1. Health Check, Liveness & Readiness
    console.log('1. Testando Observabilidade e Health Checks...');
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthData = await healthRes.json();
    await assert(healthRes.status === 200, 'Health check responde com status 200');
    await assert(healthData.service === 'VozPlay Core Platform', 'Identificação do serviço correta');
    await assert(healthData.domain === 'vozplay.ai.slz.br', 'Domínio oficial configurado: vozplay.ai.slz.br');

    const livenessRes = await fetch(`${BASE_URL}/liveness`);
    await assert(livenessRes.status === 200, 'Endpoint de liveness responde 200');

    const readinessRes = await fetch(`${BASE_URL}/readiness`);
    await assert(readinessRes.status === 200, 'Endpoint de readiness responde 200');

    // 2. TVSessionDTO Sanitization (Privacidade Absoluta - Seção 27)
    console.log('\n2. Testando Sanitização e Privacidade Absoluta do TVSessionDTO...');
    const tvRes = await fetch(`${BASE_URL}/api/v1/tv/session`);
    const tvData = await tvRes.json();
    await assert(tvRes.status === 200, 'TV endpoint responde com status 200');
    await assert(tvData.success === true, 'TV endpoint retorna sucesso');
    
    const tvPayloadStr = JSON.stringify(tvData);
    const containsPhone = /whatsapp|telefone|\+55|\(98\)/i.test(tvPayloadStr);
    const containsToken = /"token"|"authToken"|"secret"/i.test(tvPayloadStr);
    await assert(!containsPhone, 'TVSessionDTO NUNCA expõe dados de WhatsApp ou telefone de clientes');
    await assert(!containsToken, 'TVSessionDTO NUNCA expõe tokens de acesso ou segredos de sessão');
    await assert(tvData.data.branding !== undefined, 'TVSessionDTO inclui tokens de branding visual');

    // 3. Eliminação Absoluta de Bypass por Headers (Zero Bypass / Requisito 2)
    console.log('\n3. Testando Eliminação Absoluta de Bypass por Headers (x-client-role)...');
    const anonRes = await fetch(`${BASE_URL}/api/v1/controller/presence-code`);
    await assert(anonRes.status === 401, 'Acesso anônimo bloqueado com 401');

    const fakeCtrlHeaderRes = await fetch(`${BASE_URL}/api/v1/controller/presence-code`, {
      headers: { 'x-client-role': 'CONTROLLER' }
    });
    await assert(fakeCtrlHeaderRes.status === 401, 'Bypass por header "x-client-role: CONTROLLER" terminantemente rejeitado com 401');

    const fakeSuperHeaderRes = await fetch(`${BASE_URL}/api/v1/leads`, {
      headers: { 'x-client-role': 'SUPERVISOR' }
    });
    await assert(fakeSuperHeaderRes.status === 401, 'Bypass por header "x-client-role: SUPERVISOR" terminantemente rejeitado com 401');

    // 4. Autenticação Real com Argon2id e Bearer Tokens (RBAC Real / Requisitos 3, 5 e 6)
    console.log('\n4. Testando Autenticação Segura com Argon2id e Emissão de Bearer Tokens...');
    
    // Tentativa com senha errada
    const badLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'SUPERVISOR', password: 'senha_completamente_incorreta' })
    });
    await assert(badLoginRes.status === 401, 'Login com senha incorreta rejeitado com 401');

    // Login autêntico como Controlador
    const ctrlPass = process.env.CONTROLLER_PASSWORD || 'VozPlay@SoundDesk704!SLZ';
    const ctrlLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'CONTROLLER', password: ctrlPass })
    });
    const ctrlLoginData = await ctrlLoginRes.json();
    await assert(ctrlLoginRes.status === 200 && Boolean(ctrlLoginData.token), 'Login do Controlador autêntico retorna Bearer Token');
    const controllerToken = ctrlLoginData.token;

    // Login autêntico como Supervisor
    const superPass = process.env.SUPERVISOR_PASSWORD || 'VozPlay@SuperAdmin2026!SLZ';
    const superLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'SUPERVISOR', password: superPass })
    });
    const superLoginData = await superLoginRes.json();
    await assert(superLoginRes.status === 200 && Boolean(superLoginData.token), 'Login do Supervisor autêntico retorna Bearer Token');
    const supervisorToken = superLoginData.token;

    // 5. Segregação Rígida de Papéis (RBAC - Requisito 3)
    console.log('\n5. Testando Segregação Rígida de Papéis (RBAC Permissions)...');
    
    // Controlador com token tenta acessar rota exclusiva do Supervisor (/leads)
    const ctrlForbiddenRes = await fetch(`${BASE_URL}/api/v1/leads`, {
      headers: { 'Authorization': `Bearer ${controllerToken}` }
    });
    await assert(ctrlForbiddenRes.status === 403, 'Controlador impedido de acessar recurso exclusivo de Supervisor (403 Forbidden)');

    // Supervisor com token acessa rota do Supervisor com sucesso
    const superAllowedRes = await fetch(`${BASE_URL}/api/v1/leads`, {
      headers: { 'Authorization': `Bearer ${supervisorToken}` }
    });
    await assert(superAllowedRes.status === 200, 'Supervisor autorizado acessa recurso administrativo (200 OK)');

    // Controlador com token acessa rota da mesa com sucesso
    const authCodeRes = await fetch(`${BASE_URL}/api/v1/controller/presence-code`, {
      headers: { 'Authorization': `Bearer ${controllerToken}` }
    });
    const codeData = await authCodeRes.json();
    await assert(authCodeRes.status === 200, 'Controlador com Bearer token obtém código de presença');
    await assert(codeData.presenceCode?.code?.length === 4, 'Código de presença possui exatamente 4 dígitos numéricos');
    await assert(codeData.presenceCode?.remainingSeconds <= 60, 'Código de presença respeita janela máxima de 60 segundos');

    const validCode = codeData.presenceCode.code;

    // 6. Registro de Participante, Token Criptográfico e Presença Física
    console.log('\n6. Testando Registro de Participante, Token e Presença Física...');
    const regRes = await fetch(`${BASE_URL}/api/v1/participants/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Cantor QA Automatizado',
        whatsapp: '(98) 98888-7777',
        consentMarketing: true
      })
    });
    const regData = await regRes.json();
    await assert(regRes.status === 200, 'Participante registrado com sucesso');
    await assert(regData.participant.isVerified === false, 'Participante inicia com status isVerified = false');
    await assert(Boolean(regData.token), 'Participante recebe token de sessão criptográfico na resposta');

    const participantId = regData.participant.id;
    const participantToken = regData.token;

    // Tentativa com código de presença inválido
    const invalidVerifyRes = await fetch(`${BASE_URL}/api/v1/participants/verify-presence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${participantToken}`
      },
      body: JSON.stringify({
        participantId,
        code: '9999'
      })
    });
    await assert(invalidVerifyRes.status === 400, 'Código de presença incorreto rejeitado com 400');

    // Validação com código correto de 60 segundos
    const validVerifyRes = await fetch(`${BASE_URL}/api/v1/participants/verify-presence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${participantToken}`
      },
      body: JSON.stringify({
        participantId,
        code: validCode
      })
    });
    const validVerifyData = await validVerifyRes.json();
    await assert(validVerifyRes.status === 200, 'Presença física validada com código correto');
    await assert(validVerifyData.participant.isVerified === true, 'Participante agora possui isVerified = true');

    // 7. Catálogo Musical e Integridade de Versões
    console.log('\n7. Testando Catálogo Musical e Filtros...');
    const musicRes = await fetch(`${BASE_URL}/api/v1/music?genre=Sertanejo`);
    const musicData = await musicRes.json();
    await assert(musicRes.status === 200, 'Busca no catálogo retorna 200');
    await assert(musicData.data.length > 0, 'Músicas do gênero Sertanejo encontradas');
    await assert(musicData.data.every((m: any) => m.genre === 'Sertanejo'), 'Todas as músicas filtradas pertencem ao gênero solicitado');

    const sampleMusic = musicData.data[0];

    // 8. Enfileiramento Anti-Monopólio e Determinismo
    console.log('\n8. Testando Enfileiramento Anti-Monopólio...');
    const queueAddRes = await fetch(`${BASE_URL}/api/v1/queue/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${participantToken}`
      },
      body: JSON.stringify({
        participantId,
        musicId: sampleMusic.id,
        versionId: sampleMusic.versions[0].id,
        toneOffset: 1
      })
    });
    const queueAddData = await queueAddRes.json();
    await assert(queueAddRes.status === 200, 'Música adicionada à fila com sucesso');
    await assert(queueAddData.queueItem?.status === 'QUEUED', 'Música enfileirada com status QUEUED');
    await assert(queueAddData.queueItem?.participantDisplayName === 'Cantor QA Automatizado', 'Nome do participante preservado');
    await assert(typeof queueAddData.queueItem?.orderIndex === 'number', 'Item da fila possui orderIndex determinístico');

    const queueItemId = queueAddData.queueItem.id;

    // 9. Acompanhar Minha Vez (Public Tracker) e Privacidade
    console.log('\n9. Testando Acompanhar Minha Vez (Public Tracker)...');
    const trackerRes = await fetch(`${BASE_URL}/api/v1/tracker/${queueItemId}`);
    const trackerData = await trackerRes.json();
    await assert(trackerRes.status === 200, 'Tracker público responde 200 para item enfileirado');
    await assert(trackerData.data.musicTitle === sampleMusic.title, 'Título da música correto no tracker');
    await assert(typeof trackerData.data.positionInQueue === 'number' || trackerData.data.positionInQueue === 'Cantando Agora!', 'Posição na fila calculada');
    
    const trackerStr = JSON.stringify(trackerData);
    await assert(!/whatsapp|telefone|\+55|\(98\)/i.test(trackerStr), 'Tracker NUNCA expõe WhatsApp ou telefone do cantor');

    // 10. Chamar Próximo Participante (Janela de 30s & Transição Atômica)
    console.log('\n10. Testando Chamada Atômica do Próximo Participante...');
    // Cancela qualquer chamada pendente para garantir estado limpo
    await fetch(`${BASE_URL}/api/v1/controller/call-cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${controllerToken}`
      }
    });

    // Promove a música do teste atual para o topo da fila ativa
    await fetch(`${BASE_URL}/api/v1/controller/queue/promote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${controllerToken}`
      },
      body: JSON.stringify({ queueItemId })
    });

    const callNextRes = await fetch(`${BASE_URL}/api/v1/controller/call-next`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${controllerToken}`
      }
    });
    const callNextData = await callNextRes.json();
    await assert(callNextRes.status === 200, 'Controlador chama próximo participante com sucesso');
    await assert(callNextData.callingState?.remainingSeconds === 30, 'Janela autoritativa de 30 segundos ativada');
    await assert(callNextData.callingState?.participantId === participantId, 'Participante chamado é o dono da música');

    // 11. Início da Apresentação ("Começar a Cantar")
    console.log('\n11. Testando Início da Apresentação pelo Participante...');
    const startTurnRes = await fetch(`${BASE_URL}/api/v1/participant/start-turn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${participantToken}`
      },
      body: JSON.stringify({
        participantId,
        queueItemId
      })
    });
    const startTurnData = await startTurnRes.json();
    await assert(startTurnRes.status === 200, 'Apresentação iniciada com sucesso ("Começar a Cantar")');
    await assert(startTurnData.item?.status === 'PLAYING', 'Item da fila transicionou para PLAYING');
    await assert(startTurnData.playbackState?.status === 'PLAYING', 'Estado global de reprodução atualizado para PLAYING');

    // 12. Reações em Tempo Real da Plateia
    console.log('\n12. Testando Reações ao Vivo da Plateia...');
    const reactionRes = await fetch(`${BASE_URL}/api/v1/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantName: 'Mesa 4',
        emoji: '🔥',
        label: 'Fogo'
      })
    });
    const reactionData = await reactionRes.json();
    await assert(reactionRes.status === 200, 'Reação da plateia disparada com sucesso');
    await assert(reactionData.reaction?.emoji === '🔥', 'Emoji da reação registrado corretamente');

    // 13. DJ Soundboard do Controlador (com Bearer Token)
    console.log('\n13. Testando DJ Soundboard com Credencial do Controlador...');
    const soundboardRes = await fetch(`${BASE_URL}/api/v1/controller/soundboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${controllerToken}`
      },
      body: JSON.stringify({
        soundType: 'airhorn',
        label: 'Air Horn'
      })
    });
    const soundboardData = await soundboardRes.json();
    await assert(soundboardRes.status === 200, 'Efeito de soundboard acionado pelo Controlador');
    await assert(soundboardData.payload?.soundType === 'airhorn', 'Efeito sonoro registrado');

    // 14. Assunção Emergencial (Emergency Takeover com Bearer Token)
    console.log('\n14. Testando Assunção Emergencial do Supervisor...');
    const takeoverRes = await fetch(`${BASE_URL}/api/v1/supervisor/takeover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supervisorToken}`
      }
    });
    const takeoverData = await takeoverRes.json();
    await assert(takeoverRes.status === 200, 'Supervisor assume controle emergencial');
    await assert(takeoverData.presenceCode?.code?.length === 4, 'Código de presença renovado instantaneamente no takeover');

    // Verifica que o token do controlador anterior foi imediatamente revogado (Requisito 18)
    const revokedCtrlRes = await fetch(`${BASE_URL}/api/v1/controller/presence-code`, {
      headers: { 'Authorization': `Bearer ${controllerToken}` }
    });
    await assert(revokedCtrlRes.status === 401, 'Token do controlador anterior foi revogado no Takeover (401)');

    // 15. Gestão e Exportação de Leads (LGPD com Bearer Token)
    console.log('\n15. Testando Consulta e Exportação de Leads pelo Supervisor...');
    const leadsRes = await fetch(`${BASE_URL}/api/v1/leads`, {
      headers: { 'Authorization': `Bearer ${supervisorToken}` }
    });
    const leadsData = await leadsRes.json();
    await assert(leadsRes.status === 200, 'Supervisor consulta lista de leads coletados');
    const leadsList = leadsData.leads || leadsData.data || [];
    await assert(leadsList.length > 0, 'Leads encontrados na base de dados');

    const exportRes = await fetch(`${BASE_URL}/api/v1/leads/export.csv`, {
      headers: { 'Authorization': `Bearer ${supervisorToken}` }
    });
    const csvContent = await exportRes.text();
    await assert(exportRes.status === 200, 'Exportação de leads em formato CSV responde com 200');
    await assert(csvContent.includes('Nome') && csvContent.includes('WhatsApp'), 'Cabeçalho CSV de leads formatado corretamente');

    // 16. Conclusão da Música e Próxima Faixa (Supervisor controlando a mesa)
    console.log('\n16. Testando Transição de Fim de Música pelo Operador Ativo...');
    const nextSongRes = await fetch(`${BASE_URL}/api/v1/controller/next`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supervisorToken}`
      }
    });
    const nextSongData = await nextSongRes.json();
    await assert(nextSongRes.status === 200, 'Controlador avança/finaliza música com sucesso');

    // 17. Isolamento de Produção & Ausência de Seed Fictício (Requisito 12)
    console.log('\n17. Testando Isolamento de Produção (Zero Seed Fictício)...');
    const sessionRes = await fetch(`${BASE_URL}/api/v1/session`);
    const sessionData = await sessionRes.json();
    await assert(sessionRes.status === 200, 'Estado da sessão consultado com sucesso');
    await assert(sessionData.data.status === 'ACTIVE', 'Sessão permanece ativa e íntegra');
    
    // Assegura que nenhum dado fictício de demonstração foi criado silenciosamente
    const sessionPayloadStr = JSON.stringify(sessionData);
    await assert(!sessionPayloadStr.includes('João Silva'), 'Nenhum cantor demonstrativo fictício ("João Silva") gerado em produção');
    await assert(!sessionPayloadStr.includes('Maria Fernandes'), 'Nenhum cantor demonstrativo fictício ("Maria Fernandes") gerado em produção');

    // 18. Validação de Transições Válidas de Fila (Requisito 10)
    console.log('\n18. Testando Validação de Transições de Fila e Proteção de Estados...');
    // A música queueItemId acabou de transicionar para COMPLETED no teste 16
    // Tentativa de cancelar ou promover música já COMPLETED deve ser rejeitada
    const invalidCancelRes = await fetch(`${BASE_URL}/api/v1/queue/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supervisorToken}`
      },
      body: JSON.stringify({ queueItemId })
    });
    await assert(invalidCancelRes.status === 400, 'Tentativa de cancelar música COMPLETED é rejeitada com 400');

    const invalidPromoteRes = await fetch(`${BASE_URL}/api/v1/controller/queue/promote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supervisorToken}`
      },
      body: JSON.stringify({ queueItemId })
    });
    await assert(invalidPromoteRes.status === 400, 'Tentativa de promover música COMPLETED de volta para o topo é rejeitada com 400');

    // 19. Gestão de Operadores Individuais (RBAC / Seção 5 de AGENTS.md)
    console.log('\n19. Testando Gestão de Operadores Individuais e Ciclo de Vida de Credenciais...');
    const listUsersRes = await fetch(`${BASE_URL}/api/v1/supervisor/users`, {
      headers: { 'Authorization': `Bearer ${supervisorToken}` }
    });
    const listUsersData = await listUsersRes.json();
    await assert(listUsersRes.status === 200, 'Supervisor lista usuários operacionais com sucesso');
    await assert(Array.isArray(listUsersData.data?.users), 'Lista de usuários operacionais retornada');

    // Cadastro de novo operador individual
    const createOpRes = await fetch(`${BASE_URL}/api/v1/supervisor/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supervisorToken}`
      },
      body: JSON.stringify({
        name: 'Operador QA Individual',
        email: 'operador.qa@vozplay.ai.slz.br',
        role: 'CONTROLLER',
        password: 'VozPlay@OperadorIndividual2026!'
      })
    });
    const createOpData = await createOpRes.json();
    await assert(createOpRes.status === 200, 'Supervisor cadastra operador individual com sucesso');
    await assert(createOpData.user?.email === 'operador.qa@vozplay.ai.slz.br', 'E-mail do operador individual cadastrado');
    const createdUserId = createOpData.user?.id;

    // Login autêntico com as credenciais do novo operador individual
    const opLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'operador.qa@vozplay.ai.slz.br',
        password: 'VozPlay@OperadorIndividual2026!'
      })
    });
    const opLoginData = await opLoginRes.json();
    await assert(opLoginRes.status === 200 && Boolean(opLoginData.token), 'Operador individual autentica com sucesso e recebe Bearer Token');
    const opToken = opLoginData.token;

    // Operador individual acessa rota do controlador com seu token
    const opAccessRes = await fetch(`${BASE_URL}/api/v1/controller/presence-code`, {
      headers: { 'Authorization': `Bearer ${opToken}` }
    });
    await assert(opAccessRes.status === 200, 'Operador individual acessa mesa de som com autorização de seu Bearer Token');

    // Remoção do operador individual pelo Supervisor
    if (createdUserId) {
      const deleteOpRes = await fetch(`${BASE_URL}/api/v1/supervisor/users/${createdUserId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${supervisorToken}` }
      });
      await assert(deleteOpRes.status === 200, 'Supervisor remove operador individual com sucesso');

      // Tentativa de login após remoção deve falhar
      const postDeleteLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'operador.qa@vozplay.ai.slz.br',
          password: 'VozPlay@OperadorIndividual2026!'
        })
      });
      await assert(postDeleteLoginRes.status === 401 || !postDeleteLoginRes.ok, 'Operador removido não consegue mais autenticar');
    }

    // 20. Validação Rigorosa de Inputs & Sanitização (Requisito 20)
    console.log('\n20. Testando Validação Rigorosa de Inputs, Limites e Clamping...');
    // Validação de nome muito curto
    const badNameRes = await fetch(`${BASE_URL}/api/v1/participants/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'X' })
    });
    await assert(badNameRes.status === 400, 'Tentativa de registro com nome de 1 caractere rejeitada com 400');

    // Validação de formato de código de presença (não-numérico ou tamanho != 4)
    const badCodeFormatRes = await fetch(`${BASE_URL}/api/v1/participants/verify-presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId,
        code: 'ABCD'
      })
    });
    await assert(badCodeFormatRes.status === 400, 'Código de presença alfanumérico não-numérico ("ABCD") rejeitado com 400');

    const badCodeLenRes = await fetch(`${BASE_URL}/api/v1/participants/verify-presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId,
        code: '123'
      })
    });
    await assert(badCodeLenRes.status === 400, 'Código de presença com menos de 4 dígitos ("123") rejeitado com 400');

    // Clamping de tom (-3 a +3) ao adicionar música
    const extremeToneRes = await fetch(`${BASE_URL}/api/v1/queue/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${participantToken}`
      },
      body: JSON.stringify({
        participantId,
        musicId: sampleMusic.id,
        versionId: sampleMusic.versions[0].id,
        toneOffset: 99
      })
    });
    const extremeToneData = await extremeToneRes.json();
    await assert(extremeToneRes.status === 200, 'Música com offset extremo aceita com clamping');
    await assert(extremeToneData.queueItem?.toneOffset === 3, 'Offset de tom extremo (+99) devidamente limitado ao máximo de +3 semitons');

    // 21. Recomendações Musicais com IA (Gemini & Fallback Curado / Requisito 25)
    console.log('\n21. Testando Recomendações Musicais (Gemini & Fallback Seguro)...');
    const recRes = await fetch(`${BASE_URL}/api/v1/recommendations?genre=Sertanejo&mood=Animado`);
    const recData = await recRes.json();
    await assert(recRes.status === 200, 'Endpoint de recomendações responde com status 200');
    await assert(recData.success === true, 'Recomendações retornam com sucesso');
    await assert(recData.data?.tracks?.length > 0, 'Playlist recomendada contém faixas musicais');
    await assert(
      recData.data.tracks.every((t: any) => t.suggestedToneOffset >= -3 && t.suggestedToneOffset <= 3),
      'Todos os offsets vocais sugeridos estão no intervalo de conforto (-3 a +3 semitons)'
    );

    const recPayloadStr = JSON.stringify(recData);
    await assert(!recPayloadStr.includes('GEMINI_API_KEY'), 'Resposta NUNCA vaza segredos ou variáveis de ambiente de IA');
    await assert(!recPayloadStr.includes('systemInstruction'), 'Resposta NUNCA vaza prompts de sistema internos');

    // Resumo Final
    console.log('\n================================================================');
    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(`RESULTADO FINAL: ${passed}/${total} testes aprovados.`);
    if (failed > 0) {
      console.error(`Atenção: ${failed} testes falharam.`);
      process.exit(1);
    } else {
      console.log('✅ TODOS OS TESTES PASSARAM COM SUCESSO! BASE HOMOLOGADA.');
    }
  } catch (error) {
    console.error('Erro inesperado durante a execução dos testes:', error);
    process.exit(1);
  }
}

runTests();
