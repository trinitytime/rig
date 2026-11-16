type Writer = { writeLine(line: string): unknown; process: { stdin: { writable: boolean } | null } | null }

/**
 * 트레이 프로세스에 보내는 첫 줄(메뉴)만 ms만큼 늦춘다. 두 번째부터는 바로 보낸다.
 * Windows의 트레이 바이너리는 ready를 알린 직후에는 트레이 초기화가 끝나지 않아, 이때 아이콘을 설정하면 nil pointer로 죽는다.
 * 그 사이에 프로세스가 내려갔으면(stdin이 닫혔으면) 보내지 않는다.
 */
// shortcut: 고정 시간만 기다린다 (느린 PC에서는 부족할 수 있다), 그런 보고가 있으면 죽었을 때 다시 띄우는 재시도를 둔다.
export function delayFirstWrite(tray: Writer, ms: number) {
  const write = tray.writeLine.bind(tray)
  tray.writeLine = (line) => {
    tray.writeLine = write
    setTimeout(() => {
      if (tray.process?.stdin?.writable) write(line)
    }, ms)
  }
}
