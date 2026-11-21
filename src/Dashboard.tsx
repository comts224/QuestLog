
import { useEffect, useState, type FormEvent } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
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

// 난이도별 퀘스트 보상
const rewards = {
  쉬움: { exp: 10, gold: 5 },
  보통: { exp: 20, gold: 10 },
  어려움: { exp: 35, gold: 20 },
}

// 한국시간 기준 오늘 날짜
function getTodayKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

// 누적 경험치를 기준으로 레벨 계산
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

  // 새 퀘스트 등록용 상태
  const [title, setTitle] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('보통')

  // 퀘스트 수정용 상태
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDifficulty, setEditDifficulty] =
    useState<Difficulty>('보통')

  // 화면 상태
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Firebase에서 로그인한 사용자의 퀘스트 가져오기
  useEffect(() => {
    setLoading(true)
    setError('')
    setQuests([])
    setEditingId(null)

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
        setError('퀘스트를 불러오지 못했습니다.')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [userId])

  // 퀘스트 등록
  async function addQuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || loading) return

    const trimmedTitle = title.trim()

    if (!trimmedTitle || trimmedTitle.length > 100) {
      setError('퀘스트 제목을 1~100자로 입력해 주세요.')
      return
    }

    setSaving(true)
    setError('')

    try {
      await addDoc(collection(db, 'users', userId, 'quests'), {
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
      setError('퀘스트 등록에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 퀘스트 완료
  async function completeQuest(quest: Quest) {
    if (quest.completed || busyId !== null || loading) return

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

  // [추가] 퀘스트 완료 취소
  async function cancelCompletion(quest: Quest) {
    if (!quest.completed || busyId !== null || loading) return

    setBusyId(quest.id)
    setError('')

    try {
      await updateDoc(
        doc(db, 'users', userId, 'quests', quest.id),
        {
          completed: false,
          completedAt: null,
        }
      )
    } catch {
      setError('퀘스트 완료 취소에 실패했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  // [추가] 수정 버튼을 눌렀을 때
  function startEditing(quest: Quest) {
    if (quest.completed || busyId !== null) return

    setEditingId(quest.id)
    setEditTitle(quest.title)
    setEditDifficulty(quest.difficulty)
    setError('')
  }

  // [추가] 수정 취소
  function cancelEditing() {
    setEditingId(null)
    setEditTitle('')
    setEditDifficulty('보통')
    setError('')
  }

  // [추가] 수정한 내용을 Firebase에 저장
  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!editingId || busyId !== null || loading) return

    const trimmedTitle = editTitle.trim()

    if (!trimmedTitle || trimmedTitle.length > 100) {
      setError('퀘스트 제목을 1~100자로 입력해 주세요.')
      return
    }

    const target = quests.find((quest) => quest.id === editingId)

    if (!target || target.completed) {
      setError('완료한 퀘스트는 수정할 수 없습니다.')
      return
    }

    setBusyId(editingId)
    setError('')

    try {
      await updateDoc(
        doc(db, 'users', userId, 'quests', editingId),
        {
          title: trimmedTitle,
          difficulty: editDifficulty,
          updatedAt: serverTimestamp(),
        }
      )

      cancelEditing()
    } catch {
      setError('퀘스트 수정에 실패했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  // 퀘스트 삭제 (미완료 상태만)
  async function removeQuest(quest: Quest) {
    if (quest.completed || busyId !== null || loading) return

    if (!window.confirm(`"${quest.title}" 퀘스트를 삭제할까요?`)) {
      return
    }

    setBusyId(quest.id)
    setError('')

    try {
      await deleteDoc(
        doc(db, 'users', userId, 'quests', quest.id)
      )

      if (editingId === quest.id) {
        setEditingId(null)
      }
    } catch {
      setError('퀘스트 삭제에 실패했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  // 오늘의 퀘스트
  const todayKey = getTodayKey()
  const todayQuests = quests.filter(
    (quest) => quest.dateKey === todayKey
  )

  const completedCount = todayQuests.filter(
    (quest) => quest.completed
  ).length

  // 완료된 퀘스트만 합산하므로
  // 완료 취소 시 보상이 자동으로 제외됩니다.
  const totalExp = quests.reduce(
    (sum, quest) =>
      sum + (quest.completed ? rewards[quest.difficulty].exp : 0),
    0
  )

  const gold = quests.reduce(
    (sum, quest) =>
      sum + (quest.completed ? rewards[quest.difficulty].gold : 0),
    0
  )

  const character = calculateLevel(totalExp)

  return (
    <div className="app">
      <header className="header">
        <p className="eyebrow">MY DAILY ADVENTURE</p>
        <h1>QuestLog</h1>
        <p>오늘의 할 일을 완료하고 모험가를 성장시키세요.</p>
      </header>

      <main className="dashboard">
        {/* 캐릭터 정보 */}
        <section className="panel character-panel">
          <h2>나의 모험가</h2>

          <div className="character-image" aria-label="임시 캐릭터">
            🧙
          </div>

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

        {/* 퀘스트 관리 */}
        <section className="panel quest-panel">
          <div className="quest-heading">
            <div>
              <h2>오늘의 퀘스트</h2>
              <p>
                완료한 퀘스트: {completedCount} / {todayQuests.length}
              </p>
            </div>
          </div>

          {/* 퀘스트 등록 폼 */}
          <form className="quest-form" onSubmit={addQuest}>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="오늘 할 일을 입력하세요"
              maxLength={100}
              aria-label="새 퀘스트 제목"
              required
            />

            <select
              value={difficulty}
              onChange={(event) =>
                setDifficulty(event.target.value as Difficulty)
              }
              aria-label="새 퀘스트 난이도"
            >
              <option value="쉬움">쉬움</option>
              <option value="보통">보통</option>
              <option value="어려움">어려움</option>
            </select>

            <button type="submit" disabled={saving || loading}>
              {saving ? '저장 중...' : '퀘스트 등록'}
            </button>
          </form>

          {error && (
            <p className="quest-error" role="alert">
              {error}
            </p>
          )}

          {loading ? (
            <p className="quest-message">
              퀘스트를 불러오는 중입니다...
            </p>
          ) : todayQuests.length === 0 ? (
            <p className="quest-message">
              아직 오늘의 퀘스트가 없습니다.
              첫 퀘스트를 등록해 보세요!
            </p>
          ) : (
            <div className="quest-list">
              {todayQuests.map((quest) => {
                const reward = rewards[quest.difficulty]
                const isEditing = editingId === quest.id
                const isBusy = busyId !== null

                return (
                  <div className="quest-item" key={quest.id}>
                    {isEditing ? (
                      // 퀘스트 수정 화면
                      <form
                        className="quest-edit-form"
                        onSubmit={saveEdit}
                      >
                        <input
                          value={editTitle}
                          onChange={(event) =>
                            setEditTitle(event.target.value)
                          }
                          maxLength={100}
                          aria-label="수정할 퀘스트 제목"
                          required
                        />

                        <select
                          value={editDifficulty}
                          onChange={(event) =>
                            setEditDifficulty(
                              event.target.value as Difficulty
                            )
                          }
                          aria-label="수정할 퀘스트 난이도"
                        >
                          <option value="쉬움">쉬움</option>
                          <option value="보통">보통</option>
                          <option value="어려움">어려움</option>
                        </select>

                        <div className="quest-actions">
                          <button type="submit" disabled={isBusy}>
                            저장
                          </button>
                          <button
                            type="button"
                            className="cancel-button"
                            onClick={cancelEditing}
                            disabled={isBusy}
                          >
                            취소
                          </button>
                        </div>
                      </form>
                    ) : (
                      // 일반 퀘스트 표시
                      <>
                        <div>
                          <h3>{quest.title}</h3>
                          <p>
                            난이도: {quest.difficulty} ·
                            EXP +{reward.exp} · 골드 +{reward.gold}
                          </p>
                        </div>

                        <div className="quest-actions">
                          {quest.completed ? (
                            <button
                              type="button"
                              className="cancel-button"
                              onClick={() => cancelCompletion(quest)}
                              disabled={isBusy}
                            >
                              완료 취소
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => completeQuest(quest)}
                                disabled={isBusy}
                              >
                                퀘스트 완료
                              </button>

                              <button
                                type="button"
                                className="edit-button"
                                onClick={() => startEditing(quest)}
                                disabled={isBusy}
                              >
                                수정
                              </button>

                              <button
                                type="button"
                                className="delete-button"
                                onClick={() => removeQuest(quest)}
                                disabled={isBusy}
                              >
                                삭제
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
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
