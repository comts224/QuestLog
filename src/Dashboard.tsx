
import { useEffect, useState, type FormEvent } from 'react'
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import './App.css'
import ProfileNames from './ProfileNames'
import EquipmentCustomizer from './EquipmentCustomizer'
import ShopPanel from './ShopPanel'
import DiaryPanel, { readDiaries, type SavedDiary } from './DiaryPanel'
import { EMPTY_SHOP, parseShop } from './shop/shopState'
import {
  calculateReward,
  getStatType,
  type Difficulty,
  type QuestCategory,
} from './strategies/rewardStrategy'


type Quest = {
  id: string
  title: string
  difficulty: Difficulty
  category: QuestCategory
  completed: boolean
  dateKey: string
}

type DashboardProps = {
  userId: string
}

// 기존 퀘스트에는 category 필드가 없을 수 있습니다.
const DEFAULT_CATEGORY: QuestCategory = '과제·업무'
const CATEGORIES: QuestCategory[] = ['공부·독서', '운동', '생활·건강', '과제·업무']

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
  const [category, setCategory] = useState<QuestCategory>('공부·독서')

  // 퀘스트 수정용 상태
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDifficulty, setEditDifficulty] =
    useState<Difficulty>('보통')
  const [editCategory, setEditCategory] = useState<QuestCategory>('공부·독서')

  // 화면 상태
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [shopState, setShopState] = useState(EMPTY_SHOP)
  const [shopLoading, setShopLoading] = useState(true)
  const [diaries, setDiaries] = useState<SavedDiary[]>([])
  const [diariesLoading, setDiariesLoading] = useState(true)
  const [todayKey, setTodayKey] = useState(getTodayKey())

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
            category: CATEGORIES.includes(data.category) ? data.category : DEFAULT_CATEGORY,
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

  // 상점 구매 기록을 구독합니다. 기존 퀘스트/능력치 문서는 수정하지 않습니다.
  useEffect(() => {
    setShopState(EMPTY_SHOP)
    setShopLoading(true)
    return onSnapshot(doc(db, 'users', userId, 'shop', 'state'), (snapshot) => {
      setShopState(parseShop(snapshot.data()))
      setShopLoading(false)
    }, () => {
      setError('골드 사용 내역을 불러오지 못했습니다.')
      setShopLoading(false)
    })
  }, [userId])

  // 날짜가 바뀌면 대시보드도 오늘 날짜 기준으로 전환합니다.
  useEffect(() => {
    const timer = window.setInterval(() => setTodayKey(getTodayKey()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  // 마감한 날짜를 구독해서 퀘스트 잠금과 일기장에 함께 사용합니다.
  useEffect(() => {
    setDiaries([])
    setDiariesLoading(true)
    return onSnapshot(collection(db, 'users', userId, 'diaries'), (snapshot) => {
      setDiaries(readDiaries(snapshot))
      setDiariesLoading(false)
    }, () => {
      setError('모험 일기장을 불러오지 못했습니다.')
      setDiariesLoading(false)
    })
  }, [userId])

  const closedDates = new Set(diaries.map((entry) => entry.dateKey))
  const todayClosed = closedDates.has(todayKey)

  // 퀘스트 등록
  async function addQuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || loading || diariesLoading || todayClosed) return

    const trimmedTitle = title.trim()

    if (!trimmedTitle || trimmedTitle.length > 100) {
      setError('퀘스트 제목을 1~100자로 입력해 주세요.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const questRef = doc(collection(db, 'users', userId, 'quests'))
      const diaryRef = doc(db, 'users', userId, 'diaries', todayKey)
      await runTransaction(db, async (transaction) => {
        const diary = await transaction.get(diaryRef)
        if (diary.exists()) throw new Error('DAY_CLOSED')
        transaction.set(questRef, {
          title: trimmedTitle,
          difficulty,
          category,
          completed: false,
          dateKey: todayKey,
          createdAt: serverTimestamp(),
          completedAt: null,
        })
      })

      setTitle('')
      setDifficulty('보통')
      setCategory('공부·독서')
    } catch {
      setError('퀘스트 등록에 실패했습니다. 오늘이 마감되었는지 확인해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  // 퀘스트 완료
  async function completeQuest(quest: Quest) {
    if (quest.completed || busyId !== null || loading || diariesLoading || closedDates.has(quest.dateKey)) return

    setBusyId(quest.id)
    setError('')

    try {
      const questRef = doc(db, 'users', userId, 'quests', quest.id)
      const diaryRef = doc(db, 'users', userId, 'diaries', quest.dateKey)
      await runTransaction(db, async (transaction) => {
        const diary = await transaction.get(diaryRef)
        const current = await transaction.get(questRef)
        if (diary.exists()) throw new Error('DAY_CLOSED')
        if (!current.exists() || current.data().completed) throw new Error('QUEST_CHANGED')
        transaction.update(questRef, { completed: true, completedAt: serverTimestamp() })
      })
    } catch {
      setError('퀘스트 완료 처리에 실패했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  // 완료 취소 시 잔액이 음수가 되지 않도록 구매 기록과 함께 트랜잭션으로 확인합니다.
  async function cancelCompletion(quest: Quest) {
    if (!quest.completed || busyId !== null || loading || shopLoading || diariesLoading || closedDates.has(quest.dateKey)) return

    setBusyId(quest.id)
    setError('')

    try {
      const questRef = doc(db, 'users', userId, 'quests', quest.id)
      const walletRef = doc(db, 'users', userId, 'shop', 'state')
      // 최신 화면의 퀘스트 ID를 모두 트랜잭션에서 다시 읽어 합산합니다.
      const questRefs = quests.map((item) => doc(db, 'users', userId, 'quests', item.id))
      await runTransaction(db, async (transaction) => {
        const diarySnap = await transaction.get(doc(db, 'users', userId, 'diaries', quest.dateKey))
        if (diarySnap.exists()) throw new Error('DAY_CLOSED')
        const walletSnap = await transaction.get(walletRef)
        const currentShop = parseShop(walletSnap.data())
        const questDocs = await Promise.all(questRefs.map((ref) => transaction.get(ref)))
        const target = questDocs.find((item) => item.id === questRef.id)
        if (!target?.exists() || !target.data().completed) throw new Error('QUEST_CHANGED')
        const earnedAfterCancel = questDocs.reduce((sum, item) => {
          if (!item.exists() || item.id === questRef.id) return sum
          const data = item.data()
          return sum + (data.completed && ['쉬움', '보통', '어려움'].includes(data.difficulty)
            ? calculateReward(data.difficulty as Difficulty).gold : 0)
        }, 0)
        if (earnedAfterCancel < currentShop.spentGold) throw new Error('SPENT_REWARD')
        transaction.update(questRef, { completed: false, completedAt: null })
      })
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'SPENT_REWARD') {
        setError('이미 상점에서 사용한 골드 때문에 완료를 취소할 수 없습니다.')
      } else {
        setError('완료 취소에 실패했습니다. 새로고침 후 다시 시도해 주세요.')
      }
    } finally {
      setBusyId(null)
    }
  }

  // [추가] 수정 버튼을 눌렀을 때
  function startEditing(quest: Quest) {
    if (quest.completed || busyId !== null || diariesLoading || closedDates.has(quest.dateKey)) return

    setEditingId(quest.id)
    setEditTitle(quest.title)
    setEditDifficulty(quest.difficulty)
    setEditCategory(quest.category)
    setError('')
  }

  // [추가] 수정 취소
  function cancelEditing() {
    setEditingId(null)
    setEditTitle('')
    setEditDifficulty('보통')
    setEditCategory('공부·독서')
    setError('')
  }

  // [추가] 수정한 내용을 Firebase에 저장
  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!editingId || busyId !== null || loading || diariesLoading) return

    const trimmedTitle = editTitle.trim()

    if (!trimmedTitle || trimmedTitle.length > 100) {
      setError('퀘스트 제목을 1~100자로 입력해 주세요.')
      return
    }

    const target = quests.find((quest) => quest.id === editingId)

    if (!target || target.completed || closedDates.has(target.dateKey)) {
      setError('완료한 퀘스트는 수정할 수 없습니다.')
      return
    }

    setBusyId(editingId)
    setError('')

    try {
      const questRef = doc(db, 'users', userId, 'quests', editingId)
      await runTransaction(db, async (transaction) => {
        const diary = await transaction.get(doc(db, 'users', userId, 'diaries', target.dateKey))
        const current = await transaction.get(questRef)
        if (diary.exists() || !current.exists() || current.data().completed) throw new Error('DAY_CLOSED')
        transaction.update(questRef, {
          title: trimmedTitle,
          difficulty: editDifficulty,
          category: editCategory,
          updatedAt: serverTimestamp(),
        })
      })

      cancelEditing()
    } catch {
      setError('퀘스트 수정에 실패했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  // 퀘스트 삭제 (미완료 상태만)
  async function removeQuest(quest: Quest) {
    if (quest.completed || busyId !== null || loading || diariesLoading || closedDates.has(quest.dateKey)) return

    if (!window.confirm(`"${quest.title}" 퀘스트를 삭제할까요?`)) {
      return
    }

    setBusyId(quest.id)
    setError('')

    try {
      const questRef = doc(db, 'users', userId, 'quests', quest.id)
      await runTransaction(db, async (transaction) => {
        const diary = await transaction.get(doc(db, 'users', userId, 'diaries', quest.dateKey))
        const current = await transaction.get(questRef)
        if (diary.exists() || !current.exists() || current.data().completed) throw new Error('DAY_CLOSED')
        transaction.delete(questRef)
      })

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
      sum + (quest.completed ? calculateReward(quest.difficulty).exp : 0),
    0
  )

  const gold = quests.reduce(
    (sum, quest) =>
      sum + (quest.completed ? calculateReward(quest.difficulty).gold : 0),
    0
  )

  // 완료된 퀘스트의 카테고리에 맞춰 캐릭터 능력치 합산
  // 아직 캐릭터 문서를 따로 만들지 않았으므로 퀘스트 기록에서 계산합니다.
  const stats = quests.reduce((acc, quest) => {
    if (quest.completed) {
      const stat = getStatType(quest.category)
      acc[stat] += calculateReward(quest.difficulty).statPoint
    }
    return acc
  }, { intelligence: 0, strength: 0, vitality: 0, diligence: 0 })

  const availableGold = gold - shopState.spentGold
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

          <EquipmentCustomizer userId={userId} />

          <ProfileNames userId={userId} level={character.level} />

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

          <p className="gold">🪙 보유 골드: {shopLoading ? '불러오는 중...' : `${availableGold} G`}</p>

          <p className="character-info">
            퀘스트를 완료하면 경험치, 골드와 능력치를 얻습니다.
          </p>

          <div className="character-stats">
            <h3>모험가 능력치</h3>
            <p>🧠 지능 INT: {stats.intelligence}</p>
            <p>💪 힘 STR: {stats.strength}</p>
            <p>❤️ 활력 VIT: {stats.vitality}</p>
            <p>🛡️ 성실성 DIL: {stats.diligence}</p>
          </div>
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

          {todayClosed && <p className="quest-message">📖 오늘은 이미 마감되었습니다. 퀘스트를 수정할 수 없습니다.</p>}
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
              value={category}
              onChange={(event) => setCategory(event.target.value as QuestCategory)}
              aria-label="새 퀘스트 카테고리"
            >
              {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>

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

            <button type="submit" disabled={saving || loading || diariesLoading || todayClosed}>
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
                const reward = calculateReward(quest.difficulty)
                const isEditing = editingId === quest.id
                const isBusy = busyId !== null || diariesLoading || closedDates.has(quest.dateKey)

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
                          value={editCategory}
                          onChange={(event) => setEditCategory(event.target.value as QuestCategory)}
                          aria-label="수정할 퀘스트 카테고리"
                        >
                          {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>

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
                            {quest.category} · 난이도: {quest.difficulty} ·
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
        <ShopPanel userId={userId} earnedGold={gold} />
        <DiaryPanel userId={userId} quests={quests} diaries={diaries}
          todayKey={todayKey} questsLoading={loading} diariesLoading={diariesLoading} />
      </main>
    </div>
  )
}

export default Dashboard
