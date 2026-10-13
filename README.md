# Chiikawa Codex Pet

Codex 작업 상태를 보여주는 시사·쿠리만쥬 데스크톱 펫.

Windows x64 / Electron

## 설치

[Releases](https://github.com/Alt030/chiikawa-codex-pet/releases/latest)에서 설치 파일을 받아 실행.
캐릭터 선택과 보이기/숨기기는 트레이 메뉴에서 변경.

Codex 앱 또는 CLI의 로컬 세션 기록을 사용한다. 감시 경로는 `$CODEX_HOME/sessions`, 기본값은 `~/.codex/sessions`.

## 기능

- 생각·검색·파일 수정·실행 등 작업 상태에 따른 대사와 반응 이미지
- 수정 중인 파일명, 작업 시간, 진행 중인 세션 수 표시
- 작업 완료 시 남은 사용량 표시
- 쿠리만쥬 피로 효과, 대기 중 반응과 수면 동작

## 개발

```sh
npm ci
npm start
```

Windows 설치 파일 빌드:

```sh
npm run build:win
```

## 라이선스

코드: [MIT](LICENSE). [desktop-pet](https://github.com/yangbuyiya/desktop-pet) 기반.
캐릭터·이미지·GIF 출처는 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) 참고.
