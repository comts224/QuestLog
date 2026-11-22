import { useEffect, useState, type FormEvent } from 'react'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import './ProfileNames.css'

type ProfileNamesProps = {
  userId: string
  level: number
}

type Profile = {
  nickname: string
  characterName: string
}

const EMPTY_PROFILE: Profile = { nickname: '', characterName: '' }

/**
 * 닉네임과 캐릭터 이름은 퀘스트 보상과 별개인 개인 프로필입니다.
 * 저장 경로: users/{uid}/profile/main
 * (기존 Firebase Security Rules의 사용자별 경로에 포함됩니다.)
 */
export default function ProfileNames({ userId, level }: ProfileNamesProps) {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE)
  const [nicknameInput, setNicknameInput] = useState('')
  const [characterInput, setCharacterInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setProfile(EMPTY_PROFILE)
    setEditing(false)
    setError('')

    const profileRef = doc(db, 'users', userId, 'profile', 'main')
    return onSnapshot(
      profileRef,
      (snapshot) => {
        const data = snapshot.data()
        setProfile({
          nickname: typeof data?.nickname === 'string' ? data.nickname : '',
          characterName:
            typeof data?.characterName === 'string' ? data.characterName : '',
        })
        setLoading(false)
      },
      () => {
        setError('프로필을 불러오지 못했습니다.')
        setLoading(false)
      },
    )
  }, [userId])

  const hasProfile = Boolean(profile.nickname && profile.characterName)
  const showForm = !loading && (!hasProfile || editing)

  function startEditing() {
    setNicknameInput(profile.nickname)
    setCharacterInput(profile.characterName)
    setError('')
    setEditing(true)
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return

    const nickname = nicknameInput.trim()
    const characterName = characterInput.trim()

    if (!nickname || !characterName || nickname.length > 20 || characterName.length > 20) {
      setError('닉네임과 캐릭터 이름은 각각 1~20자로 입력해 주세요.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await setDoc(
        doc(db, 'users', userId, 'profile', 'main'),
        { nickname, characterName, updatedAt: serverTimestamp() },
        { merge: true },
      )
      setEditing(false)
    } catch {
      setError('프로필 저장에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="profile-names">
      {loading ? (
        <p className="profile-names-note">프로필을 불러오는 중...</p>
      ) : (
        <>
          <h3>Lv. {level} {profile.characterName || '초보 모험가'}</h3>
          {hasProfile && (
            <div className="profile-names-summary">
              <p>👤 계정 닉네임: <strong>{profile.nickname}</strong></p>
              {!editing && (
                <button type="button" className="profile-names-edit" onClick={startEditing}>
                  이름 변경
                </button>
              )}
            </div>
          )}
          {showForm && (
            <form className="profile-names-form" onSubmit={saveProfile}>
              <p className="profile-names-note">
                {hasProfile ? '이름을 수정할 수 있어요.' : '먼저 모험에 사용할 이름을 설정해 주세요!'}
              </p>
              <label htmlFor="profile-nickname">사용자 닉네임</label>
              <input
                id="profile-nickname"
                type="text"
                value={nicknameInput}
                onChange={(event) => setNicknameInput(event.target.value)}
                maxLength={20}
                placeholder="예: 별빛"
                required
              />
              <label htmlFor="profile-character">캐릭터 이름</label>
              <input
                id="profile-character"
                type="text"
                value={characterInput}
                onChange={(event) => setCharacterInput(event.target.value)}
                maxLength={20}
                placeholder="예: 루나"
                required
              />
              <div className="profile-names-actions">
                <button type="submit" disabled={saving}>
                  {saving ? '저장 중...' : '이름 저장'}
                </button>
                {hasProfile && (
                  <button
                    type="button"
                    className="profile-names-cancel"
                    onClick={() => { setEditing(false); setError('') }}
                    disabled={saving}
                  >
                    취소
                  </button>
                )}
              </div>
            </form>
          )}
        </>
      )}
      {error && <p className="profile-names-error" role="alert">{error}</p>}
    </div>
  )
}
