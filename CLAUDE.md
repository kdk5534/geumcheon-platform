# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

금천구 도시·생활·상권 데이터 플랫폼. Mock 모드와 PostgreSQL/PostGIS DB 모드를 모두 지원하는 MVP 구조이며, 공공데이터 API 연동(P4)이 다음 핵심 작업입니다.

## 모듈 구조

```
frontend-static/              → frontend-static/CLAUDE.md 참조
backend-egovframe-skeleton/   → backend-egovframe-skeleton/CLAUDE.md 참조
database/                     → database/CLAUDE.md 참조
scripts/                      로컬 실행용 PowerShell 스크립트
docs/                         로드맵, 운영 문서
target/ uploads/ .tmp/        생성 산출물 — 직접 수정 금지
```

## 빠른 실행

```powershell
# 프론트엔드 (PowerShell 창 1)
cd frontend-static && node serve-static.mjs        # http://localhost:3000

# 백엔드 Mock (PowerShell 창 2)
.\scripts\run-backend-mock.ps1                     # http://localhost:8080

# 전체 상태 확인
.\scripts\check-local-status.ps1
```

## 환경 변수

`.env.example` 기준. 실제 키는 절대 커밋하지 않습니다.

| 변수 | 용도 |
|------|------|
| `DB_*` | PostgreSQL 연결 |
| `DATA_GO_KR_API_KEY / SEOUL_OPEN_API_KEY` | 공공데이터 수집 |
| `COLLECTOR_ENABLED` | `true`로 설정해야 실제 수집 실행 |
| `CORS_ALLOWED_ORIGINS` | 기본값 `http://localhost:3000` |

## 코딩 규칙

- 새 소스 파일 첫 줄: 역할을 설명하는 한 줄 한국어 주석.
- Java 들여쓰기 4칸, 프론트엔드 JS/CSS/HTML 2칸.
- PowerShell 스크립트명: `kebab-case.ps1`.
