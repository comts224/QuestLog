
import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { auth } from './firebase'
import Dashboard from './Dashboard'
import Login from './Login'

function App() {
  // 현재 로그인한 사용자
  const [user, setUser] = useState<User | null>(null)

  // Firebase가 로그인 상태를 확인하는 중인지 나타냅니다.
  const [loading, setLoading] = useState(true)

  // 로그아웃 오류 메시지
  const [logoutError, setLogoutError] = useState('')

  useEffect(() => {
    // 로그인, 로그아웃, 새로고침 시 인증 상태를 확인합니다.
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser)
        setLoading(false)
      }
    )

    // 컴포넌트가 정리될 때 구독을 해제합니다.
    return () => unsubscribe()
  }, [])

  async function handleLogout() {
    setLogoutError('')

    try {
      await signOut(auth)
    } catch {
      setLogoutError('로그아웃에 실패했습니다. 다시 시도해 주세요.')
    }
  }

  // 로그인 상태 확인이 끝나기 전에는 화면을 잠시 대기시킵니다.
  if (loading) {
    return (
      <div className="auth-loading">
        모험가 정보를 확인하고 있습니다...
      </div>
    )
  }

  // 로그인하지 않았다면 로그인 화면 표시
  if (!user) {
    return <Login />
  }

  // 로그인한 사용자에게만 기존 대시보드 표시
  return (
    <>
      <div className="account-bar">
        <span>🧙 {user.email} 님의 모험</span>
        <button type="button" onClick={handleLogout}>
          로그아웃
        </button>
      </div>

      {logoutError && (
        <p className="logout-error" role="alert">
          {logoutError}
        </p>
      )}

      <Dashboard />
    </>
  )
}

export default App
