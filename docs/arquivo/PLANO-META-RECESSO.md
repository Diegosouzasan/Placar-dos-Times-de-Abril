# Plano da Meta Recesso e da compatibilidade com Smart TVs

**Proposta para discussão · 13 de novembro de 2026 · versão do projeto analisada `34e0e5e`**

O primeiro marco é fazer uma TV que hoje apresenta falha abrir o endereço do placar, mostrar um resultado conhecido e acompanhar uma alteração. Essa mesma base de exibição deve atender INSS, CLT e Meta Recesso. As regras e a identidade visual da nova campanha serão definidas com a equipe.

## Como o projeto funciona hoje

| Área | Funcionamento e impacto na atualização |
|---|---|
| Entrada e TVs | A página inicial dá acesso a INSS, CLT e relatórios. A TV é identificada por nome. Os placares mostram valores por vendedor, liderança e progresso diário e semanal. O modo híbrido do CLT divide vendedores entre CLT e INSS. |
| Painel de controle | O gestor informa o total diário por vendedor, configura metas, move pessoas entre equipes e controla mídias e intervalos de lanche. As “Metas Avulsas” exibem imagens ou vídeos em TVs selecionadas. Uma campanha com apuração própria exige definir de onde vem o resultado. |
| Dados e histórico | O Supabase fornece equipes, vendedores, configurações e atualizações em tempo real. Alterar o total do dia de R$ 8 mil para R$ 10 mil acrescenta R$ 2 mil à semana e tenta registrar essa diferença no histórico. A atualização e o histórico são gravados em etapas separadas. Os acumulados operacionais podem ser zerados. |
| Relatórios | A central consulta vendas e intervalos, filtra por período e pessoas e exporta Excel. A equipe exibida no histórico de vendas é a equipe atual do vendedor. O botão de envio ao Google Sheets simula o envio e tenta apagar registros. A mesma rotina pode rodar ao abrir relatórios no primeiro dia do mês. |

## O que pode explicar as falhas nas TVs

- **Antes de a primeira tela aparecer.** O HTML entrega apenas um contêiner vazio e uma entrada JavaScript do tipo módulo. A compilação de produção passou e gerou um único arquivo de JavaScript de 1.287.990 bytes minificado, antes de compressão de rede. A entrada importa também administração, gráficos e Excel. Uma TV incapaz de executar esse arquivo pode exibir uma página vazia. [Entrada](placar-vendas/index.html) · [Aplicação](placar-vendas/src/App.tsx)
- **Depois de abrir o placar.** Se a primeira consulta falhar, o código registra o erro no console. Sem equipes carregadas, a TV pode ficar em “Sincronizando”. O aplicativo escuta mudanças no Supabase, mas não exibe a idade dos dados nem faz uma nova consulta periódica de recuperação. [Carregamento e atualizações](placar-vendas/src/App.tsx)
- **Ao exibir mídia.** O placar solicita pré-carregamento dos vídeos dos vendedores do departamento e de um vídeo de equipe. O acervo servido tem 17 vídeos e soma 288 MiB. O volume realmente baixado depende da TV. Animação contínua, desfoque e vídeo merecem testes separados da leitura dos números. [Pré-carregamento](placar-vendas/src/components/VideoPreloader.tsx) · [Estilos](placar-vendas/src/index.css)
- **Antes de o site chegar ao navegador.** O endereço local usado no computador, `127.0.0.1:5174`, aponta para o próprio aparelho em que é aberto. É preciso identificar qual URL as TVs usam e testar a rede da empresa, a resolução do domínio e o certificado nessa URL.

O Vite e o Tailwind usados aqui têm como referência navegadores modernos. Para dimensionar a diferença, a LG documenta Chromium 53 no webOS de 2018–2019 e Chromium 108 no de 2024. A Samsung também publica versões por geração. Esses dados orientam o diagnóstico. A causa da falha de cada TV depende do teste físico. [Vite](https://vite.dev/guide/build.html#browser-compatibility) · [Tailwind](https://tailwindcss.com/docs/compatibility) · [LG](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine) · [Samsung](https://developer.samsung.com/smarttv/develop/specifications/web-engine-specifications.html)

## Ordem de implementação proposta

| Etapa | Trabalho | Evidência para concluir |
|---|---|---|
| 1. Diagnosticar nos aparelhos | Listar marca, modelo, ano aproximado, versão do sistema, URL e sintoma. Comparar uma TV com falha e um computador na mesma rede. Testar, nessa ordem, acesso ao endereço, página HTML simples, leitura de um valor, atualização e mídia. | Para cada modelo, registrar a primeira etapa que falha, com foto ou mensagem. Identificar onde a versão usada pela empresa está hospedada. |
| 2. Provar a exibição compatível | Criar em homologação um endereço curto de TV, acessível também pela entrada principal. Entregar HTML com números já preenchidos e CSS simples. Usar atualização periódica compatível com o equipamento, manter o último resultado na tela e mostrar seu horário quando a conexão cair. Disponibilizar o mesmo resultado de leitura para INSS, CLT e a futura campanha. | Na TV problemática, abrir pelo controle remoto, ler o valor, assistir a uma atualização de teste, desligar e religar o Wi-Fi e observar a recuperação. Confirmar qual forma de gerar e servir o HTML é viável na hospedagem real. |
| 3. Fechar as regras da Meta Recesso | Definir o que conquista o recesso, quem participa, período e fuso, unidade de medida, fonte dos lançamentos e resultado esperado. Pedir exemplos de uma venda válida, uma correção e um encerramento. Definir como tratar empate e transferência se houver disputa entre equipes. Esta conversa pode ocorrer enquanto os modelos das TVs são levantados. | Exemplos com entradas e resultados que a equipe reconhece como corretos. A decisão sobre compartilhar vendas com INSS/CLT ou fazer lançamentos próprios orienta o modelo de dados. |
| 4. Validar o design à distância | Apresentar duas composições com os exemplos da empresa. Se a meta for coletiva, dar protagonismo ao total alcançado e ao que falta. Se for uma disputa, dar protagonismo à posição e à diferença entre participantes. Prever nomes longos, metas atingidas, início sem vendas e fim de campanha. | A equipe consegue explicar como está a campanha olhando da distância real de trabalho. Testar contraste, tamanho dos números, bordas cortadas pela TV e foco ao usar setas, OK e Voltar. |
| 5. Implementar apuração e gestão | Usar uma regra de cálculo para todas as telas. Definir edição e encerramento no painel de gestão e leitura nas TVs. Se a campanha aproveitar vendas, preservar o período e a equipe do lançamento, proteger o histórico da limpeza simulada e tratar gravações repetidas, correções e reinícios dos totais. | Os exemplos acordados passam em homologação, inclusive após repetir um lançamento ou zerar o placar diário. Uma TV simples e uma moderna mostram o mesmo resultado. |
| 6. Integrar e liberar | Disponibilizar a campanha pelo menu e por link direto. Ativar atualização em tempo real e mídia sob demanda onde funcionarem. Prever comemoração estática e retorno ao placar quando um vídeo falhar. Fazer piloto com TVs antigas e atuais e ampliar por modelo, com caminho para voltar à versão anterior. | Cada modelo da empresa passa no roteiro abaixo. Conferir também lançamento de vendas, placares INSS/CLT, modo híbrido, relatório Excel e controle de lanche em ambiente de teste. |

## Como comprovar compatibilidade

A unidade de aceite é **cada modelo e versão presentes na empresa**, usando a URL que ficará em operação. A meta é cobrir 100% desse inventário. Simulação de resolução no computador ajuda no desenho, mas a confirmação de navegador, som, controle remoto e estabilidade vem dos aparelhos físicos.

| Teste nas TVs | Resultado esperado |
|---|---|
| Abrir após desligar e ligar | A TV acessa o endereço com o controle e exibe o placar ou um diagnóstico legível. Registrar tempo até o primeiro resultado e conferir os dados exibidos. Usar o modelo mais lento para acordar o limite aceitável. |
| Vender, corrigir e atingir a meta | O total e o estado da campanha conferem com o exemplo aprovado em todas as TVs, dentro do atraso que a operação definir. |
| Cair a conexão e voltar | Com dados já carregados, o último valor continua visível com horário e indicação de atraso. A TV retoma as atualizações sozinha. Sem dados anteriores, orienta o usuário e tenta novamente. |
| Falhar vídeo ou som | Os números continuam acessíveis, há reconhecimento visual da conquista e a interface retorna ao placar. |
| Operar durante um expediente | Depois de vendas, reconexões e comemorações, a tela continua respondendo. Repetir no aparelho mais antigo e registrar o resultado por modelo. |

Uma TV cujo navegador não consiga estabelecer conexão segura com o endereço exige uma solução de acesso específica. Se esse caso aparecer, avaliar entrega pela infraestrutura interna compatível ou um reprodutor HDMI gerenciado para aquela tela, com decisão da empresa. Até o teste físico, a cobertura por modelo fica pendente.

## Informações para a próxima conversa

1. **Campanha.** Quem conquista o recesso, em qual período e por qual regra? Um exemplo com nomes fictícios, valores e resultado esperado já permite validar o cálculo.
2. **Experiência.** O que alguém do outro lado da sala precisa entender em cinco segundos? O que deve acontecer ao atingir a meta? Quem poderá lançar ou corrigir valores?
3. **Televisores.** Qual endereço vocês abrem hoje? Enviar, inicialmente, o modelo de uma TV que falha, uma foto ou descrição do sintoma e, se houver, o modelo de uma em que o placar funciona.
