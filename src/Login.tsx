
import { useState, type FormEvent } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { auth } from './firebase'
import './Login.css'

// Firebase 오류 메시지를 사용자에게 이해하기 쉽게 바꿉니다.
function getErrorMessage(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return '이미 사용 중인 이메일입니다.'
    case 'auth/invalid-email':
      return '이메일 형식을 확인해 주세요.'
    case 'auth/weak-password':
      return '비밀번호가 너무 약합니다. 더 안전한 비밀번호를 사용해 주세요.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return '이메일 또는 비밀번호가 올바르지 않습니다.'
    case 'auth/too-many-requests':
      return '로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.'
    case 'auth/network-request-failed':
      return '네트워크 연결을 확인해 주세요.'
    case 'auth/operation-not-allowed':
      return 'Firebase에서 이메일/비밀번호 로그인을 활성화해 주세요.'
    default:
      return '인증 처리 중 오류가 발생했습니다. 다시 시도해 주세요.'
  }
}

function Login() {
  // true면 회원가입, false면 로그인
  const [isSignUp, setIsSignUp] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!email.trim() || !password) {
      setError('이메일과 비밀번호를 입력해 주세요.')
      return
    }

    if (isSignUp && password !== confirmPassword) {
      setError('비밀번호 확인이 일치하지 않습니다.')
      return
    }

    setLoading(true)

    try {
      if (isSignUp) {
        // Firebase에 새 사용자 계정을 생성합니다.
        await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        )
      } else {
        // 기존 계정으로 로그인합니다.
        await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        )
      }

      // 성공하면 App.tsx에서 로그인 상태를 감지합니다.
    } catch (err: unknown) {
      const code =
        err !== null &&
        typeof err === 'object' &&
        'code' in err &&
        typeof err.code === 'string'
          ? err.code
          : ''

      setError(getErrorMessage(code))
    } finally {
      setLoading(false)
    }
  }

  function switchMode() {
    setIsSignUp((previous) => !previous)
    setError('')
    setConfirmPassword('')
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-symbol">⚔️</div>

        <p className="login-eyebrow">YOUR DAILY ADVENTURE</p>
        <h1>QuestLog</h1>
        <p className="login-description">
          오늘의 할 일을 퀘스트로 바꾸고
          <br />
          나만의 모험가를 성장시키세요.
        </p>

        <h2>{isSignUp ? '모험가 등록' : '모험 시작하기'}</h2>

        <form onSubmit={handleSubmit}>
          <label htmlFor="email">이메일</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="example@email.com"
            autoComplete="email"
            required
          />

          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="비밀번호 입력"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            required
          />

          {isSignUp && (
            <>
              <label htmlFor="confirmPassword">비밀번호 확인</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                placeholder="비밀번호 다시 입력"
                autoComplete="new-password"
                required
              />
            </>
          )}

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button
            className="login-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? '처리 중...'
              : isSignUp
                ? '모험가 등록하기'
                : '로그인'}
          </button>
        </form>

        <p className="login-switch">
          {isSignUp ? '이미 계정이 있으신가요?' : '아직 계정이 없으신가요?'}
          <button type="button" onClick={switchMode}>
            {isSignUp ? '로그인' : '회원가입'}
          </button>
        </p>
      </section>
    </main>
  )
}

export default Login
