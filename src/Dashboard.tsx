
import { useEffect, useState, type FormEvent } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import './App.css'

type Difficulty = '쉬움' | '보통' | '어려움'

type Quest = {
  id: string
  title: string
  difficulty: Difficulty
  completed: boolean
  dateKey: string
}

type DashboardProps = {
  userId: string
}

const rewards = {
  쉬움: { exp: 10, gold: 5 },
  보통: { exp: 20, gold: 10 },
  어려움: { exp: 35, gold: 20 },
}

// 한국시간 기준 YYYY-MM-DD 날짜 생성
function getTodayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

// 누적 경험치로 레벨 계산
function calculateLevel(exp: number) {
  let level = 1
  let remaining = exp

  while (remaining >= level * 100) {
    remaining -= level * 100
    level++
  }

  return {
    level,
    currentExp: remaining,
    requiredExp: level * 100,
  }
}

function Dashboard({ userId }: DashboardProps) {
  const [quests, setQuests] = useState<Quest[]>([])
  const [title, setTitle] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('보통')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  // 현재 로그인한 사용자의 퀘스트 컬렉션
  const questsRef = collection(db, 'users', userId, 'quests')

  useEffect(() => {
    setLoading(true)
    setError('')
    setQuests([])

    // Firestore의 퀘스트가 변경되면 자동으로 목록 갱신
    const unsubscribe = onSnapshot(
      collection(db, 'users', userId, 'quests'),
      (snapshot) => {
        const loadedQuests: Quest[] = snapshot.docs.map((item) => {
          const data = item.data()

          return {
            id: item.id,
            title: data.title,
            difficulty: data.difficulty,
            completed: data.completed,
            dateKey: data.dateKey,
          }
        })

        setQuests(loadedQuests)
        setLoading(false)
      },
      () => {
        setError('퀘스트를 불러오지 못했습니다. Firebase 설정을 확인해 주세요.')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [userId])

  // 새로운 퀘스트 등록
  async function addQuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const trimmedTitle = title.trim()

    if (!trimmedTitle) {
      setError('퀘스트 제목을 입력해 주세요.')
      return
    }

    if (trimmedTitle.length > 100) {
      setError('퀘스트 제목은 100자 이내로 입력해 주세요.')
      return
    }

    setSaving(true)

    try {
      await addDoc(questsRef, {
        title: trimmedTitle,
        difficulty,
        completed: false,
        dateKey: getTodayKey(),
        createdAt: serverTimestamp(),
        completedAt: null,
      })

      setTitle('')
      setDifficulty('보통')
    } catch {
      setError('퀘스트 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 퀘스트 완료 상태 저장
  async function completeQuest(quest: Quest) {
    if (quest.completed || busyId || loading) return

    setBusyId(quest.id)
    setError('')

    try {
      await updateDoc(
        doc(db, 'users', userId, 'quests', quest.id),
        {
          completed: true,
          completedAt: serverTimestamp(),
        }
      )
    } catch {
      setError('퀘스트 완료 처리에 실패했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  // 미완료 퀘스트 삭제
  async function removeQuest(quest: Quest) {
    if (quest.completed || busyId || loading) return

    if (!window.confirm(`"${quest.title}" 퀘스트를 삭제할까요?`)) {
      return
    }

    setBusyId(quest.id)
    setError('')

    try {
      await deleteDoc(
        doc(db, 'users', userId, 'quests', quest.id)
      )
    } catch {
      setError('퀘스트 삭제에 실패했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  const todayKey = getTodayKey()

  const todayQuests = quests.filter(
    (quest) => quest.dateKey === todayKey
  )

  const completedCount = todayQuests.filter(
    (quest) => quest.completed
  ).length

  // 현재는 모든 완료 퀘스트의 보상을 합산합니다.
  const totalExp = quests.reduce((sum, quest) => {
    return sum + (
      quest.completed ? rewards[quest.difficulty].exp : 0
    )
  }, 0)

  const gold = quests.reduce((sum, quest) => {
    return sum + (
      quest.completed ? rewards[quest.difficulty].gold : 0
    )
  }, 0)

  const character = calculateLevel(totalExp)

  return (
    <div className="app">
      <header className="header">
        <p className="eyebrow">MY DAILY ADVENTURE</p>
        <h1>QuestLog</h1>
        <p>오늘의 할 일을 완료하고 모험가를 성장시키세요.</p>
      </header>

      <main className="dashboard">
        <section className="panel character-panel">
          <h2>나의 모험가</h2>

          <div className="character-image">🧙</div>

          <h3>Lv. {character.level} 초보 모험가</h3>

          <div className="exp-label">
            <span>EXP</span>
            <span>
              {character.currentExp} / {character.requiredExp}
            </span>
          </div>

          <div className="exp-bar">
            <div
              className="exp-fill"
              style={{
                width: `${
                  (character.currentExp / character.requiredExp) * 100
                }%`,
              }}
            />
          </div>

          <p className="gold">🪙 보유 골드: {gold} G</p>

          <p className="character-info">
            퀘스트를 완료하면 경험치와 골드를 얻습니다.
          </p>
        </section>

        <section className="panel quest-panel">
          <div className="quest-heading">
            <div>
              <h2>오늘의 퀘스트</h2>
              <p>
                완료한 퀘스트: {completedCount} / {todayQuests.length}
              </p>
            </div>
          </div>

          <form className="quest-form" onSubmit={addQuest}>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="오늘 할 일을 입력하세요"
              maxLength={100}
              aria-label="퀘스트 제목"
              required
            />

            <select
              value={difficulty}
              onChange={(event) =>
                setDifficulty(event.target.value as Difficulty)
              }
              aria-label="퀘스트 난이도"
            >
              <option value="쉬움">쉬움</option>
              <option value="보통">보통</option>
              <option value="어려움">어려움</option>
            </select>

            <button type="submit" disabled={saving || loading}>
              {saving ? '저장 중...' : '퀘스트 등록'}
            </button>
          </form>

          {error && <p className="quest-error" role="alert">{error}</p>}

          {loading ? (
            <p className="quest-message">퀘스트를 불러오는 중입니다...</p>
          ) : todayQuests.length === 0 ? (
            <p className="quest-message">
              아직 오늘의 퀘스트가 없습니다. 첫 퀘스트를 등록해 보세요!
            </p>
          ) : (
            <div className="quest-list">
              {todayQuests.map((quest) => {
                const reward = rewards[quest.difficulty]

                return (
                  <div className="quest-item" key={quest.id}>
                    <div>
                      <h3>{quest.title}</h3>
                      <p>
                        난이도: {quest.difficulty} ·
                        EXP +{reward.exp} · 골드 +{reward.gold}
                      </p>
                    </div>

                    <div className="quest-actions">
                      <button
                        type="button"
                        onClick={() => completeQuest(quest)}
                        disabled={
                          quest.completed ||
                          busyId !== null ||
                          loading
                        }
                      >
                        {quest.completed ? '완료!' : '퀘스트 완료'}
                      </button>

                      {!quest.completed && (
                        <button
                          type="button"
                          className="delete-button"
                          onClick={() => removeQuest(quest)}
                          disabled={busyId !== null || loading}
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default Dashboard
