# Placar de Vendas

## Iniciar a aplicação

Na pasta `placar-vendas`, use **Node.js 24** e execute `npm ci` na primeira instalação. `npm start` compila a aplicação e inicia o servidor local de pré-visualização com a API da Meta Recesso. Para desenvolvimento, use `npm run dev`. O terminal informa o endereço escolhido.

A campanha precisa de um processo Node ativo no computador que serve o placar. Todas as telas devem usar o mesmo servidor para compartilhar dados. A API consulta o histórico do INSS e grava lançamentos, ajustes, composição das equipes e destinos das TVs em `.recesso/campaign.sqlite`. A pasta do banco é privada e fica fora do Git. Ao mover o servidor, pare o processo e preserve a pasta inteira. A variável de ambiente `RECESSO_DB_PATH` permite usar um arquivo SQLite persistente em outro diretório do host. As telas devem usar uma URL acessível na rede da empresa conforme a configuração da instalação.

Os testes de cálculo e persistência rodam com `node --test server/recesso-store.test.ts server/recesso-source.test.ts`. Para testar uma instância isolada, defina `RECESSO_DISABLE_SYNC=1` e informe um arquivo temporário em `RECESSO_DB_PATH`.

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
