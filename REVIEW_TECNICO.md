# Review técnico — Modesto Energias Renováveis

## 1. Resumo executivo

O projeto foi convertido de um sistema de delivery para uma landing page de geração de leads de energia solar. A interface antiga de cardápio, carrinho, pagamento, favoritos, adicionais e taxas de entrega não é carregada nem faz parte do código-fonte ativo.

O produto atual está adequado para apresentação comercial e captação inicial via WhatsApp. Para publicação definitiva, ainda é necessário validar dados comerciais, jurídicos e as estimativas apresentadas.

## 2. Escopo funcional implementado

| Requisito | Estado | Critério de aceite |
| --- | --- | --- |
| Identidade Modesto | Implementado | Logo, nome e paleta azul/amarela presentes |
| Página institucional | Implementado | Proposta de valor e serviços apresentados |
| Segmentação | Implementado | Residencial, comercial e rural |
| Jornada do serviço | Implementado | Viabilidade, projeto, instalação e monitoramento |
| Simulação | Implementado | Controle de R$ 200 a R$ 3.000 e resultado instantâneo |
| Captação de lead | Implementado | Chat pergunta nome, cidade, conta, segmento e situação do imóvel |
| Assistente visual | Implementado | Mascote reage à saudação, processamento, avanço e conclusão |
| WhatsApp | Implementado | Mensagem pré-preenchida com os dados do lead |
| FAQ | Implementado | Acordeão operável por mouse e teclado |
| Responsividade | Implementado | Layouts para desktop, tablet e celular |
| Navegação móvel | Implementado | Menu expansível com atributos ARIA |

## 3. Requisitos não funcionais

### Usabilidade

- Hierarquia visual e chamadas para ação consistentes.
- Conversa guiada com uma pergunta por vez, respostas rápidas e indicador de progresso.
- Aviso de que a simulação é apenas ilustrativa.
- Navegação por âncoras com compensação do cabeçalho fixo.

### Acessibilidade

- HTML em português, estrutura semântica, textos alternativos e ícones decorativos ocultos de leitores de tela.
- Menu móvel informa estado aberto/fechado com `aria-expanded`.
- FAQ informa o estado de cada resposta.
- Recomendação pendente: auditoria manual com NVDA/VoiceOver e validação de contraste WCAG 2.2 AA em produção.

### Desempenho

- Aplicação pequena, sem bibliotecas visuais ou de estado adicionais.
- Build dividido em HTML, CSS e JavaScript minificados.
- Imagem principal local, evitando dependência de banco de imagens em tempo de execução.
- Ponto de atenção: `solar-hero.png` tem aproximadamente 2,27 MB. Converter para WebP/AVIF antes da publicação melhora LCP e consumo de dados.
- Fontes são carregadas do Google Fonts. Para máximo desempenho e privacidade, considerar hospedagem local.

### SEO

- `title`, descrição, idioma, viewport, tema e metadados Open Graph básicos configurados.
- Títulos e conteúdo descrevem o serviço e a marca.
- Pendências para produção: URL canônica, `og:image` absoluta, sitemap, robots.txt, domínio e dados estruturados `LocalBusiness`.

### Segurança e privacidade

- Não existem chaves, senhas ou credenciais no front-end.
- Não há backend nem armazenamento local dos dados do formulário; o navegador encaminha a mensagem ao WhatsApp.
- Campos são tratados como texto e codificados na URL antes do redirecionamento.
- Pendências: política de privacidade, identificação do controlador e canal LGPD. Se forem adicionados cookies de marketing, implementar consentimento antes do rastreamento.

### Manutenibilidade

- O app ativo está concentrado em `src/App.jsx` e `src/styles/global.css`.
- Dependências e comandos estão documentados no README.
- Para crescimento do produto, recomenda-se separar seções, ícones, conteúdo e configurações em módulos próprios.

## 4. Regras de negócio atuais

1. A simulação aplica 85% sobre o valor informado e nunca deve ser tratada como proposta comercial.
2. O assistente coleta nome, cidade, conta média, tipo e situação do imóvel.
3. O valor da conta aceita apenas números inteiros.
4. O envio final abre uma conversa no WhatsApp com todas as respostas.
5. O número de WhatsApp é configurado diretamente no código.

## 5. Dados que precisam de confirmação

- CNPJ, razão social e endereço comercial.
- Cidades ou estados atendidos.
- E-mail e demais canais, caso existam.
- Garantias de equipamentos e instalação.
- Marcas de módulos e inversores utilizadas.
- Prazos reais de projeto, homologação e instalação.
- Percentual de economia que pode ser divulgado legal e comercialmente.
- Política de pós-venda e monitoramento.
- Projetos realizados, fotos próprias e depoimentos autorizados.

## 6. Testes recomendados antes da produção

### Funcionais

- Enviar formulário em Android, iOS e desktop.
- Confirmar o número e o texto gerado no WhatsApp.
- Testar todos os links e âncoras.
- Testar simulador nos valores mínimo, intermediário e máximo.
- Concluir, interromper e reiniciar o fluxo do assistente conversacional.
- Verificar abertura e fechamento do menu e FAQ.

### Compatibilidade

- Chrome, Edge, Firefox e Safari nas duas versões mais recentes.
- Larguras de 320, 375, 768, 1024, 1366 e 1920 pixels.
- Orientação retrato e paisagem.

### Qualidade

- Lighthouse para desempenho, acessibilidade, SEO e boas práticas.
- Navegação completa apenas com teclado.
- Teste com leitor de tela.
- Validação em conexão móvel lenta.

### Automação futura

- Testes unitários do cálculo e da geração da mensagem.
- Testes de componentes do formulário e FAQ.
- Teste ponta a ponta do fluxo de conversão com Playwright.
- Pipeline de CI executando lint, testes e build a cada alteração.

## 7. Backlog recomendado

### Prioridade alta

1. Confirmar dados reais e remover qualquer conteúdo provisório.
2. Otimizar a imagem principal para WebP/AVIF.
3. Criar política de privacidade e informações legais.
4. Configurar domínio, canonical, sitemap e robots.txt.
5. Executar teste real do WhatsApp.

### Prioridade média

1. Adicionar fotos reais de instalações e projetos concluídos.
2. Incluir área atendida e canais sociais.
3. Integrar CRM ou API para registrar leads com consentimento.
4. Adicionar analytics com eventos de clique e envio.
5. Extrair conteúdo e configurações para arquivos separados.

### Prioridade futura

1. Portal do cliente com geração real e alertas.
2. Propostas digitais e acompanhamento de homologação.
3. Painel administrativo para editar conteúdo.
4. Integração com ferramentas de dimensionamento solar.

## 8. Conclusão

O site atende ao objetivo de comunicar o serviço completo da Modesto e conduzir o visitante para uma análise gratuita. A base técnica está simples e funcional. A principal condição para publicação profissional é substituir os dados provisórios por informações validadas, otimizar a imagem principal e concluir os requisitos jurídicos e de SEO do domínio final.
