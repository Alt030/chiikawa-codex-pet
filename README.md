# Chiikawa Codex Pet

시사·쿠리만쥬 캐릭터가 Codex 작업 상태를 알려주는 Windows x64 데스크톱 펫입니다.

## 설치

1. [Releases](https://github.com/Alt030/chiikawa-codex-pet/releases/latest)에서 설치용 .exe를 다운로드하고 실행합니다.
2. Codex 데스크톱 앱을 설치하고 로그인합니다.
3. 펫을 실행하고 Codex에 작업을 요청합니다. 트레이 메뉴에서 보이기/숨기기와 캐릭터 선택을 할 수 있습니다.

코드 서명이 없는 설치 파일이라 Windows에서 게시자를 확인할 수 없다는 안내가 나올 수 있습니다. Windows x64만 지원합니다.

## 기능

- 생각·검색·읽기·수정·테스트·완료·중단 상태 감시
- 수정 중인 파일명을 대사 뒤에 표시하고 완료 시 제거
- 1.5초 미만의 짧은 도구 작업 알림 생략
- 완료 시 5시간/주간 남은 사용량 표시
- 쿠리만쥬 피로 효과와 휴식 후 복귀
- 작업 없이 10분/40분에 최대 두 번 반응, 60분에 수면 동작
- GitHub Releases에서 업데이트를 다운로드하고 재시작 설치

로컬 기록 저장 시점 때문에 상태 표시가 약간 늦을 수 있습니다. 사용량 조회가 불가능한 계정이나 API 키 로그인에서는 남은 사용량 대신 안내 문구가 표시됩니다.

## 데이터

설정은 %APPDATA%/ChiikawaCodexPet에 저장됩니다. Codex의 사용자 .codex/sessions 기록을 로컬에서 읽으며 대화나 소스 코드를 외부로 업로드하지 않습니다. 사용량은 Codex 자체 App Server로 조회합니다. 인증 파일 내용을 직접 읽지 않고 기존 Codex 설정이나 hook을 설치하지 않습니다. 업데이트 확인은 GitHub에 연결됩니다.

## 개발 및 업데이트

Node.js 설치 후 npm ci, npm test, npm start로 실행할 수 있습니다. npm run build:win으로 설치 파일을 만듭니다.

새 버전은 package.json의 버전을 올리고 빌드한 뒤 같은 버전 태그의 GitHub Release에 .exe, .exe.blockmap, latest.yml을 함께 업로드합니다. 개인 로그와 runtime 폴더는 포함하지 마세요.

## 라이선스

코드는 MIT입니다. 원본 desktop-pet, 감시 구조를 참고한 AgentPaw와 LLMPET의 라이선스를 유지합니다. 캐릭터·이미지·GIF는 제3자 저작물이며 코드 MIT에 포함되지 않습니다. 공식 제품이 아닌 팬 프로젝트입니다. 자세한 출처는 THIRD-PARTY-NOTICES.md를 참고하세요.
