/** @type {import('@commitlint/types').UserConfig} */
const config = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Types permitidos según el plan del proyecto Nexos ERP
    'type-enum': [
      2,
      'always',
      [
        'feat',     // Nueva funcionalidad
        'fix',      // Corrección de bug
        'docs',     // Solo documentación
        'style',    // Formato, sin cambio de lógica
        'refactor', // Refactoring sin nueva funcionalidad ni bug fix
        'perf',     // Mejora de rendimiento
        'test',     // Agregar o corregir tests
        'build',    // Sistema de build, dependencias
        'ci',       // Cambios en CI/CD
        'chore',    // Tareas de mantenimiento
        'revert',   // Revertir commit anterior
      ],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'scope-case': [2, 'always', 'lower-case'],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
    'body-leading-blank': [1, 'always'],
    'footer-leading-blank': [1, 'always'],
  },
};

export default config;
