/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Serviço de Inteligência Artificial Gemini
 * Geração de Playlists Recomendadas por Gênero Musical
 */

import { GoogleGenAI, Type } from '@google/genai';
import { db } from './db.js';
import { RecommendedPlaylist, RecommendedTrack } from '../src/types.js';

let aiClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Catálogo de fallback rico e curado por gênero musical
const FALLBACK_GENRE_PRESETS: Record<string, {
  playlistTitle: string;
  description: string;
  vibeTag: string;
  curatorNote: string;
  tracks: Array<{
    title: string;
    artist: string;
    suggestedToneOffset: number;
    karaokeTip: string;
    energyLevel: 'Baixa' | 'Média' | 'Alta' | 'Explosiva';
    difficulty: 'Fácil' | 'Médio' | 'Desafiador';
  }>;
}> = {
  sertanejo: {
    playlistTitle: 'Noite de Modão & Sofrência de Elite',
    description: 'Os hinos sertanejos que fazem o lounge inteiro erguer o copo e cantar o refrão a plenos pulmões.',
    vibeTag: '🔥 Clássicos do Bar',
    curatorNote: 'Dica de ouro: em músicas com refrão muito agudo, descer 1 semitom (-1) poupa sua voz e deixa a interpretação mais encorpada!',
    tracks: [
      {
        title: 'Evidências',
        artist: 'Chitãozinho & Xororó',
        suggestedToneOffset: 0,
        karaokeTip: 'O hino nacional dos karaokês! No refrão "E nessa loucura...", aponte o microfone pro público que a galera canta junto.',
        energyLevel: 'Explosiva',
        difficulty: 'Médio',
      },
      {
        title: 'Temporal de Amor',
        artist: 'Leandro & Leonardo',
        suggestedToneOffset: 0,
        karaokeTip: 'Modão clássico dos anos 90 com ritmo constante. Ótimo para quem quer cantar com segurança e expressividade.',
        energyLevel: 'Alta',
        difficulty: 'Fácil',
      },
      {
        title: 'Dormi na Praça',
        artist: 'Bruno & Marrone',
        suggestedToneOffset: -1,
        karaokeTip: 'Música perfeita para brincar com o público. Descer 1 semitom ajuda no falsete da estrofe final.',
        energyLevel: 'Alta',
        difficulty: 'Médio',
      },
      {
        title: 'Boate Azul',
        artist: 'Joaquim & Manuel',
        suggestedToneOffset: 0,
        karaokeTip: 'Entonação emotiva e refrão memorável. Cante com dramaticidade para ganhar aplausos extras.',
        energyLevel: 'Média',
        difficulty: 'Fácil',
      },
      {
        title: 'Sinônimos',
        artist: 'Zé Ramalho & Chitãozinho e Xororó',
        suggestedToneOffset: 0,
        karaokeTip: 'Uma canção épica e poética. Respiração controlada nas frases longas é essencial.',
        energyLevel: 'Alta',
        difficulty: 'Desafiador',
      },
    ],
  },
  pagode: {
    playlistTitle: 'Roda de Samba & Pagode 90 Lá no Alto',
    description: 'A energia contagiante do pagode que bota todo mundo para bater palma e dançar.',
    vibeTag: '🥁 Pandeiro & Alegria',
    curatorNote: 'Pagode é ritmo e carisma! Interaja com a mesa de som e puxe os refrões convidando a plateia.',
    tracks: [
      {
        title: 'Cheia de Manias',
        artist: 'Raça Negra',
        suggestedToneOffset: 0,
        karaokeTip: 'O famoso "Didididiê"! Não tente ser erudito: sorria, balance o corpo e deixe o refrão rolar solto.',
        energyLevel: 'Explosiva',
        difficulty: 'Fácil',
      },
      {
        title: 'Deixa Acontecer',
        artist: 'Grupo Revelação',
        suggestedToneOffset: 0,
        karaokeTip: 'Ritmo suave e envolvente. O refrão tem cadência rápida, então mantenha a dicção clara.',
        energyLevel: 'Alta',
        difficulty: 'Fácil',
      },
      {
        title: 'Falta Você',
        artist: 'Thiaguinho',
        suggestedToneOffset: 0,
        karaokeTip: 'Pagode moderno com groove acústico. Ideal para quem quer mostrar flexibilidade vocal e charme.',
        energyLevel: 'Alta',
        difficulty: 'Médio',
      },
      {
        title: 'Cilada',
        artist: 'Molejo',
        suggestedToneOffset: 0,
        karaokeTip: 'Puro entretenimento! Não tem como ninguém ficar parado quando o refrão estoura.',
        energyLevel: 'Explosiva',
        difficulty: 'Fácil',
      },
      {
        title: 'Pé na Areia',
        artist: 'Diogo Nogueira',
        suggestedToneOffset: 0,
        karaokeTip: 'Clima praiano e descontraído. Use o tom médio para manter o timbre quente e aveludado.',
        energyLevel: 'Média',
        difficulty: 'Médio',
      },
    ],
  },
  'rock nacional': {
    playlistTitle: 'Explosão do Rock Nacional',
    description: 'Guitarras marcantes, atitude no palco e refrões lendários dos anos 80, 90 e 2000.',
    vibeTag: '⚡ Atitude & Voz',
    curatorNote: 'Coloque drive na voz sem forçar a garganta, use o diafragma para sustentar as notas mais altas.',
    tracks: [
      {
        title: 'Anna Júlia',
        artist: 'Los Hermanos',
        suggestedToneOffset: 0,
        karaokeTip: 'Pop-rock chiclete que todo mundo conhece verso por verso. Pegue o microfone com firmeza!',
        energyLevel: 'Explosiva',
        difficulty: 'Fácil',
      },
      {
        title: 'Mulher de Fases',
        artist: 'Raimundos',
        suggestedToneOffset: 0,
        karaokeTip: 'Rock enérgico e acelerado! Mantenha a respiração entre as estrofes para não perder o fôlego no refrão.',
        energyLevel: 'Explosiva',
        difficulty: 'Médio',
      },
      {
        title: 'Exagerado',
        artist: 'Cazuza',
        suggestedToneOffset: 0,
        karaokeTip: 'Interpretação teatral é o segredo aqui. Cazuza exige paixão e entrega em cada palavra.',
        energyLevel: 'Alta',
        difficulty: 'Médio',
      },
      {
        title: 'Primeiros Erros',
        artist: 'Capital Inicial',
        suggestedToneOffset: 0,
        karaokeTip: 'Acústico emocionante que cria um momento de conexão com todo o estabelecimento.',
        energyLevel: 'Média',
        difficulty: 'Fácil',
      },
      {
        title: 'Proibida Pra Mim',
        artist: 'Charlie Brown Jr.',
        suggestedToneOffset: 0,
        karaokeTip: 'Refrão nostálgico com pegada skate-rock. Ótimo para levantar o astral da noite.',
        energyLevel: 'Alta',
        difficulty: 'Fácil',
      },
    ],
  },
  'mpb / bossa nova': {
    playlistTitle: 'Voz & Violão: O Melhor da MPB',
    description: 'Harmonias sofisticadas, letras atemporais e um clima intimista de lounge de alta classe.',
    vibeTag: '🍷 Sofisticação Acústica',
    curatorNote: 'Aposte na respiração suave e na articulação cuidadosa de cada verso.',
    tracks: [
      {
        title: 'Garota de Ipanema',
        artist: 'Tom Jobim & Vinicius',
        suggestedToneOffset: 0,
        karaokeTip: 'Clássico mundial. Cante com doçura e leveza, sem pressa, respeitando o balanço da bossa.',
        energyLevel: 'Média',
        difficulty: 'Fácil',
      },
      {
        title: 'Como Nossos Pais',
        artist: 'Elis Regina',
        suggestedToneOffset: -1,
        karaokeTip: 'Uma das maiores canções do Brasil. Descer 1 tom alivia a tessitura dramática de Elis sem perder o peso.',
        energyLevel: 'Alta',
        difficulty: 'Desafiador',
      },
      {
        title: 'Oceano',
        artist: 'Djavan',
        suggestedToneOffset: 0,
        karaokeTip: 'Harmonia refinada. Mantenha afinação precisa nas passagens em falsete e semitons.',
        energyLevel: 'Média',
        difficulty: 'Desafiador',
      },
      {
        title: 'Sozinho',
        artist: 'Caetano Veloso',
        suggestedToneOffset: 0,
        karaokeTip: 'Voz e violão que silenciam o bar para ouvir você cantar. Cuidado com o volume do microfone.',
        energyLevel: 'Baixa',
        difficulty: 'Fácil',
      },
      {
        title: 'Malandragem',
        artist: 'Cássia Eller',
        suggestedToneOffset: 0,
        karaokeTip: 'Equilíbrio perfeito entre sensibilidade e força de palco. Mostre a rouquidão natural da sua voz.',
        energyLevel: 'Alta',
        difficulty: 'Médio',
      },
    ],
  },
  'pop internacional': {
    playlistTitle: 'Global Pop Hits: Brilho no Palco',
    description: 'Os maiores hinos das paradas mundiais para você soltar a voz como um astro pop.',
    vibeTag: '✨ Divas & Chart Toppers',
    curatorNote: 'Mantenha a postura ereta e a projeção vocal focada na máscara facial para agudos brilhantes.',
    tracks: [
      {
        title: 'Flowers',
        artist: 'Miley Cyrus',
        suggestedToneOffset: 0,
        karaokeTip: 'Hit empoderador com andamento disco-pop. O refrão tem notas confortáveis e ritmo dançante.',
        energyLevel: 'Alta',
        difficulty: 'Fácil',
      },
      {
        title: 'Shallow',
        artist: 'Lady Gaga & Bradley Cooper',
        suggestedToneOffset: 0,
        karaokeTip: 'Perfeita para duetos ou solo impactante. O salto vocal no pré-refrão é o momento de brilhar.',
        energyLevel: 'Explosiva',
        difficulty: 'Desafiador',
      },
      {
        title: 'Rolling in the Deep',
        artist: 'Adele',
        suggestedToneOffset: -1,
        karaokeTip: 'Poderoso e imponente. Se sua voz for mais grave, -1 semitom garante o peso do refrão.',
        energyLevel: 'Explosiva',
        difficulty: 'Médio',
      },
      {
        title: 'Blinding Lights',
        artist: 'The Weeknd',
        suggestedToneOffset: 0,
        karaokeTip: 'Sintetizadores contagiantes anos 80. Mantenha a energia rítmica para acompanhar o beat.',
        energyLevel: 'Alta',
        difficulty: 'Médio',
      },
    ],
  },
  'classic rock': {
    playlistTitle: 'Lendas do Rock Clássico',
    description: 'Hinos imortais de estádio para quem gosta de cantar forte e fazer história no karaokê.',
    vibeTag: '🎸 Arena Rock',
    curatorNote: 'Aqueça bem a voz antes de subir ao palco para não sobrecarregar as cordas vocais.',
    tracks: [
      {
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        suggestedToneOffset: 0,
        karaokeTip: 'Uma ópera rock completa! Se jogue nos trechos dramáticos e deixe o bar fazer o coro na seção operística.',
        energyLevel: 'Explosiva',
        difficulty: 'Desafiador',
      },
      {
        title: 'Sweet Child O’ Mine',
        artist: 'Guns N’ Roses',
        suggestedToneOffset: -2,
        karaokeTip: 'Axl Rose canta extremamente agudo. Descer 1 ou 2 semitons (-2) torna o clássico acessível e divertido.',
        energyLevel: 'Explosiva',
        difficulty: 'Desafiador',
      },
      {
        title: 'I Want to Break Free',
        artist: 'Queen',
        suggestedToneOffset: 0,
        karaokeTip: 'Divertido, leve e muito contagiante. Ótimo para quebrar o gelo logo no início da noite.',
        energyLevel: 'Alta',
        difficulty: 'Fácil',
      },
      {
        title: 'Bad',
        artist: 'U2',
        suggestedToneOffset: 0,
        karaokeTip: 'Hino épico e progressivo do U2! Comece suave e vá crescendo a voz junto com o delay de guitarra do The Edge até explodir no refrão "Wide awake, I\'m wide awake!".',
        energyLevel: 'Explosiva',
        difficulty: 'Médio',
      },
      {
        title: 'With or Without You',
        artist: 'U2',
        suggestedToneOffset: 0,
        karaokeTip: 'Construção emocional contínua. Sustente as notas médias com sentimento para contagiar todo o lounge.',
        energyLevel: 'Alta',
        difficulty: 'Médio',
      },
    ],
  },
};

/**
 * Função utilitária para casar uma música sugerida com o catálogo oficial do VozPlay
 */
function matchTrackWithCatalog(trackTitle: string, trackArtist: string) {
  const normTitle = trackTitle.toLowerCase().trim();
  const normArtist = trackArtist.toLowerCase().trim();

  // 1. Procura exata
  const exact = db.catalog.find(
    (m) =>
      m.title.toLowerCase() === normTitle &&
      m.artist.toLowerCase() === normArtist
  );
  if (exact) return exact;

  // 2. Procura com substring
  const partial = db.catalog.find(
    (m) =>
      (m.title.toLowerCase().includes(normTitle) || normTitle.includes(m.title.toLowerCase())) &&
      (m.artist.toLowerCase().includes(normArtist) || normArtist.includes(m.artist.toLowerCase()))
  );
  if (partial) return partial;

  // 3. Procura apenas por título se for bem característico
  if (normTitle.length > 5) {
    const titleOnly = db.catalog.find(
      (m) =>
        m.title.toLowerCase() === normTitle ||
        m.title.toLowerCase().includes(normTitle) ||
        normTitle.includes(m.title.toLowerCase())
    );
    if (titleOnly) return titleOnly;
  }

  return null;
}

/**
 * Monta o fallback local estruturado quando a IA não estiver disponível
 */
function buildFallbackPlaylist(genre: string, mood?: string): RecommendedPlaylist {
  const cleanGenre = genre.toLowerCase().trim();
  let presetKey = Object.keys(FALLBACK_GENRE_PRESETS).find(
    (k) => cleanGenre.includes(k) || k.includes(cleanGenre)
  );

  if (!presetKey) {
    presetKey = 'sertanejo';
  }

  const preset = FALLBACK_GENRE_PRESETS[presetKey];

  // Filtra músicas do catálogo que correspondem ao gênero
  const catalogGenreMatches = db.catalog.filter(
    (m) => m.genre.toLowerCase().includes(cleanGenre) || cleanGenre.includes(m.genre.toLowerCase())
  );

  const tracks: RecommendedTrack[] = preset.tracks.map((t) => {
    const matched = matchTrackWithCatalog(t.title, t.artist);
    return {
      title: t.title,
      artist: t.artist,
      suggestedToneOffset: t.suggestedToneOffset,
      karaokeTip: t.karaokeTip,
      energyLevel: t.energyLevel,
      difficulty: t.difficulty,
      catalogMusicId: matched?.id || null,
      hasMatchInCatalog: Boolean(matched),
    };
  });

  // Se houver músicas do catálogo que ainda não estão nas tracks, adiciona
  for (const cm of catalogGenreMatches) {
    if (!tracks.some((t) => t.catalogMusicId === cm.id)) {
      tracks.push({
        title: cm.title,
        artist: cm.artist,
        suggestedToneOffset: 0,
        karaokeTip: 'Música disponível no acervo oficial do bar com letra sincronizada em alta definição!',
        energyLevel: 'Alta',
        difficulty: 'Médio',
        catalogMusicId: cm.id,
        hasMatchInCatalog: true,
      });
    }
  }

  return {
    genre,
    playlistTitle: preset.playlistTitle,
    description: mood ? `${preset.description} (Foco: ${mood})` : preset.description,
    vibeTag: preset.vibeTag,
    curatorNote: preset.curatorNote,
    tracks: tracks.slice(0, 7),
    source: 'catalog_fallback',
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Gera uma playlist recomendada utilizando a API Gemini
 */
export async function generateRecommendedPlaylist(
  genre: string,
  mood?: string,
  participantName?: string
): Promise<RecommendedPlaylist> {
  const cleanGenre = (genre || 'Sertanejo').trim();
  const ai = getGenAI();

  // Se não houver API Key configurada, utiliza o gerador curado de fallback
  if (!ai) {
    console.log('[GeminiService] GEMINI_API_KEY não configurada. Utilizando curadoria especializada de fallback.');
    return buildFallbackPlaylist(cleanGenre, mood);
  }

  // Prepara o resumo do catálogo atual do bar para contextualizar a IA
  const catalogSummary = db.catalog.map((m) => ({
    id: m.id,
    title: m.title,
    artist: m.artist,
    genre: m.genre,
  }));

  const systemInstruction = `Você é o curador especialista e mestre de cerimônias de Karaokê do VozPlay, a plataforma profissional de karaokê do Brasil.
Sua missão é sugerir uma 'Playlist Recomendada' irresistível de 5 a 7 faixas perfeitas para karaokê, focada especificamente no gênero musical solicitado pelo usuário.

Diretrizes obrigatórias:
1. Recomende músicas muito conhecidas, com refrões marcantes e fáceis ou prazerosos de cantar em público num bar/lounge.
2. O estabelecimento possui um catálogo musical oficial cadastrado:
${JSON.stringify(catalogSummary, null, 2)}
SEMPRE que houver músicas desse catálogo compatíveis com o gênero solicitado, inclua-as na recomendação e aponte o 'catalogMusicId' correspondente e 'hasMatchInCatalog': true.
3. Se faltarem faixas para completar 5 a 7 músicas de sucesso absoluto do gênero, recomende clássicos icônicos consagrados de karaokê desse gênero (com 'catalogMusicId': null e 'hasMatchInCatalog': false).
4. Para cada faixa, determine:
   - 'suggestedToneOffset': ajuste recomendado de semitom para cantar com maior conforto vocal (número inteiro entre -3 e +3, onde 0 é o tom original). Por exemplo, músicas muito agudas podem receber -1 ou -2.
   - 'karaokeTip': uma dica vocal prática e encorajadora em português, citando o refrão ou momento alto da música para animar o cantor e o público.
   - 'energyLevel': 'Baixa', 'Média', 'Alta' ou 'Explosiva'.
   - 'difficulty': 'Fácil', 'Médio' ou 'Desafiador'.
5. Responda em português brasileiro elegante, acolhedor e entusiasta.`;

  const promptText = `Por favor, crie uma Playlist Recomendada de Karaokê para o gênero: "${cleanGenre}".
${mood ? `O clima/vibe desejado pelo cantor é: "${mood}".` : ''}
${participantName ? `Nome do cantor(a): "${participantName}".` : ''}
Gere um título criativo para a playlist, uma breve descrição entusiasmada, uma tag de vibe (ex: '🔥 Fervo Total' ou '🎤 Hinos Imortais') e a lista detalhada de faixas recomendadas.`;

  try {
    const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

    const response = await ai.models.generateContent({
      model: modelName,
      contents: promptText,
      config: {
        systemInstruction,
        temperature: 0.7,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            genre: { type: Type.STRING },
            playlistTitle: { type: Type.STRING },
            description: { type: Type.STRING },
            vibeTag: { type: Type.STRING },
            curatorNote: { type: Type.STRING },
            tracks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  artist: { type: Type.STRING },
                  suggestedToneOffset: { type: Type.INTEGER },
                  karaokeTip: { type: Type.STRING },
                  energyLevel: {
                    type: Type.STRING,
                    enum: ['Baixa', 'Média', 'Alta', 'Explosiva'],
                  },
                  difficulty: {
                    type: Type.STRING,
                    enum: ['Fácil', 'Médio', 'Desafiador'],
                  },
                  catalogMusicId: { type: Type.STRING },
                  hasMatchInCatalog: { type: Type.BOOLEAN },
                },
                required: [
                  'title',
                  'artist',
                  'suggestedToneOffset',
                  'karaokeTip',
                  'energyLevel',
                  'difficulty',
                ],
              },
            },
          },
          required: ['playlistTitle', 'description', 'vibeTag', 'tracks'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Resposta vazia da API Gemini.');
    }

    const parsed = JSON.parse(text) as {
      playlistTitle: string;
      description: string;
      vibeTag: string;
      curatorNote?: string;
      tracks: Array<{
        title: string;
        artist: string;
        suggestedToneOffset: number;
        karaokeTip: string;
        energyLevel: 'Baixa' | 'Média' | 'Alta' | 'Explosiva';
        difficulty: 'Fácil' | 'Médio' | 'Desafiador';
        catalogMusicId?: string;
        hasMatchInCatalog?: boolean;
      }>;
    };

    // Valida e sincroniza faixas com catálogo real do VozPlay
    const validatedTracks: RecommendedTrack[] = (parsed.tracks || []).map((t) => {
      // Clampa o tom vocal para a faixa suportada (-3 a +3)
      const toneOffset = Math.max(-3, Math.min(3, Number(t.suggestedToneOffset) || 0));
      const match = matchTrackWithCatalog(t.title, t.artist);

      return {
        title: t.title,
        artist: t.artist,
        suggestedToneOffset: toneOffset,
        karaokeTip: t.karaokeTip || 'Cante com o coração e divirta-se no palco!',
        energyLevel: t.energyLevel || 'Alta',
        difficulty: t.difficulty || 'Médio',
        catalogMusicId: match?.id || t.catalogMusicId || null,
        hasMatchInCatalog: Boolean(match || t.catalogMusicId),
      };
    });

    return {
      genre: cleanGenre,
      playlistTitle: parsed.playlistTitle || `Especial ${cleanGenre} VozPlay`,
      description: parsed.description || `Seleção especial de ${cleanGenre} para cantar hoje à noite.`,
      vibeTag: parsed.vibeTag || '✨ Seleção Especial',
      curatorNote: parsed.curatorNote || 'Dica do VozPlay: ajuste seu tom vocal antes de subir ao palco para cantar com conforto!',
      tracks: validatedTracks,
      source: 'gemini',
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[GeminiService] Erro ao consultar API Gemini, acionando fallback inteligente:', error);
    return buildFallbackPlaylist(cleanGenre, mood);
  }
}
