import path from 'node:path'
import { run } from './run.ts'

type Command = { cmd: string; args: string[]; env?: Record<string, string> }

// shortcut: 형식을 확장자로만 구분한다 (.zip이면 zip, 나머지는 tar가 읽는 형식), 이름이 틀린 파일이 많아지면 앞부분(매직 넘버)을 읽어 구분한다.
// shortcut: Linux의 zip은 unzip 명령이 설치되어 있어야 한다, 없는 환경이 많아지면 zip 라이브러리를 쓴다.

/** 플랫폼별로 압축을 푸는 명령을 만든다 (테스트하려고 platform을 받는다). */
export function extractCommand(file: string, dir: string, platform: NodeJS.Platform = process.platform): Command {
  if (path.extname(file).toLowerCase() === '.zip') {
    // 파워셸에는 경로를 환경 변수로 넘겨서 따옴표나 특수 문자를 해석하지 않게 한다.
    if (platform === 'win32')
      return {
        cmd: 'powershell.exe',
        args: ['-NoProfile', '-NonInteractive', '-Command', 'Expand-Archive -LiteralPath $env:RIG_ARCHIVE -DestinationPath $env:RIG_DEST -Force'],
        env: { RIG_ARCHIVE: file, RIG_DEST: dir },
      }
    if (platform === 'linux') return { cmd: 'unzip', args: ['-q', file, '-d', dir] }
    return { cmd: 'tar', args: ['-xf', file, '-C', dir] } // macOS의 tar는 bsdtar라 zip도 읽는다
  }
  // Windows는 PATH 앞에 Git의 GNU tar가 있을 수 있어서 (C:\\ 경로를 원격 호스트로 읽는다) 시스템의 tar를 직접 부른다.
  const tar = platform === 'win32' ? path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar'
  return { cmd: tar, args: ['-xf', file, '-C', dir] }
}

/** 압축 파일을 dir 안에 푼다. */
export function extract(file: string, dir: string): Promise<void> {
  const { cmd, args, env } = extractCommand(file, dir)
  return run(cmd, args, dir, env)
}
