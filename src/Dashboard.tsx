
import { useEffect, useState, type FormEvent } from 'react'
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { DailyQuestCreator } from './factories/questFactory'
import { canQuestAction, transitionQuest } from './quest/questState'
import './App.css'
import ProfileNames from './ProfileNames'
import EquipmentCustomizer from './EquipmentCustomizer'
import ShopPanel from './ShopPanel'
import DiaryPanel, { readDiaries, type SavedDiary } from './DiaryPanel'
import RetryQuests from './RetryQuests'
import PageNavigation, { getPageFromHash, type QuestLogPage } from './PageNavigation'
import JobOnboarding from './JobOnboarding'
import { MAX_DAILY_QUESTS, DAILY_LIMIT_ERROR, countExistingQuests, currentCount, dailyCountRef, updateDailyCount } from './dailyQuestLimit'
import './PageNavigation.css'
import './QuestLogMotion.css'
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
  // 완료 보상은 Firestore 저장 성공 후에만 잠깐 표시합니다.
  const [rewardPopup, setRewardPopup] = useState<{ id: string; exp: number; gold: number; sequence: number } | null>(null)
  const [shopState, setShopState] = useState(EMPTY_SHOP)
  const [shopLoading, setShopLoading] = useState(true)
  const [diaries, setDiaries] = useState<SavedDiary[]>([])
  const [diariesLoading, setDiariesLoading] = useState(true)
  const [todayKey, setTodayKey] = useState(getTodayKey())
  const [activePage, setActivePage] = useState<QuestLogPage>(getPageFromHash)

  // 주소의 #character/#quests/#shop/#diary와 메뉴 상태를 동기화합니다.
  useEffect(() => {
    const syncPage = () => setActivePage(getPageFromHash())
    window.addEventListener('hashchange', syncPage)
    return () => window.removeEventListener('hashchange', syncPage)
  }, [])

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
      const initialCount = await countExistingQuests(userId, todayKey)
      const questRef = doc(collection(db, 'users', userId, 'quests'))
      const diaryRef = doc(db, 'users', userId, 'diaries', todayKey)
      await runTransaction(db, async (transaction) => {
        const [diary, counter] = await Promise.all([
          transaction.get(diaryRef),
          transaction.get(dailyCountRef(userId, todayKey)),
        ])
        if (diary.exists()) throw new Error('DAY_CLOSED')
        const count = currentCount(counter, initialCount)
        if (count >= MAX_DAILY_QUESTS) throw new Error(DAILY_LIMIT_ERROR)
        transaction.set(questRef, new DailyQuestCreator().create({
          title: trimmedTitle,
          difficulty,
          category,
          dateKey: todayKey,
        }))
        updateDailyCount(transaction, userId, todayKey, count + 1)
      })

      setTitle('')
      setDifficulty('보통')
      setCategory('공부·독서')
    } catch (cause) {
      if (cause instanceof Error && cause.message === DAILY_LIMIT_ERROR) {
        setError(`하루에 최대 ${MAX_DAILY_QUESTS}개까지 등록할 수 있습니다.`)
      } else {
        setError('퀘스트 등록에 실패했습니다. 오늘이 마감되었는지 확인해 주세요.')
      }
    } finally {
      setSaving(false)
    }
  }

  // 퀘스트 완료
  async function completeQuest(quest: Quest) {
    if (!canQuestAction({ completed: quest.completed, closed: closedDates.has(quest.dateKey) }, 'complete') || busyId !== null || loading || diariesLoading) return

    setBusyId(quest.id)
    setError('')

    try {
      const questRef = doc(db, 'users', userId, 'quests', quest.id)
      const diaryRef = doc(db, 'users', userId, 'diaries', quest.dateKey)
      await runTransaction(db, async (transaction) => {
        const diary = await transaction.get(diaryRef)
        const current = await transaction.get(questRef)
        if (!current.exists()) throw new Error('QUEST_CHANGED')
        const next = transitionQuest({ completed: current.data().completed === true, closed: diary.exists() }, 'complete')
        transaction.update(questRef, { completed: next.status === 'completed', completedAt: serverTimestamp() })
      })
      const reward = calculateReward(quest.difficulty)
      setRewardPopup((previous) => ({ id: quest.id, exp: reward.exp, gold: reward.gold, sequence: (previous?.sequence ?? 0) + 1 }))
    } catch {
      setError('퀘스트 완료 처리에 실패했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  // 다음 퀘스트에도 재생되도록 완료 알림을 일정 시간 후 닫습니다.
  useEffect(() => {
    if (!rewardPopup) return
    const timer = window.setTimeout(() => setRewardPopup(null), 1400)
    return () => window.clearTimeout(timer)
  }, [rewardPopup])

  // 완료 취소 시 잔액이 음수가 되지 않도록 구매 기록과 함께 트랜잭션으로 확인합니다.
  async function cancelCompletion(quest: Quest) {
    if (!canQuestAction({ completed: quest.completed, closed: closedDates.has(quest.dateKey) }, 'cancel') || busyId !== null || loading || shopLoading || diariesLoading) return

    setBusyId(quest.id)
    setError('')

    try {
      const questRef = doc(db, 'users', userId, 'quests', quest.id)
      const walletRef = doc(db, 'users', userId, 'shop', 'state')
      // 최신 화면의 퀘스트 ID를 모두 트랜잭션에서 다시 읽어 합산합니다.
      const questRefs = quests.map((item) => doc(db, 'users', userId, 'quests', item.id))
      await runTransaction(db, async (transaction) => {
        const diarySnap = await transaction.get(doc(db, 'users', userId, 'diaries', quest.dateKey))
        const walletSnap = await transaction.get(walletRef)
        const currentShop = parseShop(walletSnap.data())
        const questDocs = await Promise.all(questRefs.map((ref) => transaction.get(ref)))
        const target = questDocs.find((item) => item.id === questRef.id)
        if (!target?.exists()) throw new Error('QUEST_CHANGED')
        const next = transitionQuest({ completed: target.data().completed === true, closed: diarySnap.exists() }, 'cancel')
        const earnedAfterCancel = questDocs.reduce((sum, item) => {
          if (!item.exists() || item.id === questRef.id) return sum
          const data = item.data()
          return sum + (data.completed && ['쉬움', '보통', '어려움'].includes(data.difficulty)
            ? calculateReward(data.difficulty as Difficulty).gold : 0)
        }, 0)
        if (earnedAfterCancel < currentShop.spentGold) throw new Error('SPENT_REWARD')
        transaction.update(questRef, { completed: next.status === 'completed', completedAt: null })
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
    if (!canQuestAction({ completed: quest.completed, closed: closedDates.has(quest.dateKey) }, 'edit') || busyId !== null || diariesLoading) return

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

    if (!target || !canQuestAction({ completed: target.completed, closed: closedDates.has(target.dateKey) }, 'edit')) {
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
        if (!current.exists()) throw new Error('QUEST_CHANGED')
        transitionQuest({ completed: current.data().completed === true, closed: diary.exists() }, 'edit')
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
    if (!canQuestAction({ completed: quest.completed, closed: closedDates.has(quest.dateKey) }, 'delete') || busyId !== null || loading || diariesLoading) return

    if (!window.confirm(`"${quest.title}" 퀘스트를 삭제할까요?`)) {
      return
    }

    setBusyId(quest.id)
    setError('')

    try {
      const initialCount = await countExistingQuests(userId, quest.dateKey)
      const questRef = doc(db, 'users', userId, 'quests', quest.id)
      await runTransaction(db, async (transaction) => {
        const [diary, current, counter] = await Promise.all([
          transaction.get(doc(db, 'users', userId, 'diaries', quest.dateKey)),
          transaction.get(questRef),
          transaction.get(dailyCountRef(userId, quest.dateKey)),
        ])
        if (!current.exists()) throw new Error('QUEST_CHANGED')
        transitionQuest({ completed: current.data().completed === true, closed: diary.exists() }, 'delete')
        const count = currentCount(counter, initialCount)
        transaction.delete(questRef)
        updateDailyCount(transaction, userId, quest.dateKey, Math.max(0, count - 1))
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

      <JobOnboarding userId={userId} />

      <PageNavigation activePage={activePage} />

      <main className="dashboard questlog-dashboard">
        <div className="questlog-page" style={{ display: activePage === 'character' ? 'block' : 'none' }}>
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

        </div>

        <div className="questlog-page" style={{ display: activePage === 'quests' ? 'block' : 'none' }}>
        {/* 퀘스트 관리 */}
        <section className="panel quest-panel">
          <div className="quest-heading">
            <div>
              <h2>오늘의 퀘스트</h2>
              <p>
                완료한 퀘스트: {completedCount} / {todayQuests.length}
              </p>
              <p>오늘 등록: {todayQuests.length} / {MAX_DAILY_QUESTS}</p>
            </div>
          </div>

          {todayClosed && <p className="quest-message">📖 오늘은 이미 마감되었습니다. 퀘스트를 수정할 수 없습니다.</p>}
          {!todayClosed && todayQuests.length >= MAX_DAILY_QUESTS && (
            <p className="quest-message">⚔️ 오늘의 퀘스트 15개를 모두 등록했습니다.</p>
          )}
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

            <button type="submit" disabled={saving || loading || diariesLoading || todayClosed || todayQuests.length >= MAX_DAILY_QUESTS}>
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
                  <div className="quest-item ql-animated-quest" key={quest.id}>
                    {rewardPopup?.id === quest.id && (
                      <div key={rewardPopup.sequence} className="ql-reward-pop" role="status" aria-live="polite">
                        ✨ EXP +{rewardPopup.exp} · 🪙 +{rewardPopup.gold} G
                      </div>
                    )}
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
        <RetryQuests userId={userId} diaries={diaries} todayKey={todayKey}
          todayClosed={todayClosed} loading={loading || diariesLoading}
          todayQuestIds={todayQuests.map((quest) => quest.id)} />
        </div>

        <div className="questlog-page" style={{ display: activePage === 'shop' ? 'block' : 'none' }}>
          <ShopPanel userId={userId} earnedGold={gold} />
        </div>
        {/* 항상 마운트해 두어, 다른 페이지에서도 지난 날짜 자동 마감이 작동합니다. */}
        <div className="questlog-page" style={{ display: activePage === 'diary' ? 'block' : 'none' }}>
          <DiaryPanel userId={userId} quests={quests} diaries={diaries}
            todayKey={todayKey} questsLoading={loading} diariesLoading={diariesLoading} />
        </div>
      </main>
    </div>
  )
}

export default Dashboard
