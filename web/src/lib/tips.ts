export type Tip = {
  id: string
  track: 'fundamentos' | 'pratica' | 'dinheiro' | 'mente' | 'casal'
  emoji: string
  title: string
  body: string
  practice: string
}

export const TIP_TRACKS: { id: Tip['track']; label: string; emoji: string; blurb: string }[] = [
  { id: 'fundamentos', label: 'Fundamentos', emoji: '🌟', blurb: 'Como a Lei da Atração realmente funciona' },
  { id: 'pratica', label: 'Prática diária', emoji: '🧘‍♀️', blurb: 'Rituais que mudam a sua frequência' },
  { id: 'dinheiro', label: 'Prosperidade', emoji: '💰', blurb: 'Relação saudável e magnética com dinheiro' },
  { id: 'mente', label: 'Mentalidade', emoji: '🧠', blurb: 'Desbloqueie crenças que te seguram' },
  { id: 'casal', label: 'A dois', emoji: '💞', blurb: 'Manifestar junto multiplica' },
]

export const TIPS: Tip[] = [
  // ---------------------------------------------------------- fundamentos
  {
    id: 'f1',
    track: 'fundamentos',
    emoji: '🎯',
    title: 'Clareza é metade da manifestação',
    body:
      'O universo não trabalha com "quero uma vida melhor". Ele trabalha com endereço, cor, cheiro e data. Quanto mais específico o pedido, menos ruído entre você e a entrega. Um sonho vago é um pedido que ninguém consegue atender.',
    practice:
      'Abra um sonho do seu quadro e reescreva a descrição em 3 frases sensoriais: o que você vê, o que você sente e o que muda na sua rotina quando ele acontecer.',
  },
  {
    id: 'f2',
    track: 'fundamentos',
    emoji: '⚡',
    title: 'Você atrai o que sustenta, não o que deseja num surto',
    body:
      'Empolgação de domingo à noite não muda vida. O que muda é a frequência que você consegue manter numa terça-feira cansada. A Lei da Atração responde ao seu estado dominante — aquilo em que você vive, não aquilo que você jura por 10 minutos.',
    practice:
      'Escolha UM comportamento pequeno que você consegue sustentar todo dia por 30 dias e vincule ao seu maior sonho.',
  },
  {
    id: 'f3',
    track: 'fundamentos',
    emoji: '🤝',
    title: 'Fé sem ação é decoração',
    body:
      'Visualizar sem agir é sonhar acordada. Agir sem visualizar é trabalhar no escuro. A manifestação acontece na interseção: você imagina com nitidez e depois se move na direção da imagem, mesmo sem ver o caminho inteiro.',
    practice:
      'Para cada sonho do quadro, preencha o campo "Projeto" com o primeiro passo concreto que cabe em 30 minutos.',
  },
  {
    id: 'f4',
    track: 'fundamentos',
    emoji: '🙏',
    title: 'Gratidão é a frequência da abundância',
    body:
      'Quem agradece está dizendo "eu recebo bem". Quem reclama está dizendo "não é suficiente". O universo é literal: entrega mais daquilo que você confirma. A gratidão não é ingenuidade — é o reconhecimento do que já funciona, e isso abre espaço para mais.',
    practice:
      'No check-in de hoje, escreva 3 coisas específicas pelas quais você é grata. Específicas, não genéricas.',
  },
  {
    id: 'f5',
    track: 'fundamentos',
    emoji: '🧲',
    title: 'Torne-se a pessoa que já tem',
    body:
      'Não pergunte "como consigo isso?". Pergunte "quem é a pessoa para quem isso é normal?". Ela acorda que horas? Como fala de dinheiro? O que ela recusa? Manifestar é encurtar a distância entre você e essa versão — e a distância se encurta por identidade, não por esforço.',
    practice:
      'Escreva 5 hábitos da sua versão realizada e escolha 1 para começar hoje.',
  },

  // -------------------------------------------------------------- prática
  {
    id: 'p1',
    track: 'pratica',
    emoji: '👁️',
    title: 'Visualização de 60 segundos',
    body:
      'Não precisa de uma hora de meditação. Sessenta segundos de imagem carregada de emoção valem mais que trinta minutos de mente vagando. O que grava a imagem no subconsciente é o SENTIMENTO, não o tempo.',
    practice:
      'Use o Modo Apresentação por 1 minuto sentindo que já é seu. Sorria de verdade enquanto olha.',
  },
  {
    id: 'p2',
    track: 'pratica',
    emoji: '🗣️',
    title: 'Afirmações que o cérebro aceita',
    body:
      'Afirmação que você não acredita gera resistência. Em vez de "eu sou milionária", use a ponte: "eu estou me tornando uma mulher de prosperidade" ou "eu escolho decisões de quem prospera". O cérebro aceita o movimento mesmo quando rejeita o destino.',
    practice:
      'Crie 3 afirmações no formato "eu estou me tornando..." e leia em voz alta ao acordar.',
  },
  {
    id: 'p3',
    track: 'pratica',
    emoji: '🌅',
    title: 'Os primeiros 10 minutos do dia',
    body:
      'A primeira coisa que entra na sua mente calibra o dia inteiro. Se é notificação, notícia e cobrança alheia, você começa reagindo. Se é o seu quadro dos sonhos, você começa liderando.',
    practice:
      'Amanhã, antes de abrir qualquer rede social, abra o WE DREAM e olhe 3 sonhos.',
  },
  {
    id: 'p4',
    track: 'pratica',
    emoji: '✍️',
    title: 'Escrever é decretar',
    body:
      'A escrita organiza o desejo e compromete o corpo. O que fica só na cabeça se dissolve; o que vira palavra escrita ganha contorno e cobra retorno. Por isso todo sonho aqui tem um campo de projeto — para sair do desejo e virar plano.',
    practice:
      'Escolha o sonho mais parado do seu quadro e escreva o próximo passo agora mesmo.',
  },
  {
    id: 'p5',
    track: 'pratica',
    emoji: '🎬',
    title: 'Aja "como se" por 5 minutos',
    body:
      'Não é fingir — é ensaiar. Atores decoram o papel antes de estrear. Cinco minutos por dia agindo como a sua versão realizada (a postura, a fala, a decisão) reprograma o que o seu sistema considera normal.',
    practice:
      'Escolha uma micro-ação da sua versão realizada e execute hoje.',
  },
  {
    id: 'p6',
    track: 'pratica',
    emoji: '🧹',
    title: 'Faça espaço para o que vem',
    body:
      'O universo não entrega em ambiente cheio. Armário lotado, agenda entupida e cabeça bagunçada comunicam "não tenho espaço". Organizar é um pedido físico por mais.',
    practice:
      'Doe ou descarte 5 coisas hoje. Repare em como a energia muda.',
  },

  // ------------------------------------------------------------- dinheiro
  {
    id: 'd1',
    track: 'dinheiro',
    emoji: '💸',
    title: 'Dinheiro gosta de nome e destino',
    body:
      'Dinheiro sem destino evapora. Quando você nomeia ("estes R$ 500 são da casa na praia"), ele para de ser um número solto e vira tijolo. O Banco dos Sonhos existe exatamente para isso: transformar guardar em construir.',
    practice:
      'Faça hoje um aporte, mesmo simbólico, no sonho mais importante do seu quadro.',
  },
  {
    id: 'd2',
    track: 'dinheiro',
    emoji: '📊',
    title: 'O poder do valor visível',
    body:
      'Sonho sem preço é sonho sem plano. No instante em que você coloca um valor, ele deixa de ser fantasia e vira matemática: valor ÷ meses = a sua meta mensal. Assustador? Ótimo — agora é resolvível.',
    practice:
      'Coloque um valor estimado em pelo menos 3 sonhos e veja a porcentagem aparecer.',
  },
  {
    id: 'd3',
    track: 'dinheiro',
    emoji: '🌱',
    title: 'Pequeno constante vence grande esporádico',
    body:
      'R$ 50 por semana viram R$ 2.600 no ano. E, mais importante: viram identidade. A pessoa que aporta toda semana se torna a pessoa que conquista — muito antes do dinheiro chegar.',
    practice:
      'Defina um valor semanal que não dói e registre todo aporte aqui.',
  },
  {
    id: 'd4',
    track: 'dinheiro',
    emoji: '🚫',
    title: 'Cuidado com o que você decreta sobre dinheiro',
    body:
      '"Dinheiro é difícil", "não é para mim", "sempre falta". Cada frase dessas é um pedido. Você não precisa mentir para si mesma — precisa parar de assinar embaixo do que não quer viver.',
    practice:
      'Repare em uma frase negativa que você repete sobre dinheiro e reescreva no positivo.',
  },

  // ---------------------------------------------------------------- mente
  {
    id: 'm1',
    track: 'mente',
    emoji: '🔓',
    title: 'A crença que te segura tem endereço',
    body:
      'Toda meta travada esconde uma frase antiga: "não sou capaz", "não mereço", "vão me achar exagerada". Ela não vai embora sendo ignorada — vai embora sendo vista. Nomear a crença tira o poder dela.',
    practice:
      'Escolha um sonho parado e complete: "eu ainda não realizei porque acredito que...".',
  },
  {
    id: 'm2',
    track: 'mente',
    emoji: '🪞',
    title: 'Inveja é um mapa, não um defeito',
    body:
      'Aquilo que te incomoda na conquista alheia é exatamente o que você quer e ainda não se autorizou. Em vez de se culpar, use como GPS: o incômodo aponta a direção do seu desejo reprimido.',
    practice:
      'Pense em alguém cuja vida te desperta desejo e escreva o que exatamente você quer daquilo.',
  },
  {
    id: 'm3',
    track: 'mente',
    emoji: '🛡️',
    title: 'Proteja a sua frequência',
    body:
      'Você não consegue vibrar alto no meio de quem só fala baixo. Não é sobre cortar pessoas — é sobre escolher onde você deposita as suas melhores horas e o que você deixa entrar sem filtro.',
    practice:
      'Silencie hoje uma fonte de conteúdo que te deixa pequena.',
  },
  {
    id: 'm4',
    track: 'mente',
    emoji: '💪',
    title: 'Dias ruins fazem parte do método',
    body:
      'Nenhuma jornada é linha reta. O erro não é cair — é achar que cair significa que não era para ser. Nos dias difíceis a meta muda: não é avançar, é não sair da estrada.',
    practice:
      'No próximo dia difícil, faça o check-in mesmo assim e execute UMA ação mínima.',
  },
  {
    id: 'm5',
    track: 'mente',
    emoji: '🏆',
    title: 'Celebre para não desistir',
    body:
      'O cérebro repete o que é recompensado. Se você só comemora a linha de chegada, ele conclui que o caminho não vale a pena. Comemorar os 10% é o que garante os 100%.',
    practice:
      'Olhe seus sonhos realizados no arquivo e reviva a sensação de cada um.',
  },

  // ---------------------------------------------------------------- casal
  {
    id: 'c1',
    track: 'casal',
    emoji: '💞',
    title: 'Sonho compartilhado tem o dobro de força',
    body:
      'Quando duas pessoas olham para a mesma imagem, a chance de realizar não soma — multiplica. Uma segura quando a outra fraqueja, e o compromisso deixa de ser só consigo mesma.',
    practice:
      'Criem juntos pelo menos 1 sonho do casal com valor e data.',
  },
  {
    id: 'c2',
    track: 'casal',
    emoji: '🔐',
    title: 'Individual também é sagrado',
    body:
      'Estar em casal não significa dissolver quem você é. Ter sonhos só seus — e poder escolher quando mostrá-los — é o que mantém a relação entre duas pessoas inteiras, não entre duas metades.',
    practice:
      'Revise quais sonhos individuais você quer compartilhar e quais prefere guardar por enquanto.',
  },
  {
    id: 'c3',
    track: 'casal',
    emoji: '🗓️',
    title: 'Encontro mensal do quadro',
    body:
      'Uma vez por mês, sentem juntos, abram o quadro e revisem: o que avançou, o que travou, o que mudou de prioridade. Trinta minutos por mês valem mais que mil conversas apressadas.',
    practice:
      'Marquem na agenda o primeiro domingo do mês como o "Encontro do Quadro".',
  },
  {
    id: 'c4',
    track: 'casal',
    emoji: '🎉',
    title: 'Comemorem o sonho do outro como se fosse seu',
    body:
      'Quando um realiza, o casal inteiro sobe de nível. Celebrar a conquista do outro sem comparação é o que transforma dois sonhadores em um time de verdade.',
    practice:
      'Deixe um incentivo escrito em um sonho do seu par hoje.',
  },
]

/** Passos do ritual diário guiado. */
export const RITUAL_STEPS = [
  {
    emoji: '🙏',
    title: 'Agradeça',
    text: 'Nomeie 3 coisas específicas que já são boas na sua vida hoje.',
    seconds: 30,
  },
  {
    emoji: '👁️',
    title: 'Visualize',
    text: 'Olhe seus sonhos e sinta como se já fossem seus. Sorria de verdade.',
    seconds: 60,
  },
  {
    emoji: '🎯',
    title: 'Aja',
    text: 'Escolha UMA ação concreta para hoje. Pequena, mas real.',
    seconds: 30,
  },
] as const
