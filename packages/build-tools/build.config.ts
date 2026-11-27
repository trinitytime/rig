import { clean, copy, defineBuild, job, json, on, run, set, workspaceDeps } from './src/index.ts'

const packageJson = {
  bin: {
    'rig-build': 'cli.mjs',
  },
  exports: {
    '.': {
      types: './index.d.mts',
      default: './index.mjs',
    },
  },
  files: ['index.mjs', 'index.d.mts', 'cli.mjs'],
  scripts: null,
  devDependencies: null,
}

export default defineBuild({
  build: job([
    set({ outDir: 'dist' }),
    clean(),
    run(({ outDir }) => `tsdown src/index.ts src/cli.ts --dts --out-dir ${outDir}`),
    on('README.md', copy()),
    on('LICENSE', copy()),
    on('package.json', [json((pkg) => ({ ...pkg, ...packageJson })), workspaceDeps()]),
    // on()은 outDir 아래 같은 상대 경로로 쓰므로, 제자리에서 고치려고 outDir을 '.'로 바꾼다.
    set({ outDir: '.' }),
    // 기존 shebang(예: bun)이 있으면 떼어 내고 node로 바꾼다.
    on('dist/cli.mjs', (content) => {
      const body = content.subarray(0, 2).toString() === '#!' ? content.subarray(content.indexOf('\n') + 1) : content
      return Buffer.concat([Buffer.from('#!/usr/bin/env node\n'), body])
    }),
  ]),
})
