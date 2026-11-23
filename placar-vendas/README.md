# Placar de Vendas

## Iniciar a aplicação

Na pasta `placar-vendas`, use **Node.js 24** e execute `npm ci` na primeira instalação. `npm start` compila a aplicação e inicia o servidor local de pré-visualização com a API da Meta Recesso. Para desenvolvimento, use `npm run dev`. O terminal informa o endereço escolhido.

A campanha precisa de um processo Node ativo no computador que serve o placar. Todas as telas devem usar o mesmo servidor para compartilhar dados. A API consulta o histórico do INSS e grava lançamentos, ajustes, composição das equipes e destinos das TVs em `.recesso/campaign.sqlite`. A pasta do banco é privada e fica fora do Git. Ao mover o servidor, pare o processo e preserve a pasta inteira. A variável de ambiente `RECESSO_DB_PATH` permite usar um arquivo SQLite persistente em outro diretório do host. As telas devem usar uma URL acessível na rede da empresa conforme a configuração da instalação.

Os testes de cálculo e persistência rodam com `node --test server/recesso-store.test.ts server/recesso-source.test.ts`. Para testar uma instância isolada, defina `RECESSO_DISABLE_SYNC=1` e informe um arquivo temporário em `RECESSO_DB_PATH`.

## Corrigir as vendas diárias da Meta Recesso

1. Acesse `/#/inss/admin/recesso` e localize o time da líder.
2. No histórico diário, clique no quadradinho com o lápis da data desejada. Dias futuros ficam desabilitados.
3. Informe o **valor completo daquele dia**, em reais (por exemplo, `1.500,00`). Zero também é permitido.
4. Confira a previsão do acumulado e clique em **Salvar valor**.

A alteração substitui o total daquele dia. Sua diferença recalcula a semana correspondente, o acumulado da equipe e da campanha, o valor restante e as metas por dia, semana e vendedor. Corrigir uma semana passada não altera as vendas da semana atual. O painel recebe os valores ao salvar; as TVs consultam as atualizações a cada três segundos. Os dias aparecem na semana real, de segunda a sexta, com lacunas para datas fora da campanha e feriados.

Um saldo anterior já cadastrado é preservado: ele não absorve mais a diferença das novas correções diárias. As bases antigas mantêm seus valores até a primeira edição; nessa edição, o saldo é preservado e passa a ser fixo. **Editar total** ajusta esse saldo em relação aos dias já preenchidos. Vendas posteriores à correção continuam sendo somadas; registros antigos recebidos com atraso do INSS não duplicam o total corrigido. O comando **Zerar Diário** continua zerando apenas o contador desde o fechamento, preservando o histórico, a semana e o acumulado.

Se outra pessoa alterar o mesmo dia, o formulário pede para reabrir com o valor atualizado. Reenviar a mesma operação não duplica o ajuste. O painel permanece compartilhado, sem login individual; cada líder utiliza a seção do próprio time.

### Supabase e armazenamento

**Não é necessário executar SQL, criar tabelas ou alterar políticas no Supabase para esta mudança.** Os ajustes são gravados pela API Node em `.recesso/campaign.sqlite`, inclusive o saldo preservado, na mesma transação do valor corrigido. O schema local é preparado automaticamente. As correções da Meta Recesso não reescrevem as vendas individuais do INSS ou seus relatórios no Supabase.

A integração existente continua lendo `teams`, `sellers` e `sales_history` para importar a composição e as vendas do INSS. Mantenha o processo Node ativo, preserve a pasta `.recesso` ao mover ou atualizar a instalação e use o mesmo endereço de servidor em todos os painéis e TVs. Abrir cópias independentes do projeto cria bases locais separadas; publicar apenas os arquivos estáticos não disponibiliza a API da campanha.

## React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
