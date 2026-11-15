import { spawn } from 'node:child_process'

/** 외부 명령을 실행한다. 실패하면 stderr 끝부분을 담아 던진다. 인자는 shell을 거치지 않는다. */
export const run = (cmd: string, args: string[], cwd: string, env: Record<string, string> = {}) =>
  new Promise<void>((resolve, reject) => {
    // Windows의 npm은 npm.cmd라 shell이 필요하다 (인자는 고정값이라 안전하다).
    const p = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'ignore', 'pipe'],
      shell: cmd === 'npm' && process.platform === 'win32',
    })
    let err = ''
    p.stderr.on('data', (d) => (err += d))
    p.on('error', reject)
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args[0]} failed: ${err.trim().slice(-500)}`))))
  })
