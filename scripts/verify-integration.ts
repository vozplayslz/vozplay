/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Script de Verificação e Teste de Integração Automatizado - VozPlay
 * Valida todos os fluxos críticos de negócio, sanitização de DTO e regras de segurança.
 */

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
  console.log('====================================================');
  console.log('  VOZPLAY - BATERIA DE TESTES DE INTEGRAÇÃO & SEGURANÇA');
  console.log('====================================================\n');

  try {
    // 1. Health Check
    console.log('1. Testando Health Check do Core Server...');
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthData = await healthRes.json();
    await assert(healthRes.status === 200, 'Health check responde com status 200');
    await assert(healthData.service === 'VozPlay Core Platform', 'Identificação do serviço correta');
    await assert(healthData.domain === 'vozplay.ai.slz.br', 'Domínio oficial configurado: vozplay.ai.slz.br');

    // 2. TVSessionDTO Sanitization (Privacidade Absoluta)
    console.log('\n2. Testando Sanitização e Privacidade do TVSessionDTO...');
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

    // 3. RBAC & Segurança em endpoints de Controlador e Supervisor
    console.log('\n3. Testando Controle de Acesso Baseado em Perfis (RBAC)...');
    const unauthCodeRes = await fetch(`${BASE_URL}/api/v1/controller/presence-code`);
    await assert(unauthCodeRes.status === 401, 'Endpoint de presença bloqueia acessos anônimos (401)');

    const authCodeRes = await fetch(`${BASE_URL}/api/v1/controller/presence-code`, {
      headers: { 'x-client-role': 'CONTROLLER' }
    });
    const codeData = await authCodeRes.json();
    await assert(authCodeRes.status === 200, 'Controlador autorizado obtém código de presença');
    await assert(codeData.presenceCode?.code?.length === 4, 'Código de presença possui exatamente 4 dígitos numéricos');
    await assert(codeData.presenceCode?.remainingSeconds <= 60, 'Código de presença respeita janela máxima de 60 segundos');

    const validCode = codeData.presenceCode.code;

    // 4. Registro de Participante e Validação de Presença
    console.log('\n4. Testando Registro e Validação de Presença Física do Participante...');
    const regRes = await fetch(`${BASE_URL}/api/v1/participants/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Testador QA Automatizado',
        whatsapp: '(98) 98888-7777',
        consentMarketing: true
      })
    });
    const regData = await regRes.json();
    await assert(regRes.status === 200, 'Participante registrado com sucesso');
    await assert(regData.participant.isVerified === false, 'Participante inicia com status isVerified = false');

    const participantId = regData.participant.id;

    // Tentativa com código inválido
    const invalidVerifyRes = await fetch(`${BASE_URL}/api/v1/participants/verify-presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId,
        code: '9999'
      })
    });
    await assert(invalidVerifyRes.status === 400, 'Código de presença inválido rejeitado com 400');

    // Tentativa com código válido correto
    const validVerifyRes = await fetch(`${BASE_URL}/api/v1/participants/verify-presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId,
        code: validCode
      })
    });
    const validVerifyData = await validVerifyRes.json();
    await assert(validVerifyRes.status === 200, 'Presença física validada com código correto');
    await assert(validVerifyData.participant.isVerified === true, 'Participante agora possui isVerified = true');

    // 5. Catálogo e Filtros de Gênero
    console.log('\n5. Testando Catálogo Musical e Filtros...');
    const musicRes = await fetch(`${BASE_URL}/api/v1/music?genre=Sertanejo`);
    const musicData = await musicRes.json();
    await assert(musicRes.status === 200, 'Busca no catálogo retorna 200');
    await assert(musicData.data.length > 0, 'Músicas do gênero Sertanejo encontradas');
    await assert(musicData.data.every((m: any) => m.genre === 'Sertanejo'), 'Todas as músicas filtradas pertencem ao gênero solicitado');

    const sampleMusic = musicData.data[0];

    // 6. Enfileiramento com Algoritmo Anti-Monopólio
    console.log('\n6. Testando Enfileiramento Anti-Monopólio...');
    const queueAddRes = await fetch(`${BASE_URL}/api/v1/queue/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId,
        musicId: sampleMusic.id,
        versionId: sampleMusic.versions[0]?.id || 'v1',
        toneOffset: 1,
        isDuet: false
      })
    });
    const queueAddData = await queueAddRes.json();
    const queuedItem = queueAddData.queueItem || queueAddData.item;
    await assert(queueAddRes.status === 200, 'Música adicionada à fila com sucesso');
    await assert(queuedItem?.status === 'QUEUED', 'Música enfileirada com status QUEUED');
    await assert(queuedItem?.participantDisplayName === 'Testador QA Automatizado', 'Nome do participante preservado no item da fila');
    await assert(typeof queuedItem?.orderIndex === 'number', 'Item da fila possui orderIndex determinístico');

    const createdQueueItemId = queuedItem.id;

    // 7. Acompanhar Minha Vez (Public Tracker sem vazamento de dados)
    console.log('\n7. Testando Acompanhar Minha Vez (Public Tracker)...');
    const trackerRes = await fetch(`${BASE_URL}/api/v1/queue/share/${createdQueueItemId}`);
    const trackerData = await trackerRes.json();
    await assert(trackerRes.status === 200, 'Tracker público responde 200 para item enfileirado');
    await assert(trackerData.data.musicTitle === sampleMusic.title, 'Título da música correto no tracker');
    await assert(typeof trackerData.data.positionInQueue === 'number' || trackerData.data.positionInQueue === 'Cantando Agora!', 'Posição na fila calculada');
    
    const trackerStr = JSON.stringify(trackerData);
    await assert(!/whatsapp|telefone|\+55|\(98\)/i.test(trackerStr), 'Tracker NUNCA expõe WhatsApp ou telefone do cantor');

    // 8. Reações em Tempo Real da Plateia
    console.log('\n8. Testando Reações ao Vivo da Plateia...');
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

    // 9. DJ Soundboard do Controlador
    console.log('\n9. Testando DJ Soundboard do Operador de Som...');
    const soundboardRes = await fetch(`${BASE_URL}/api/v1/controller/soundboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-role': 'CONTROLLER'
      },
      body: JSON.stringify({
        soundType: 'airhorn',
        label: 'Air Horn'
      })
    });
    const soundboardData = await soundboardRes.json();
    await assert(soundboardRes.status === 200, 'Efeito de soundboard acionado pelo Controlador');
    await assert(soundboardData.payload?.soundType === 'airhorn', 'Efeito sonoro registrado');

    // 10. Painel do Supervisor: Assunção Emergencial (Emergency Takeover)
    console.log('\n10. Testando Assunção Emergencial (Emergency Takeover)...');
    const takeoverRes = await fetch(`${BASE_URL}/api/v1/supervisor/takeover`, {
      method: 'POST',
      headers: { 'x-client-role': 'SUPERVISOR' }
    });
    const takeoverData = await takeoverRes.json();
    await assert(takeoverRes.status === 200, 'Supervisor assume controle emergencial');
    await assert(takeoverData.presenceCode?.code?.length === 4, 'Código de presença renovado instantaneamente no takeover');

    // 11. Gestão e Exportação de Leads (LGPD)
    console.log('\n11. Testando Consulta e Exportação de Leads...');
    const leadsRes = await fetch(`${BASE_URL}/api/v1/leads`, {
      headers: { 'x-client-role': 'SUPERVISOR' }
    });
    const leadsData = await leadsRes.json();
    await assert(leadsRes.status === 200, 'Supervisor consulta lista de leads coletados');
    const leadsList = leadsData.leads || leadsData.data || [];
    await assert(leadsList.length > 0, 'Leads encontrados na base de dados');

    const exportRes = await fetch(`${BASE_URL}/api/v1/leads/export.csv`, {
      headers: { 'x-client-role': 'SUPERVISOR' }
    });
    const csvContent = await exportRes.text();
    await assert(exportRes.status === 200, 'Exportação de leads em formato CSV responde com 200');
    await assert(csvContent.includes('Nome') && csvContent.includes('WhatsApp'), 'Cabeçalho CSV de leads formatado corretamente');

    // 12. Resumo Final
    console.log('\n====================================================');
    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(`RESULTADO FINAL: ${passed}/${total} testes aprovados.`);
    if (failed > 0) {
      console.error(`Atenção: ${failed} testes falharam.`);
      process.exit(1);
    } else {
      console.log('✅ TODOS OS TESTES PASSARAM COM SUCESSO!');
    }
  } catch (error) {
    console.error('Erro inesperado durante a execução dos testes:', error);
    process.exit(1);
  }
}

runTests();
