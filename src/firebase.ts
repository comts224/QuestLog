
import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// QuestLog Firebase 프로젝트 설정
const firebaseConfig = {
  apiKey: "AIzaSyCNVQevIllueNj8I9oih0h40ceOgzBb0d8",
  authDomain: "questlog-f1065.firebaseapp.com",
  projectId: "questlog-f1065",
  storageBucket: "questlog-f1065.firebasestorage.app",
  messagingSenderId: "666728030351",
  appId: "1:666728030351:web:ff490b39b16075b060d0fa"
}

// Firebase 앱 중복 초기화 방지
const app = getApps().length > 0
  ? getApp()
  : initializeApp(firebaseConfig)

// Firebase Authentication (회원가입, 로그인, 로그아웃)
export const auth = getAuth(app)

// Cloud Firestore (퀘스트, 캐릭터, 일기장 데이터 저장)
export const db = getFirestore(app)
