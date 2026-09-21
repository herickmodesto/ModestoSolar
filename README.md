# Modesto Energias Renováveis

Landing page comercial para projetos de energia solar, cobrindo a jornada da análise de viabilidade à instalação e ao acompanhamento da geração.

## Funcionalidades

- Apresentação de soluções residenciais, comerciais e rurais
- Processo completo em quatro etapas
- Simulador indicativo de economia
- Assistente conversacional de qualificação integrado ao WhatsApp
- Mascote animado com poses de saudação, análise e confirmação
- FAQ acessível
- Navegação responsiva para desktop e mobile
- Seção de monitoramento da geração
- Metadados básicos para SEO e compartilhamento

## Desenvolvimento

```bash
npm install
npm run dev
```

## Mapa da Região Metropolitana

O mapa usa a Google Maps JavaScript API. Crie uma chave no Google Cloud, ative a API `Maps JavaScript API`, restrinja a chave ao domínio de publicação e copie `.env.example` para `.env.local`:

```bash
VITE_GOOGLE_MAPS_API_KEY=sua_chave_do_google_maps
```

Para consultas detalhadas de telhados pela Google Solar API, configure também uma chave separada. O projeto do Google Cloud precisa ter faturamento ativo e a `Solar API` habilitada:

```env
VITE_GOOGLE_SOLAR_API_KEY=sua_chave_da_google_solar
```

Restrinja cada chave ao domínio publicado e somente às APIs utilizadas. O mapa regional continua usando a base anual do Global Solar Atlas, porque as camadas GeoTIFF da Google Solar API são voltadas à análise local de telhados e não podem ser usadas diretamente como overlay no Maps JavaScript API.

Em desenvolvimento, uma restrição HTTP para `http://localhost:5173/*` permite carregar o mapa localmente. Sem a chave, a seção exibe uma mensagem de configuração em vez de falhar a página.

## Validação

```bash
npm run build
npm run lint
```

## Configuração antes da publicação

Contatos oficiais configurados: WhatsApp `+55 84 99231-5543` e Instagram `@modesto_rn`. Antes da publicação, ainda devem ser confirmados os dados legais da empresa, área atendida, domínio e política de privacidade.

Consulte `REVIEW_TECNICO.md` para a análise de requisitos, riscos e recomendações de produção.
