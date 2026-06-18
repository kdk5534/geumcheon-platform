# CLAUDE.md — database

PostgreSQL + PostGIS 기반 스키마와 마이그레이션 SQL 모음입니다.

## 파일 구성

| 파일 | 역할 |
|------|------|
| `schema.sql` | 전체 테이블·인덱스 정의 |
| `seed-mock.sql` | 로컬 개발용 mock 시드 데이터 |
| `migration-*.sql` | 증분 마이그레이션 (파일명에 날짜 포함) |

## 스키마 적용

```powershell
# 루트에서 실행
.\scripts\apply-db.ps1 -Mode fresh -WithSeed   # 전체 재생성 + 시드
.\scripts\apply-db.ps1 -Mode migrate           # 증분 마이그레이션만
```

## 전제 조건

- PostgreSQL (PostGIS 익스텐션 포함) 로컬 설치 필요.
- 연결 정보는 루트 `.env.example`의 `DB_*` 변수 참조.
- 설치 순서는 `docs/postgres-p3-setup.md` 참조.
