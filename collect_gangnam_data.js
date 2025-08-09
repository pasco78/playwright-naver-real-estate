const axios = require('axios');
const fs = require('fs').promises;
const { chromium } = require('playwright');

/**
 * 서울 강남구 부동산 데이터 수집 스크립트
 */

class NaverRealEstateGangnamCollector {
  constructor() {
    this.baseUrl = 'https://new.land.naver.com';
    this.headers = {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
      'sec-ch-ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'referer': 'https://new.land.naver.com/'
    };
    this.jwtToken = null;
    
    // 서울 강남구 좌표 정보 (확장된 범위)
    this.gangnamBoundaries = {
      centerLat: 37.5172,  // 강남구 중심 위도
      centerLon: 127.0473, // 강남구 중심 경도
      zoom: 12,            // 더 넓은 범위를 위해 줌 추가 축소
      // 강남구 확장된 경계 (주변 지역 일부 포함)
      bounds: {
        northLat: 37.555,   // 북쪽 경계 추가 확장
        southLat: 37.470,   // 남쪽 경계 추가 확장
        eastLon: 127.085,   // 동쪽 경계 추가 확장
        westLon: 127.005    // 서쪽 경계 추가 확장
      }
    };
  }

  /**
   * JWT 토큰 획득
   */
  async getJWTToken() {
    console.log('JWT 토큰 획득 중...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    let token = null;
    
    page.on('request', request => {
      const headers = request.headers();
      if (headers.authorization && headers.authorization.startsWith('Bearer ')) {
        token = headers.authorization.replace('Bearer ', '');
      }
    });
    
    await page.goto(`${this.baseUrl}/complexes?ms=${this.gangnamBoundaries.centerLat},${this.gangnamBoundaries.centerLon},${this.gangnamBoundaries.zoom}`, {
      waitUntil: 'networkidle'
    });
    
    await page.waitForTimeout(3000);
    await browser.close();
    
    if (token) {
      console.log('JWT 토큰 획득 성공');
      this.jwtToken = token;
      this.headers.authorization = `Bearer ${token}`;
    } else {
      throw new Error('JWT 토큰 획득 실패');
    }
    
    return token;
  }

  /**
   * 강남구 및 인근 지역 단지 필터링 (200개 목표)
   */
  filterGangnamComplexes(complexes) {
    const { bounds } = this.gangnamBoundaries;
    
    return complexes.filter(complex => {
      // 1. 좌표 기반 필터링 (확장된 강남 지역 경계 내)
      const withinBounds = 
        complex.latitude >= bounds.southLat && 
        complex.latitude <= bounds.northLat &&
        complex.longitude >= bounds.westLon && 
        complex.longitude <= bounds.eastLon;
      
      // 2. 강남구 및 인근 관련 지역명 확인 (확장)
      const includedKeywords = [
        '강남', '역삼', '개포', '논현', '압구정', '청담', '삼성', 
        '대치', '신사', '도곡', '개포동', '역삼동', '논현동', 
        '압구정동', '청담동', '삼성동', '대치동', '신사동', '도곡동',
        '선릉', '학동', '강남역', '역삼역', '선정릉', '한티',
        '수서', '일원', '세곡', '자곡'  // 강남구 인근 지역 추가
      ];
      
      const hasIncludedKeyword = includedKeywords.some(keyword => 
        complex.complexName.includes(keyword)
      );
      
      // 3. 명확히 제외할 지역만 제한적으로 필터링
      const strictlyExcludedKeywords = [
        '마포', '용산', '종로', '중구', '성동', '광진', '동대문',
        '중랑', '성북', '강북', '도봉', '노원', '은평', '서대문',
        '양천', '강서', '구로', '금천', '영등포', '동작', '관악',
        '서초우면', '방배역', '고속터미널', '교대역인근제외지역'
      ];
      
      const hasStrictlyExcludedKeyword = strictlyExcludedKeywords.some(keyword => 
        complex.complexName.includes(keyword)
      );
      
      // 최종 판단: 경계 내이면서 제외 키워드가 없거나, 포함 키워드가 있는 경우
      return withinBounds && !hasStrictlyExcludedKeyword;
    });
  }

  /**
   * 지역 경계 정보 가져오기
   */
  async getCortarBoundaries() {
    const url = `${this.baseUrl}/api/cortars`;
    const params = {
      zoom: this.gangnamBoundaries.zoom,
      centerLat: this.gangnamBoundaries.centerLat,
      centerLon: this.gangnamBoundaries.centerLon
    };
    
    try {
      const response = await axios.get(url, {
        headers: this.headers,
        params: params
      });
      
      console.log('지역 경계 정보 획득 성공');
      return response.data;
    } catch (error) {
      console.error('지역 경계 정보 획득 실패:', error.message);
      return null;
    }
  }

  /**
   * 단지 마커 데이터 가져오기 (서울시 전체에서 수집 후 필터링)
   */
  async getComplexMarkers() {
    const url = `${this.baseUrl}/api/complexes/single-markers/2.0`;
    
    // 서울시 전체를 포함하는 넓은 범위로 수집
    const wideBounds = {
      leftLon: 126.8,
      rightLon: 127.2,
      topLat: 37.6,
      bottomLat: 37.4
    };
    
    const params = {
      cortarNo: '1168000000',  // 서울시 강남구 지역 코드
      zoom: this.gangnamBoundaries.zoom,
      priceType: 'RETAIL',
      markerId: '',
      markerType: '',
      selectedComplexNo: '',
      selectedComplexBuildingNo: '',
      fakeComplexMarker: '',
      realEstateType: 'APT:PRE:ABYG:JGC',
      tradeType: '',
      tag: '::::::::',
      rentPriceMin: 0,
      rentPriceMax: 900000000,
      priceMin: 0,
      priceMax: 900000000,
      areaMin: 0,
      areaMax: 900000000,
      oldBuildYears: '',
      recentlyBuildYears: '',
      minHouseHoldCount: '',
      maxHouseHoldCount: '',
      showArticle: false,
      sameAddressGroup: false,
      minMaintenanceCost: '',
      maxMaintenanceCost: '',
      directions: '',
      isPresale: true,
      ...wideBounds
    };
    
    try {
      const response = await axios.get(url, {
        headers: this.headers,
        params: params
      });
      
      console.log(`서울시 전체 단지 데이터 수집: ${response.data.length}개`);
      
      // 강남구 지역만 필터링
      const gangnamComplexes = this.filterGangnamComplexes(response.data);
      console.log(`강남구 필터링 결과: ${gangnamComplexes.length}개 단지`);
      
      return gangnamComplexes;
    } catch (error) {
      console.error('단지 마커 데이터 획득 실패:', error.message);
      if (error.response) {
        console.error('응답 상태:', error.response.status);
        console.error('응답 데이터:', error.response.data);
      }
      return [];
    }
  }

  /**
   * 개발 계획 정보 가져오기 (강남구 범위만)
   */
  async getDevelopmentPlans() {
    const plans = {
      road: [],
      rail: [],
      jigu: []
    };
    
    const { bounds } = this.gangnamBoundaries;
    const params = {
      zoom: this.gangnamBoundaries.zoom,
      leftLon: bounds.westLon,
      rightLon: bounds.eastLon,
      topLat: bounds.northLat,
      bottomLat: bounds.southLat
    };
    
    try {
      const [roadResponse, railResponse, jiguResponse] = await Promise.all([
        axios.get(`${this.baseUrl}/api/developmentplan/road/list`, {
          headers: this.headers, params
        }),
        axios.get(`${this.baseUrl}/api/developmentplan/rail/list`, {
          headers: this.headers, params
        }),
        axios.get(`${this.baseUrl}/api/developmentplan/jigu/list`, {
          headers: this.headers, params
        })
      ]);
      
      plans.road = roadResponse.data;
      plans.rail = railResponse.data;
      plans.jigu = jiguResponse.data;
      
      console.log(`개발 계획: 도로 ${plans.road.length}개, 철도 ${plans.rail.length}개, 지구 ${plans.jigu.length}개`);
    } catch (error) {
      console.error('개발 계획 조회 실패:', error.message);
    }
    
    return plans;
  }

  /**
   * 데이터 분석 및 통계
   */
  analyzeData(complexes) {
    if (!complexes || complexes.length === 0) {
      return null;
    }
    
    const stats = {
      totalComplexes: complexes.length,
      totalHouseholds: 0,
      averageDealPrice: 0,
      averageLeasePrice: 0,
      priceRange: {
        minDeal: Infinity,
        maxDeal: 0,
        minLease: Infinity,
        maxLease: 0
      },
      complexesByType: {},
      recentComplexes: [],
      dongDistribution: {} // 동별 분포 추가
    };
    
    let dealPriceSum = 0;
    let dealPriceCount = 0;
    let leasePriceSum = 0;
    let leasePriceCount = 0;
    
    complexes.forEach(complex => {
      stats.totalHouseholds += complex.totalHouseholdCount || 0;
      
      const type = complex.realEstateTypeName || '기타';
      stats.complexesByType[type] = (stats.complexesByType[type] || 0) + 1;
      
      // 동별 분포 (단지명에서 동명 추출)
      let dong = '기타';
      const dongKeywords = ['역삼', '개포', '논현', '압구정', '청담', '삼성', '대치', '신사', '도곡'];
      for (const keyword of dongKeywords) {
        if (complex.complexName.includes(keyword)) {
          dong = keyword;
          break;
        }
      }
      
      stats.dongDistribution[dong] = (stats.dongDistribution[dong] || 0) + 1;
      
      if (complex.medianDealPrice) {
        dealPriceSum += complex.medianDealPrice;
        dealPriceCount++;
        stats.priceRange.minDeal = Math.min(stats.priceRange.minDeal, complex.minDealPrice || Infinity);
        stats.priceRange.maxDeal = Math.max(stats.priceRange.maxDeal, complex.maxDealPrice || 0);
      }
      
      if (complex.medianLeasePrice) {
        leasePriceSum += complex.medianLeasePrice;
        leasePriceCount++;
        stats.priceRange.minLease = Math.min(stats.priceRange.minLease, complex.minLeasePrice || Infinity);
        stats.priceRange.maxLease = Math.max(stats.priceRange.maxLease, complex.maxLeasePrice || 0);
      }
      
      if (complex.completionYearMonth && parseInt(complex.completionYearMonth.substring(0, 4)) >= 2020) {
        stats.recentComplexes.push({
          name: complex.complexName,
          completionDate: complex.completionYearMonth,
          households: complex.totalHouseholdCount,
          dong: dong
        });
      }
    });
    
    stats.averageDealPrice = dealPriceCount > 0 ? Math.round(dealPriceSum / dealPriceCount) : 0;
    stats.averageLeasePrice = leasePriceCount > 0 ? Math.round(leasePriceSum / leasePriceCount) : 0;
    
    if (stats.priceRange.minDeal === Infinity) stats.priceRange.minDeal = 0;
    if (stats.priceRange.minLease === Infinity) stats.priceRange.minLease = 0;
    
    return stats;
  }

  /**
   * 리포트 생성
   */
  generateReport(data) {
    const { complexes, statistics, developmentPlans, collectionTime } = data;
    
    let report = `# 서울 강남구 부동산 데이터 분석 리포트

## 수집 정보
- 수집 일시: ${collectionTime}
- 지역: 서울특별시 강남구
- 중심 좌표: ${this.gangnamBoundaries.centerLat}, ${this.gangnamBoundaries.centerLon}
- 필터링 범위: 위도 ${this.gangnamBoundaries.bounds.southLat}~${this.gangnamBoundaries.bounds.northLat}, 경도 ${this.gangnamBoundaries.bounds.westLon}~${this.gangnamBoundaries.bounds.eastLon}

## 통계 요약
`;

    if (statistics) {
      report += `
- 총 단지 수: ${statistics.totalComplexes}개
- 총 세대 수: ${statistics.totalHouseholds.toLocaleString()}세대
- 평균 매매가: ${statistics.averageDealPrice.toLocaleString()}만원
- 평균 전세가: ${statistics.averageLeasePrice.toLocaleString()}만원
- 매매가 범위: ${statistics.priceRange.minDeal.toLocaleString()} ~ ${statistics.priceRange.maxDeal.toLocaleString()}만원
- 전세가 범위: ${statistics.priceRange.minLease.toLocaleString()} ~ ${statistics.priceRange.maxLease.toLocaleString()}만원

### 부동산 타입별 분포
`;
      
      for (const [type, count] of Object.entries(statistics.complexesByType)) {
        report += `- ${type}: ${count}개\n`;
      }
      
      report += `\n### 동별 분포\n`;
      for (const [dong, count] of Object.entries(statistics.dongDistribution)) {
        report += `- ${dong}: ${count}개\n`;
      }
      
      if (statistics.recentComplexes.length > 0) {
        report += `\n### 최근 준공 단지 (2020년 이후)\n`;
        statistics.recentComplexes.forEach(complex => {
          report += `- ${complex.name} (${complex.completionDate}, ${complex.households}세대, ${complex.dong})\n`;
        });
      }
    }

    report += `\n## 개발 계획
- 도로 개발: ${developmentPlans.road.length}건
- 철도 개발: ${developmentPlans.rail.length}건
- 지구 개발: ${developmentPlans.jigu.length}건

## 주요 단지 정보 (강남구 내)
`;

    const topComplexes = complexes
      .sort((a, b) => (b.medianDealPrice || 0) - (a.medianDealPrice || 0))
      .slice(0, 10);
    
    topComplexes.forEach((complex, index) => {
      report += `
### ${index + 1}. ${complex.complexName}
- 위치: 위도 ${complex.latitude}, 경도 ${complex.longitude}
- 세대수: ${complex.totalHouseholdCount}세대
- 동수: ${complex.totalDongCount}동
- 준공: ${complex.completionYearMonth || '정보없음'}
- 매매 중간가: ${complex.medianDealPrice ? complex.medianDealPrice.toLocaleString() + '만원' : '정보없음'}
- 전세 중간가: ${complex.medianLeasePrice ? complex.medianLeasePrice.toLocaleString() + '만원' : '정보없음'}
- 매물 수: 매매 ${complex.dealCount || 0}건, 전세 ${complex.leaseCount || 0}건, 월세 ${complex.rentCount || 0}건
`;
    });

    return report;
  }

  /**
   * CSV 형식으로 데이터 변환
   */
  generateCSV(complexes) {
    const headers = [
      '단지명', '위도', '경도', '부동산타입', '준공년월', '총동수', '총세대수',
      '용적률', '최소매매가', '최대매매가', '중간매매가', '최소전세가', '최대전세가', 
      '중간전세가', '최소월세', '최대월세', '최소면적', '최대면적', '대표면적',
      '매매매물수', '전세매물수', '월세매물수', '총매물수', '분양여부', '사진수'
    ];
    
    let csv = headers.join(',') + '\n';
    
    complexes.forEach(complex => {
      const row = [
        `"${complex.complexName || ''}"`,
        complex.latitude || '',
        complex.longitude || '',
        `"${complex.realEstateTypeName || ''}"`,
        complex.completionYearMonth || '',
        complex.totalDongCount || '',
        complex.totalHouseholdCount || '',
        complex.floorAreaRatio || '',
        complex.minDealPrice || '',
        complex.maxDealPrice || '',
        complex.medianDealPrice || '',
        complex.minLeasePrice || '',
        complex.maxLeasePrice || '',
        complex.medianLeasePrice || '',
        complex.minRentPrice || '',
        complex.maxRentPrice || '',
        complex.minArea || '',
        complex.maxArea || '',
        complex.representativeArea || '',
        complex.dealCount || '',
        complex.leaseCount || '',
        complex.rentCount || '',
        complex.totalArticleCount || '',
        complex.isPresales || '',
        complex.photoCount || ''
      ];
      csv += row.join(',') + '\n';
    });
    
    return csv;
  }

  /**
   * 결과 저장 (JSON, MD, CSV)
   */
  async saveResults(data) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // JSON 파일 저장
    const jsonFilename = `gangnam_data_${timestamp}.json`;
    await fs.writeFile(jsonFilename, JSON.stringify(data, null, 2), 'utf8');
    console.log(`\nJSON 데이터 저장 완료: ${jsonFilename}`);
    
    // 마크다운 리포트 저장
    const reportFilename = `gangnam_report_${timestamp}.md`;
    const report = this.generateReport(data);
    await fs.writeFile(reportFilename, report, 'utf8');
    console.log(`마크다운 리포트 저장 완료: ${reportFilename}`);
    
    // CSV 파일 저장
    const csvFilename = `gangnam_data_${timestamp}.csv`;
    const csvContent = this.generateCSV(data.complexes);
    await fs.writeFile(csvFilename, csvContent, 'utf8');
    console.log(`CSV 데이터 저장 완료: ${csvFilename}`);
  }

  /**
   * 메인 실행 함수
   */
  async run() {
    try {
      console.log('=== 서울 강남구 부동산 데이터 수집 시작 ===\n');
      
      await this.getJWTToken();
      const cortarBounds = await this.getCortarBoundaries();
      const complexes = await this.getComplexMarkers();
      const developmentPlans = await this.getDevelopmentPlans();
      const statistics = this.analyzeData(complexes);
      
      const result = {
        collectionTime: new Date().toISOString(),
        location: {
          city: '서울특별시',
          gu: '강남구',
          coordinates: this.gangnamBoundaries,
          filteredArea: 'Only Gangnam-gu area'
        },
        cortarBounds,
        complexes,
        developmentPlans,
        statistics
      };
      
      await this.saveResults(result);
      
      console.log('\n=== 수집 완료 ===');
      console.log(`강남구 내 ${complexes.length}개 단지 데이터 수집`);
      if (statistics) {
        console.log(`평균 매매가: ${statistics.averageDealPrice.toLocaleString()}만원`);
        console.log(`평균 전세가: ${statistics.averageLeasePrice.toLocaleString()}만원`);
        console.log('동별 분포:', Object.entries(statistics.dongDistribution).map(([k,v]) => `${k}: ${v}개`).join(', '));
      }
      
    } catch (error) {
      console.error('데이터 수집 중 오류 발생:', error);
    }
  }
}

if (require.main === module) {
  const collector = new NaverRealEstateGangnamCollector();
  collector.run();
}

module.exports = NaverRealEstateGangnamCollector;