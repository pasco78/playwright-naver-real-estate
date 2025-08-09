# Playwright Naver Real Estate

🏠 네이버 부동산 API를 활용한 부동산 데이터 수집 및 분석 도구

## 📋 개요





## ✨ 주요 기능

- 🎭 **Playwright 자동화**: JWT 토큰 자동 획득
- 🗺️ **지역별 필터링**: 좌표 기반 정확한 지역 구분
- 📊 **다양한 출력**: JSON, Markdown, CSV 형식 지원
- 🏢 **상세 정보**: 매매가, 전세가, 세대수, 준공년월 등

## 📊 수집 데이터

- **총 단지 수**: 229개
- **총 세대 수**: 35,857세대
- **평균 매매가**: 약 29억원
- **평균 전세가**: 약 13억원

## 🚀 설치 및 실행

### 1. 프로젝트 클론
```bash
git clone https://github.com/username/playwright-naver-real-estate.git
cd playwright-naver-real-estate
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 데이터 수집 실행
```bash
node collect_gangnam_data.js
```

## 📁 출력 파일

실행 후 다음 파일들이 생성됩니다:

- `gangnam_data_[timestamp].json` - 상세 원본 데이터
- `gangnam_report_[timestamp].md` - 분석 리포트
- `gangnam_data_[timestamp].csv` - 엑셀 호환 데이터 (229행 × 25컬럼)

## 📋 CSV 데이터 구조

| 컬럼 | 설명 |
|------|------|
| 단지명 | 아파트 단지명 |
| 위도/경도 | GPS 좌표 |
| 부동산타입 | 아파트/재건축/분양 등 |
| 준공년월 | 준공 시기 |
| 총동수/총세대수 | 단지 규모 |
| 매매가/전세가 | 가격 정보 (만원) |
| 매물수 | 거래 유형별 매물 수 |

## 🛠️ 기술 스택

- **Node.js** - 런타임 환경
- **Playwright** - 브라우저 자동화
- **Axios** - HTTP 클라이언트
- **네이버 부동산 API** - 데이터 소스

## 📄 API 문서

자세한 API 분석 내용은 `naver_real_estate_api_documentation.md` 파일을 참조하세요.

## ⚠️ 주의사항

- 이 프로젝트는 네이버 부동산의 공개되지 않은 내부 API를 사용합니다
- 과도한 요청은 일시적 차단을 초래할 수 있습니다
- 교육 및 연구 목적으로만 사용하세요

## 🤝 기여

버그 리포트나 기능 개선 제안은 이슈로 남겨주세요.

## 📄 라이선스

MIT License

## 📞 문의

프로젝트 관련 문의사항이 있으시면 이슈를 통해 연락주세요.