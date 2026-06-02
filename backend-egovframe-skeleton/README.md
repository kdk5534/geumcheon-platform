# Backend Skeleton

금천구 데이터 플랫폼 백엔드 뼈대입니다.

## 목표

- 공공기관 개발에 익숙한 Java/Spring 계층 구조 유지
- eGovFrame 기반 전환을 염두에 둔 패키지 구조 사용
- 운영 단계에서는 PostgreSQL + PostGIS 연결
- 초기 개발 단계에서는 DB 없이 mock API로 화면 개발 가능

## 패키지

```text
kr.go.geumcheon.dataplatform
  api       공통 API 응답
  config    보안/환경 설정
  dataset   데이터셋 API
  facility  생활시설 API
```

## Mock 모드 실행

Java 17과 Maven 3.9 이상 설치 후 아래처럼 실행합니다.

```powershell
cd C:\Users\Administrator\Documents\geumcheon-platform\backend-egovframe-skeleton
mvn spring-boot:run -Dspring-boot.run.profiles=mock
```

Mock 모드는 DB 연결을 만들지 않고 아래 API를 먼저 제공합니다.

```text
GET http://localhost:8080/api/public/datasets
GET http://localhost:8080/api/public/facilities
GET http://localhost:8080/actuator/health
```

프론트 MVP(`http://localhost:3000`)에서 바로 호출할 수 있도록 개발용 CORS가 열려 있습니다.

관리자 mock API는 HTTP Basic 인증을 사용합니다.

```text
ID: admin
PW: admin1234
```

```text
GET  http://localhost:8080/api/admin/datasets
POST http://localhost:8080/api/admin/uploads/preview
POST http://localhost:8080/api/admin/uploads/commit
GET  http://localhost:8080/api/admin/collection-logs
```

## DB 연결 모드

PostgreSQL/PostGIS를 설치한 뒤 기본 프로필로 실행하면 `application.yml`의 DB 환경변수를 사용합니다.

```text
DB_HOST
DB_PORT
DB_NAME
DB_USERNAME
DB_PASSWORD
```

## 다음 작업

1. Java 17과 Maven 설치
2. mock 프로필로 백엔드 기동 확인
3. 프론트에서 mock API 호출 연결
4. PostgreSQL + PostGIS 설치 후 실제 스키마 적용
5. 관리자 CSV 업로드와 데이터 수집 로그 구현
