const axios = require('axios');
const fs = require('fs').promises;
const { chromium } = require('playwright');
const path = require('path');

/**
 * 최적화된 네이버 부동산 크롤러 - 토큰 캐싱 방식
 */
class OptimizedNaverRealEstateCollector {
  constructor() {
    this.baseUrl = 'https://new.land.naver.com';
    this.tokenCacheFile = path.join(__dirname, 'token_cache.json');
    this.headers = {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
      'sec-ch-ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'referer': 'https://new.land.naver.com/'
    };
    
    this.gangnamBoundaries = {
      centerLat: 37.5172,
      centerLon: 127.0473,
      zoom: 12,
      bounds: {
        northLat: 37.555,
        southLat: 37.470,
        eastLon: 127.085,
        westLon: 127.005
      }
    };
  }

  /**
   * 캐시된 토큰 로드
   */
  async loadCachedToken() {
    try {
      const cacheData = await fs.readFile(this.tokenCacheFile, 'utf8');
      const cache = JSON.parse(cacheData);
      
      // 토큰이 1시간 이내인지 체크
      const tokenAge = Date.now() - cache.timestamp;
      const oneHour = 60 * 60 * 1000;
      
      if (tokenAge < oneHour && cache.token) {
        console.log('✅ 캐시된 JWT 토큰 사용 (유효시간 남음)');
        this.headers.authorization = `Bearer ${cache.token}`;
        return cache.token;
      }
      
      console.log('⏰ 캐시된 토큰 만료됨');
      return null;
    } catch (error) {
      console.log('📁 토큰 캐시 파일 없음');
      return null;
    }
  }

  /**
   * 토큰 캐시에 저장
   */
  async saveCachedToken(token) {
    const cacheData = {
      token: token,
      timestamp: Date.now(),
      expiry: Date.now() + (60 * 60 * 1000) // 1시간 후 만료
    };
    
    await fs.writeFile(this.tokenCacheFile, JSON.stringify(cacheData, null, 2));
    console.log('💾 JWT 토큰 캐시 저장 완료');
  }

  /**
   * 토큰 유효성 테스트
   */
  async testTokenValidity() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/cortars`, {
        headers: this.headers,
        params: {
          zoom: this.gangnamBoundaries.zoom,
          centerLat: this.gangnamBoundaries.centerLat,
          centerLon: this.gangnamBoundaries.centerLon
        },
        timeout: 5000
      });
      
      return response.status === 200;
    } catch (error) {
      console.log('❌ 토큰 유효성 검증 실패');
      return false;
    }
  }

  /**
   * 새로운 JWT 토큰 획득 (Playwright 사용)
   */
  async getNewJWTToken() {
    console.log('🎭 Playwright로 새 JWT 토큰 획득 중...');
    const startTime = Date.now();
    
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
    
    const endTime = Date.now();
    console.log(`⏱️ 토큰 획득 시간: ${endTime - startTime}ms`);
    
    if (token) {
      this.headers.authorization = `Bearer ${token}`;
      await this.saveCachedToken(token);
      return token;
    } else {
      throw new Error('JWT 토큰 획득 실패');
    }
  }

  /**
   * 스마트 토큰 관리 (캐시 우선, 필요시 갱신)
   */
  async ensureValidToken() {
    // 1. 캐시된 토큰 시도
    let token = await this.loadCachedToken();
    
    if (token) {
      // 2. 토큰 유효성 테스트
      const isValid = await this.testTokenValidity();
      if (isValid) {
        return token;
      }
      console.log('🔄 캐시된 토큰이 무효함, 새 토큰 획득');
    }
    
    // 3. 새 토큰 획득
    return await this.getNewJWTToken();
  }

  /**
   * 강남구 단지 필터링
   */
  filterGangnamComplexes(complexes) {
    const { bounds } = this.gangnamBoundaries;
    
    return complexes.filter(complex => {
      const withinBounds = 
        complex.latitude >= bounds.southLat && 
        complex.latitude <= bounds.northLat &&
        complex.longitude >= bounds.westLon && 
        complex.longitude <= bounds.eastLon;
      
      const includedKeywords = [
        '강남', '역삼', '개포', '논현', '압구정', '청담', '삼성', 
        '대치', '신사', '도곡', '선릉', '학동', '수서', '일원'
      ];
      
      const hasIncludedKeyword = includedKeywords.some(keyword => 
        complex.complexName.includes(keyword)
      );
      
      const excludedKeywords = [
        '마포', '용산', '종로', '중구', '성동', '광진', '동대문',
        '중랑', '성북', '강북', '도봉', '노원', '은평', '서대문'
      ];
      
      const hasExcludedKeyword = excludedKeywords.some(keyword => 
        complex.complexName.includes(keyword)
      );
      
      return withinBounds && !hasExcludedKeyword;
    });
  }

  /**
   * 단지 데이터 수집 (최적화된 API 호출)
   */
  async getComplexData() {
    const url = `${this.baseUrl}/api/complexes/single-markers/2.0`;
    
    const params = {
      cortarNo: '1168000000',
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
      leftLon: 126.8,
      rightLon: 127.2,
      topLat: 37.6,
      bottomLat: 37.4
    };
    
    try {
      const startTime = Date.now();
      const response = await axios.get(url, {
        headers: this.headers,
        params: params,
        timeout: 10000
      });
      
      const endTime = Date.now();
      console.log(`⚡ API 호출 시간: ${endTime - startTime}ms`);
      
      const allComplexes = response.data || [];
      console.log(`🔍 API 응답 타입: ${typeof allComplexes}, 길이: ${Array.isArray(allComplexes) ? allComplexes.length : 'N/A'}`);
      
      if (!Array.isArray(allComplexes)) {
        console.log('⚠️ API 응답이 배열이 아님:', allComplexes);
        return [];
      }
      
      const filteredComplexes = this.filterGangnamComplexes(allComplexes);
      
      console.log(`📍 전체: ${allComplexes.length}개 → 강남구: ${filteredComplexes.length}개`);
      
      return filteredComplexes;
    } catch (error) {
      console.error('❌ 단지 데이터 수집 실패:', error.message);
      
      // 토큰 만료 에러인 경우 토큰 갱신 시도
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.log('🔄 토큰 만료로 인한 오류, 토큰 갱신 후 재시도');
        await this.getNewJWTToken();
        return this.getComplexData(); // 재귀 호출
      }
      
      return [];
    }
  }

  /**
   * 데이터 분석
   */
  analyzeData(complexes) {
    if (!complexes || complexes.length === 0) return null;
    
    const stats = {
      totalComplexes: complexes.length,
      totalHouseholds: 0,
      averageDealPrice: 0,
      averageLeasePrice: 0,
      priceRange: { minDeal: Infinity, maxDeal: 0, minLease: Infinity, maxLease: 0 },
      dongDistribution: {}
    };
    
    let dealPriceSum = 0, dealPriceCount = 0;
    let leasePriceSum = 0, leasePriceCount = 0;
    
    complexes.forEach(complex => {
      stats.totalHouseholds += complex.totalHouseholdCount || 0;
      
      // 동별 분포
      let dong = '기타';
      const dongKeywords = ['역삼', '개포', '논현', '압구정', '청담', '삼성', '대치', '신사', '도곡'];
      for (const keyword of dongKeywords) {
        if (complex.complexName.includes(keyword)) {
          dong = keyword;
          break;
        }
      }
      stats.dongDistribution[dong] = (stats.dongDistribution[dong] || 0) + 1;
      
      // 가격 통계
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
    });
    
    stats.averageDealPrice = dealPriceCount > 0 ? Math.round(dealPriceSum / dealPriceCount) : 0;
    stats.averageLeasePrice = leasePriceCount > 0 ? Math.round(leasePriceSum / leasePriceCount) : 0;
    
    if (stats.priceRange.minDeal === Infinity) stats.priceRange.minDeal = 0;
    if (stats.priceRange.minLease === Infinity) stats.priceRange.minLease = 0;
    
    return stats;
  }

  /**
   * CSV 생성
   */
  generateCSV(complexes) {
    const headers = [
      '단지명', '위도', '경도', '부동산타입', '준공년월', '총동수', '총세대수',
      '최소매매가', '최대매매가', '중간매매가', '최소전세가', '최대전세가', 
      '중간전세가', '매매매물수', '전세매물수', '월세매물수'
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
        complex.minDealPrice || '',
        complex.maxDealPrice || '',
        complex.medianDealPrice || '',
        complex.minLeasePrice || '',
        complex.maxLeasePrice || '',
        complex.medianLeasePrice || '',
        complex.dealCount || '',
        complex.leaseCount || '',
        complex.rentCount || ''
      ];
      csv += row.join(',') + '\n';
    });
    
    return csv;
  }

  /**
   * 결과 저장
   */
  async saveResults(complexes, statistics) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    const data = {
      collectionTime: new Date().toISOString(),
      method: 'Optimized with Token Caching',
      complexes,
      statistics
    };
    
    // JSON 저장
    const jsonFile = `gangnam_optimized_${timestamp}.json`;
    await fs.writeFile(jsonFile, JSON.stringify(data, null, 2), 'utf8');
    
    // CSV 저장
    const csvFile = `gangnam_optimized_${timestamp}.csv`;
    const csvContent = this.generateCSV(complexes);
    await fs.writeFile(csvFile, csvContent, 'utf8');
    
    console.log(`💾 결과 저장: ${jsonFile}, ${csvFile}`);
    
    return { jsonFile, csvFile };
  }

  /**
   * 메인 실행 함수
   */
  async run() {
    const totalStartTime = Date.now();
    
    try {
      console.log('🚀 최적화된 네이버 부동산 크롤러 시작\n');
      
      // 스마트 토큰 관리
      await this.ensureValidToken();
      
      // 데이터 수집
      const complexes = await this.getComplexData();
      const statistics = this.analyzeData(complexes);
      
      // 결과 저장
      const files = await this.saveResults(complexes, statistics);
      
      const totalEndTime = Date.now();
      const totalTime = totalEndTime - totalStartTime;
      
      console.log('\n✅ 수집 완료');
      console.log(`📊 강남구 단지: ${complexes.length}개`);
      console.log(`⏱️ 총 실행시간: ${totalTime}ms (${(totalTime/1000).toFixed(1)}초)`);
      
      if (statistics) {
        console.log(`💰 평균 매매가: ${statistics.averageDealPrice.toLocaleString()}만원`);
        console.log(`🏠 평균 전세가: ${statistics.averageLeasePrice.toLocaleString()}만원`);
        console.log(`🗺️ 동별 분포: ${Object.entries(statistics.dongDistribution).map(([k,v]) => `${k}:${v}개`).join(', ')}`);
      }
      
      return { complexes, statistics, files };
      
    } catch (error) {
      console.error('❌ 오류 발생:', error.message);
      throw error;
    }
  }

  /**
   * 캐시 파일 정리
   */
  async clearCache() {
    try {
      await fs.unlink(this.tokenCacheFile);
      console.log('🗑️ 토큰 캐시 삭제 완료');
    } catch (error) {
      console.log('📁 삭제할 캐시 파일 없음');
    }
  }
}

// CLI에서 직접 실행
if (require.main === module) {
  const collector = new OptimizedNaverRealEstateCollector();
  
  // 명령행 인자 처리
  const args = process.argv.slice(2);
  
  if (args.includes('--clear-cache')) {
    collector.clearCache().then(() => process.exit(0));
  } else {
    collector.run()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}

module.exports = OptimizedNaverRealEstateCollector;