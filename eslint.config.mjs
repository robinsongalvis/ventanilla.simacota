import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';
import { defineConfig, globalIgnores } from 'eslint/config';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    '.claude/**',
    'next-env.d.ts',
  ]),
  {
    rules: {
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    // Los fixtures de Playwright reciben un parámetro `use` que la regla de
    // hooks de React confunde con un hook. En `e2e/` no hay React.
    files: ['e2e/**'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
]);

export default eslintConfig;
