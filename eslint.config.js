import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', 'shots/**', 'fixtures/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // packages/layout is the pure layer: reduction JSON -> positions.
    // Importing a renderer or React here means the boundary is wrong.
    files: ['packages/layout/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['three', 'three/*'], message: 'layout must stay renderer-agnostic' },
            {
              group: ['react', 'react-dom', '@react-three/*'],
              message: 'layout must stay React-free',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'layout must stay DOM-free' },
        { name: 'document', message: 'layout must stay DOM-free' },
      ],
    },
  },
)
