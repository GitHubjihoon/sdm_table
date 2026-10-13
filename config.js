// Firebase 콘솔 > 프로젝트 설정 > 내 앱(웹) 에서 복사한 값으로 바꿔 넣으세요.
// 이 값들은 공개되어도 괜찮은 정보입니다. 실제 접근 제어는 firestore.rules 가 담당합니다.
// apiKey 가 "YOUR_" 로 시작하면 Firebase 없이 이 브라우저에만 저장되는 데모 모드로 동작합니다.
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000"
};

// 데이터가 저장될 문서 이름 (보통 바꿀 필요 없음)
export const BOARD_ID = "main";
