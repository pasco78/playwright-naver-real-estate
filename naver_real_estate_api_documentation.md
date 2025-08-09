# 네이버 부동산 API 분석 문서

## 1. 개요

네이버 부동산(https://new.land.naver.com)은 대한민국의 부동산 매물 정보를 제공하는 서비스입니다. 이 문서는 네이버 부동산이 사용하는 내부 API 구조와 데이터 형식을 분석한 결과입니다.

**주의사항**: 이 API들은 네이버가 공식적으로 제공하는 공개 API가 아니며, 내부적으로 사용되는 엔드포인트입니다.

## 2. 주요 API 엔드포인트

### 2.1 단지 마커 API (Complex Markers)
- **URL**: `https://new.land.naver.com/api/complexes/single-markers/2.0`
- **Method**: GET
- **용도**: 지도상에 표시할 아파트 단지 정보와 가격 정보를 가져옴

#### 요청 파라미터
```
cortarNo: 4159013000 (지역 코드)
zoom: 16 (지도 줌 레벨)
priceType: RETAIL (가격 타입)
realEstateType: APT:PRE:ABYG:JGC (부동산 타입 - 아파트, 분양권, 아파트분양권, 재건축)
tradeType: (거래 타입)
leftLon: 127.0997871 (좌측 경도)
rightLon: 127.1272529 (우측 경도)
topLat: 37.200221 (상단 위도)
bottomLat: 37.1891106 (하단 위도)
priceMin: 0 (최소 가격)
priceMax: 900000000 (최대 가격)
areaMin: 0 (최소 면적)
areaMax: 900000000 (최대 면적)
showArticle: false (매물 표시 여부)
isPresale: true (분양 포함 여부)
```

#### 응답 데이터 구조
```json
{
  "markerId": "109208",                    // 마커 ID
  "markerType": "COMPLEX",                 // 마커 타입
  "latitude": 37.19921,                    // 위도
  "longitude": 127.114233,                 // 경도
  "complexName": "시범반도유보라아이비파크4.0",  // 단지명
  "realEstateTypeCode": "APT",             // 부동산 타입 코드
  "realEstateTypeName": "아파트",           // 부동산 타입명
  "completionYearMonth": "201801",         // 준공년월
  "totalDongCount": 6,                     // 총 동수
  "totalHouseholdCount": 740,              // 총 세대수
  "floorAreaRatio": 299,                   // 용적률
  "minDealUnitPrice": 2848,                // 최소 매매 단가 (만원/㎡)
  "maxDealUnitPrice": 3560,                // 최대 매매 단가
  "minLeaseUnitPrice": 1581,               // 최소 전세 단가
  "maxLeaseUnitPrice": 1868,               // 최대 전세 단가
  "minLeaseRate": 45,                      // 최소 전세가율 (%)
  "maxLeaseRate": 60,                      // 최대 전세가율
  "minArea": "114.58",                     // 최소 면적 (㎡)
  "maxArea": "130.55",                     // 최대 면적
  "minDealPrice": 105000,                  // 최소 매매가 (만원)
  "maxDealPrice": 140000,                  // 최대 매매가
  "minLeasePrice": 55000,                  // 최소 전세가
  "maxLeasePrice": 65000,                  // 최대 전세가
  "minRentPrice": 120,                     // 최소 월세
  "maxRentPrice": 200,                     // 최대 월세
  "dealCount": 88,                         // 매매 매물 수
  "leaseCount": 9,                         // 전세 매물 수
  "rentCount": 3,                          // 월세 매물 수
  "totalArticleCount": 100,                // 총 매물 수
  "photoCount": 0,                         // 사진 수
  "isPresales": false,                     // 분양 여부
  "isComplexTourExist": false             // 단지 투어 존재 여부
}
```

### 2.2 지역 경계 API (Cortar Boundaries)
- **URL**: `https://new.land.naver.com/api/cortars`
- **Method**: GET
- **용도**: 특정 지역의 경계 좌표를 가져옴

#### 요청 파라미터
```
zoom: 16
centerLat: 37.194666
centerLon: 127.11352
```

#### 응답 구조
```json
{
  "cortarVertexLists": [
    [
      [위도, 경도],  // 지역 경계를 구성하는 좌표들
      [37.2033408, 127.1096019],
      ...
    ]
  ]
}
```

### 2.3 개발 계획 API

#### 도로 개발 계획
- **URL**: `https://new.land.naver.com/api/developmentplan/road/list`
- **Method**: GET

#### 철도 개발 계획
- **URL**: `https://new.land.naver.com/api/developmentplan/rail/list`
- **Method**: GET

#### 지구 개발 계획
- **URL**: `https://new.land.naver.com/api/developmentplan/jigu/list`
- **Method**: GET

공통 요청 파라미터:
```
zoom: 16
leftLon: 127.0916661
rightLon: 127.1191319
topLat: 37.3651132
bottomLat: 37.3540272
```

## 3. 인증 및 헤더

### 필수 헤더
```http
authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
referer: https://new.land.naver.com/
user-agent: Mozilla/5.0...
sec-ch-ua: "Chromium";v="139"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Windows"
```

**JWT 토큰**: Authorization 헤더에 JWT Bearer 토큰이 필요합니다. 이 토큰은 페이지 로드 시 자동으로 생성되며, 약 3시간의 유효 기간을 가집니다.

## 4. 데이터 필드 설명

### 부동산 타입 코드
- `APT`: 아파트
- `PRE`: 분양권
- `ABYG`: 아파트분양권
- `JGC`: 재건축

### 가격 데이터
- **단가**: 만원/㎡ 단위로 표시
- **가격**: 만원 단위로 표시
- **전세가율**: 매매가 대비 전세가 비율 (%)

### 면적 데이터
- 제곱미터(㎡) 단위 사용
- 평형 환산: ㎡ × 0.3025 = 평

## 5. 데이터 수집 전략

### 5.1 지도 기반 검색
1. 원하는 지역의 좌표 범위 설정 (leftLon, rightLon, topLat, bottomLat)
2. 줌 레벨 설정 (권장: 14-18)
3. 필터 조건 설정 (가격, 면적, 부동산 타입 등)
4. API 호출하여 마커 데이터 수집

### 5.2 페이지네이션
- 단일 요청으로 해당 영역의 모든 단지 정보를 받아옴
- 지도 영역이 너무 넓을 경우, 일부 데이터만 표시될 수 있음
- 권장: 적절한 줌 레벨(16-17)로 구역을 나누어 요청

### 5.3 상세 정보 조회
각 단지의 상세 정보는 별도 API 호출 필요:
- `/api/complexes/{complexId}`: 단지 상세 정보
- `/api/complexes/{complexId}/price`: 가격 트렌드
- `/api/complexes/{complexId}/article`: 매물 목록

## 6. 제한 사항 및 주의 사항

1. **비공식 API**: 네이버 내부 사용 목적으로 설계된 API
2. **Rate Limiting**: 짧은 시간 내 과도한 요청 시 일시적 차단
3. **토큰 갱신**: JWT 토큰 만료 시 새로운 토큰 획득 필요
4. **데이터 정확성**: 실시간 업데이트되지만 지연 가능성 있음
5. **API 변경**: 예고 없이 변경될 수 있음

## 7. 활용 예시

### Python 요청 예시
```python
import requests

headers = {
    'authorization': 'Bearer YOUR_JWT_TOKEN',
    'referer': 'https://new.land.naver.com/',
    'user-agent': 'Mozilla/5.0...'
}

params = {
    'cortarNo': '4159013000',
    'zoom': '16',
    'priceType': 'RETAIL',
    'realEstateType': 'APT',
    'leftLon': '127.0997871',
    'rightLon': '127.1272529',
    'topLat': '37.200221',
    'bottomLat': '37.1891106'
}

response = requests.get(
    'https://new.land.naver.com/api/complexes/single-markers/2.0',
    headers=headers,
    params=params
)

data = response.json()
```

## 8. 결론

네이버 부동산은 REST API 기반으로 데이터를 제공하며, 지도 좌표 기반의 검색과 다양한 필터링 옵션을 지원합니다. JWT 인증을 사용하며, 응답 데이터는 JSON 형식으로 구조화되어 있어 프로그래밍 방식으로 처리하기 용이합니다.

이 문서는 2025년 8월 기준으로 작성되었으며, API 구조는 변경될 수 있습니다.