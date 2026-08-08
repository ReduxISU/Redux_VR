import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', 'shots/**', 'fixtures/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // packages/* is the pure layer: data in, positions out. `layout` does it for
    // reductions, `puzzle` for the K-12 activities. Importing a renderer or React
    // into either means the boundary is wrong.
    files: ['packages/*/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['three', 'three/*'], message: 'packages/* must stay renderer-agnostic' },
            {
              group: ['react', 'react-dom', '@react-three/*'],
              message: 'packages/* must stay React-free',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'packages/* must stay DOM-free' },
        { name: 'document', message: 'packages/* must stay DOM-free' },
      ],
    },
  },
)
