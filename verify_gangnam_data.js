const data = require('./gangnam_data_2025-08-09T03-01-42-463Z.json');

console.log('=== 강남구 필터링 결과 검증 ===\n');

console.log(`총 수집된 단지 수: ${data.complexes.length}개`);
console.log(`필터링 범위: 위도 ${data.location.coordinates.bounds.southLat}~${data.location.coordinates.bounds.northLat}, 경도 ${data.location.coordinates.bounds.westLon}~${data.location.coordinates.bounds.eastLon}\n`);

// 동별 분포 확인
console.log('=== 동별 분포 ===');
console.log(data.statistics.dongDistribution);

console.log('\n=== 상위 10개 고가 단지 위치 검증 ===');
data.complexes
  .sort((a, b) => (b.medianDealPrice || 0) - (a.medianDealPrice || 0))
  .slice(0, 10)
  .forEach((complex, i) => {
    const withinBounds = 
      complex.latitude >= 37.485 && complex.latitude <= 37.54 &&
      complex.longitude >= 127.02 && complex.longitude <= 127.07;
    
    console.log(`${i+1}. ${complex.complexName}`);
    console.log(`   위치: ${complex.latitude}, ${complex.longitude} ${withinBounds ? '✓' : '✗'}`);
    console.log(`   매매가: ${complex.medianDealPrice ? complex.medianDealPrice.toLocaleString() + '만원' : '정보없음'}`);
  });

console.log('\n=== 경계 밖 단지 확인 ===');
const outsideBounds = data.complexes.filter(complex => 
  !(complex.latitude >= 37.485 && complex.latitude <= 37.54 &&
    complex.longitude >= 127.02 && complex.longitude <= 127.07)
);

if (outsideBounds.length > 0) {
  console.log(`경계 밖 단지 ${outsideBounds.length}개 발견:`);
  outsideBounds.slice(0, 10).forEach(complex => {
    console.log(`- ${complex.complexName} (${complex.latitude}, ${complex.longitude})`);
  });
} else {
  console.log('모든 단지가 설정된 경계 내에 위치함 ✓');
}

console.log('\n=== 평균 가격 비교 ===');
console.log(`평균 매매가: ${data.statistics.averageDealPrice.toLocaleString()}만원 (약 ${Math.round(data.statistics.averageDealPrice/10000)}억원)`);
console.log(`평균 전세가: ${data.statistics.averageLeasePrice.toLocaleString()}만원 (약 ${Math.round(data.statistics.averageLeasePrice/10000)}억원)`);
console.log(`전세가율: ${Math.round((data.statistics.averageLeasePrice / data.statistics.averageDealPrice) * 100)}%`);

console.log('\n=== 대표 강남구 단지들 ===');
const gangnamKeywords = ['역삼', '개포', '논현', '압구정', '청담', '삼성', '대치', '신사', '도곡'];
const representativeComplexes = data.complexes.filter(complex => 
  gangnamKeywords.some(keyword => complex.complexName.includes(keyword))
);

console.log(`강남구 키워드 포함 단지: ${representativeComplexes.length}개`);
representativeComplexes.slice(0, 10).forEach(complex => {
  console.log(`- ${complex.complexName} (${complex.medianDealPrice ? complex.medianDealPrice.toLocaleString() + '만원' : '정보없음'})`);
});