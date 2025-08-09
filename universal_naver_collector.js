const axios = require('axios');
const fs = require('fs').promises;
const { chromium } = require('playwright');
const path = require('path');
const readline = require('readline');

/**
 * 통합 네이버 부동산 데이터 수집기 - 전국 모든 지역 지원
 */
class UniversalNaverRealEstateCollector {
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
    
    // 지역 데이터베이스
    this.regionDatabase = this.buildRegionDatabase();
    this.currentRegion = null;
  }

  /**
   * 전국 지역 데이터베이스 구축
   */
  buildRegionDatabase() {
    return {
      // 서울특별시
      '강남구': {
        cortarNo: '1168000000',
        centerLat: 37.5172, centerLon: 127.0473,
        bounds: { northLat: 37.555, southLat: 37.470, eastLon: 127.085, westLon: 127.005 },
        keywords: ['강남', '역삼', '개포', '논현', '압구정', '청담', '삼성', '대치', '신사', '도곡'],
        excludeKeywords: ['마포', '용산', '종로', '중구']
      },
      '서초구': {
        cortarNo: '1165000000',
        centerLat: 37.495, centerLon: 127.015,
        bounds: { northLat: 37.520, southLat: 37.470, eastLon: 127.050, westLon: 126.980 },
        keywords: ['서초', '방배', '잠원', '반포', '내곡', '양재', '우면'],
        excludeKeywords: ['강남', '송파', '관악']
      },
      '송파구': {
        cortarNo: '1171000000',
        centerLat: 37.505, centerLon: 127.115,
        bounds: { northLat: 37.530, southLat: 37.480, eastLon: 127.150, westLon: 127.080 },
        keywords: ['잠실', '송파', '문정', '가락', '석촌', '방이', '오금'],
        excludeKeywords: ['강남', '서초', '강동']
      },
      '마포구': {
        cortarNo: '1144000000',
        centerLat: 37.555, centerLon: 126.925,
        bounds: { northLat: 37.580, southLat: 37.530, eastLon: 126.960, westLon: 126.890 },
        keywords: ['홍대', '상수', '합정', '망원', '연남', '성산', '마포'],
        excludeKeywords: ['강남', '용산', '서대문']
      },
      '영등포구': {
        cortarNo: '1156000000',
        centerLat: 37.525, centerLon: 126.900,
        bounds: { northLat: 37.545, southLat: 37.505, eastLon: 126.925, westLon: 126.875 },
        keywords: ['여의도', '영등포', '당산', '선유도', '문래'],
        excludeKeywords: ['구로', '관악', '동작']
      },
      '용산구': {
        cortarNo: '1117000000',
        centerLat: 37.535, centerLon: 126.985,
        bounds: { northLat: 37.555, southLat: 37.515, eastLon: 127.010, westLon: 126.960 },
        keywords: ['용산', '한남', '이태원', '청파', '원효', '효창'],
        excludeKeywords: ['강남', '마포', '중구']
      },

      // 부산광역시
      '해운대구': {
        cortarNo: '2626000000',
        centerLat: 35.163, centerLon: 129.163,
        bounds: { northLat: 35.190, southLat: 35.136, eastLon: 129.190, westLon: 129.136 },
        keywords: ['해운대', '마린시티', '센텀시티', '우동', '중동', '좌동', '재송', '반송', '석대', '송정'],
        excludeKeywords: ['동래', '부산진', '중구', '서구', '영도']
      },
      '부산진구': {
        cortarNo: '2623000000',
        centerLat: 35.163, centerLon: 129.053,
        bounds: { northLat: 35.180, southLat: 35.146, eastLon: 129.080, westLon: 129.026 },
        keywords: ['서면', '전포', '부전', '양정', '연산', '부산진'],
        excludeKeywords: ['해운대', '동래', '중구']
      },

      // 대구광역시
      '수성구': {
        cortarNo: '2729000000',
        centerLat: 35.858, centerLon: 128.630,
        bounds: { northLat: 35.880, southLat: 35.836, eastLon: 128.660, westLon: 128.600 },
        keywords: ['수성', '범어', '만촌', '황금', '두산', '지산'],
        excludeKeywords: ['달서', '중구', '동구']
      },

      // 경기도
      '수원시': {
        cortarNo: '4111100000',
        centerLat: 37.263, centerLon: 127.015,
        bounds: { northLat: 37.320, southLat: 37.206, eastLon: 127.080, westLon: 126.950 },
        keywords: ['수원', '영통', '팔달', '장안', '권선', '광교', '망포'],
        excludeKeywords: ['용인', '성남', '화성']
      },
      '성남시': {
        cortarNo: '4113100000',
        centerLat: 37.420, centerLon: 127.130,
        bounds: { northLat: 37.460, southLat: 37.380, eastLon: 127.170, westLon: 127.090 },
        keywords: ['분당', '판교', '성남', '수내', '정자', '서현', '야탑'],
        excludeKeywords: ['용인', '광주', '하남']
      },
      '용인시': {
        cortarNo: '4146100000',
        centerLat: 37.240, centerLon: 127.180,
        bounds: { northLat: 37.320, southLat: 37.160, eastLon: 127.260, westLon: 127.100 },
        keywords: ['용인', '기흥', '수지', '처인', '동백', '죽전'],
        excludeKeywords: ['성남', '수원', '안성']
      },

      // 인천광역시
      '연수구': {
        cortarNo: '2818500000',
        centerLat: 37.410, centerLon: 126.678,
        bounds: { northLat: 37.430, southLat: 37.390, eastLon: 126.700, westLon: 126.656 },
        keywords: ['연수', '송도', '청학', '옥련'],
        excludeKeywords: ['남동', '중구', '서구']
      }
    };
  }

  /**
   * 사용 가능한 지역 목록 표시
   */
  displayAvailableRegions() {
    console.log('\n🗺️ 사용 가능한 지역 목록:\n');
    
    const regions = Object.keys(this.regionDatabase);
    const categories = {
      '서울': ['강남구', '서초구', '송파구', '마포구', '영등포구', '용산구'],
      '부산': ['해운대구', '부산진구'],
      '대구': ['수성구'],
      '경기': ['수원시', '성남시', '용인시'],
      '인천': ['연수구']
    };
    
    for (const [city, cityRegions] of Object.entries(categories)) {
      console.log(`📍 ${city}:`);
      cityRegions.forEach((region, index) => {
        if (regions.includes(region)) {
          console.log(`   ${index + 1}. ${region}`);
        }
      });
      console.log('');
    }
    
    console.log('💡 사용법: "강남구", "해운대구", "수원시" 등으로 입력하세요\n');
  }

  /**
   * 사용자 입력을 받아 지역 선택
   */
  async selectRegion() {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      this.displayAvailableRegions();
      
      rl.question('🎯 수집할 지역을 입력하세요: ', (regionInput) => {
        const region = regionInput.trim();
        
        if (this.regionDatabase[region]) {
          console.log(`✅ "${region}" 선택됨\n`);
          this.currentRegion = this.regionDatabase[region];
          this.currentRegion.name = region;
          rl.close();
          resolve(region);
        } else {
          console.log(`❌ "${region}"는 지원하지 않는 지역입니다.`);
          console.log('📝 지원 지역:', Object.keys(this.regionDatabase).join(', '));
          rl.close();
          resolve(null);
        }
      });
    });
  }

  /**
   * 캐시된 토큰 로드
   */
  async loadCachedToken() {
    try {
      const cacheData = await fs.readFile(this.tokenCacheFile, 'utf8');
      const cache = JSON.parse(cacheData);
      
      const tokenAge = Date.now() - cache.timestamp;
      const oneHour = 60 * 60 * 1000;
      
      if (tokenAge < oneHour && cache.token) {
        console.log('✅ 캐시된 JWT 토큰 사용');
        this.headers.authorization = `Bearer ${cache.token}`;
        return cache.token;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 토큰 캐시 저장
   */
  async saveCachedToken(token) {
    const cacheData = {
      token: token,
      timestamp: Date.now(),
      expiry: Date.now() + (60 * 60 * 1000)
    };
    
    await fs.writeFile(this.tokenCacheFile, JSON.stringify(cacheData, null, 2));
    console.log('💾 JWT 토큰 캐시 저장');
  }

  /**
   * 새 JWT 토큰 획득
   */
  async getNewJWTToken() {
    console.log('🎭 새 JWT 토큰 획득 중...');
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
    
    await page.goto(`${this.baseUrl}/complexes?ms=${this.currentRegion.centerLat},${this.currentRegion.centerLon},12`, {
      waitUntil: 'networkidle'
    });
    
    await page.waitForTimeout(3000);
    await browser.close();
    
    const endTime = Date.now();
    console.log(`⏱️ 토큰 획득: ${endTime - startTime}ms`);
    
    if (token) {
      this.headers.authorization = `Bearer ${token}`;
      await this.saveCachedToken(token);
      return token;
    } else {
      throw new Error('JWT 토큰 획득 실패');
    }
  }

  /**
   * 스마트 토큰 관리
   */
  async ensureValidToken() {
    let token = await this.loadCachedToken();
    
    if (!token) {
      token = await this.getNewJWTToken();
    }
    
    return token;
  }

  /**
   * 동적 지역 필터링
   */
  filterRegionComplexes(complexes) {
    if (!this.currentRegion) return [];
    
    const { bounds, keywords, excludeKeywords } = this.currentRegion;
    
    return complexes.filter(complex => {
      // 1. 좌표 기반 필터링
      const withinBounds = 
        complex.latitude >= bounds.southLat && 
        complex.latitude <= bounds.northLat &&
        complex.longitude >= bounds.westLon && 
        complex.longitude <= bounds.eastLon;
      
      // 2. 포함 키워드 확인
      const hasIncludedKeyword = keywords.some(keyword => 
        complex.complexName.includes(keyword)
      );
      
      // 3. 제외 키워드 확인
      const hasExcludedKeyword = excludeKeywords.some(keyword => 
        complex.complexName.includes(keyword)
      );
      
      return withinBounds && !hasExcludedKeyword;
    });
  }

  /**
   * 지역 데이터 수집
   */
  async getRegionComplexData() {
    if (!this.currentRegion) {
      throw new Error('지역이 선택되지 않았습니다.');
    }

    const url = `${this.baseUrl}/api/complexes/single-markers/2.0`;
    
    // 지역별 범위 계산 (현재 지역 중심으로 확장)
    const expandedBounds = {
      leftLon: this.currentRegion.bounds.westLon - 0.1,
      rightLon: this.currentRegion.bounds.eastLon + 0.1,
      topLat: this.currentRegion.bounds.northLat + 0.05,
      bottomLat: this.currentRegion.bounds.southLat - 0.05
    };
    
    const params = {
      cortarNo: this.currentRegion.cortarNo,
      zoom: 12,
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
      ...expandedBounds
    };
    
    try {
      const startTime = Date.now();
      const response = await axios.get(url, {
        headers: this.headers,
        params: params,
        timeout: 10000
      });
      
      const endTime = Date.now();
      console.log(`⚡ API 호출: ${endTime - startTime}ms`);
      
      const allComplexes = response.data || [];
      
      if (!Array.isArray(allComplexes)) {
        console.log('⚠️ API 응답 오류:', allComplexes);
        return [];
      }
      
      const filteredComplexes = this.filterRegionComplexes(allComplexes);
      console.log(`📍 전체: ${allComplexes.length}개 → ${this.currentRegion.name}: ${filteredComplexes.length}개`);
      
      return filteredComplexes;
    } catch (error) {
      console.error('❌ 데이터 수집 실패:', error.message);
      
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.log('🔄 토큰 갱신 후 재시도');
        await this.getNewJWTToken();
        return this.getRegionComplexData();
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
      
      // 동적 동별 분포
      let dong = '기타';
      if (this.currentRegion && this.currentRegion.keywords) {
        for (const keyword of this.currentRegion.keywords) {
          if (complex.complexName.includes(keyword)) {
            dong = keyword;
            break;
          }
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
    const regionName = this.currentRegion.name.replace(/[가-힣]/g, match => {
      const code = match.charCodeAt(0) - 0xAC00;
      const cho = Math.floor(code / 588);
      const jung = Math.floor((code - cho * 588) / 28);
      const jong = code - cho * 588 - jung * 28;
      return String.fromCharCode(cho + 0x1100, jung + 0x1161, jong ? jong + 0x11A7 : 0x11A7);
    }).replace(/\0/g, '');
    
    const safeRegionName = this.currentRegion.name.replace(/[^\w가-힣]/g, '_');
    
    const data = {
      collectionTime: new Date().toISOString(),
      region: this.currentRegion.name,
      location: `${this.currentRegion.name} 지역`,
      method: 'Universal Region Collector with Token Caching',
      complexes,
      statistics
    };
    
    // JSON 저장
    const jsonFile = `${safeRegionName}_data_${timestamp}.json`;
    await fs.writeFile(jsonFile, JSON.stringify(data, null, 2), 'utf8');
    
    // CSV 저장
    const csvFile = `${safeRegionName}_data_${timestamp}.csv`;
    const csvContent = this.generateCSV(complexes);
    await fs.writeFile(csvFile, csvContent, 'utf8');
    
    console.log(`💾 ${this.currentRegion.name} 데이터 저장: ${jsonFile}, ${csvFile}`);
    
    return { jsonFile, csvFile };
  }

  /**
   * 메인 실행 함수
   */
  async run() {
    try {
      console.log('🌍 통합 네이버 부동산 지역별 데이터 수집기');
      console.log('=' .repeat(50));
      
      // 지역 선택
      const selectedRegion = await this.selectRegion();
      if (!selectedRegion) {
        console.log('❌ 지역 선택이 취소되었습니다.');
        return;
      }
      
      const totalStartTime = Date.now();
      
      console.log(`🚀 ${selectedRegion} 데이터 수집 시작\n`);
      
      await this.ensureValidToken();
      const complexes = await this.getRegionComplexData();
      const statistics = this.analyzeData(complexes);
      const files = await this.saveResults(complexes, statistics);
      
      const totalEndTime = Date.now();
      const totalTime = totalEndTime - totalStartTime;
      
      console.log(`\n✅ ${selectedRegion} 데이터 수집 완료`);
      console.log(`🏢 수집 단지: ${complexes.length}개`);
      console.log(`⏱️ 총 실행시간: ${totalTime}ms (${(totalTime/1000).toFixed(1)}초)`);
      
      if (statistics) {
        console.log(`💰 평균 매매가: ${statistics.averageDealPrice.toLocaleString()}만원`);
        console.log(`🏠 평균 전세가: ${statistics.averageLeasePrice.toLocaleString()}만원`);
        console.log(`📊 지역 분포: ${Object.entries(statistics.dongDistribution).map(([k,v]) => `${k}:${v}개`).join(', ')}`);
      }
      
      return { complexes, statistics, files };
      
    } catch (error) {
      console.error('❌ 오류 발생:', error.message);
      throw error;
    }
  }
}

// CLI에서 직접 실행
if (require.main === module) {
  const collector = new UniversalNaverRealEstateCollector();
  collector.run()
    .then(() => {
      console.log('\n👋 수집을 완료했습니다. 프로그램을 종료합니다.');
      process.exit(0);
    })
    .catch(() => process.exit(1));
}

module.exports = UniversalNaverRealEstateCollector;