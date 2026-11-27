import { clean, copy, defineBuild, job, json, on, run, set } from './src/index.ts'
const packageJson = {
  bin: {
    'rig-build': './index.mjs',
  },
  exports: {
    '.': {
      types: './index.d.mts',
      default: './index.mjs',
    },
  },
  files: ['index.mjs', 'index.d.mts'],
  scripts: null,
  devDependencies: null,
}

export default defineBuild({
  build: job([
    set({ outDir: 'dist' }),
    clean(),
    run(({ outDir }) => `tsdown src/index.ts --dts --out-dir ${outDir}`),
    on('README.md', copy()),
    on('LICENSE', copy()),
    on('package.json', [json((pkg) => ({ ...pkg, ...packageJson }))]),
    // on()은 outDir 아래 같은 상대 경로로 쓰므로, 제자리에서 고치려고 outDir을 '.'로 바꾼다.
    set({ outDir: '.' }),
    on('dist/index.mjs', (content) =>
      content.subarray(0, 2).toString() === '#!'
        ? content
        : Buffer.concat([Buffer.from('#!/usr/bin/env node\n'), content]),
    ),
  ]),
})
