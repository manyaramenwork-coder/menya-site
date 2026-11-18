
// 배송일 기준 고정: 날짜 기준 선택 UI 숨김, 값은 항상 배송일
const dataNoteV3=dataNote; dataNote=function(){return dataNoteV3().replace('업데이트','배송일 기준 · 업데이트')};
