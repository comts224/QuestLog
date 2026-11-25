import { useState } from 'react'
import { doc, runTransaction } from 'firebase/firestore'
import { db } from './firebase'
import { RetryQuestCreator } from './factories/questFactory'
import type { SavedDiary } from './DiaryPanel'
import './RetryQuests.css'
import { MAX_DAILY_QUESTS, DAILY_LIMIT_ERROR, countExistingQuests, currentCount, dailyCountRef, updateDailyCount } from './dailyQuestLimit'

type Props = {
  userId: string
  diaries: SavedDiary[]
  todayKey: string
  todayClosed: boolean
  loading: boolean
  todayQuestIds: string[]
}

type RetryCandidate = {
  sourceId: string
  dateKey: string
  title: string
  category: string
  difficulty: string
}

/** 동일한 옛 퀘스트를 같은 날 두 번 복사하지 않도록 문서 ID를 고정합니다. */
export function retryQuestId(todayKey: string, sourceId: string): string {
  return `retry_${todayKey}_${sourceId}`
}

export default function RetryQuests({ userId, diaries, todayKey, todayClosed, loading, todayQuestIds }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // 이미 마감된 과거 날짜의 미완료 퀘스트만 후보에 포함합니다.
  const candidates: RetryCandidate[] = diaries
    .filter((entry) => entry.dateKey < todayKey)
    .flatMap((entry) => entry.quests
      .filter((quest) => quest.completed === false)
      .map((quest) => ({
        sourceId: quest.id,
        dateKey: entry.dateKey,
        title: quest.title,
        category: quest.category,
        difficulty: quest.difficulty,
      })))

  const alreadyRetried = new Set(todayQuestIds)

  async function retryQuest(candidate: RetryCandidate) {
    if (busyId !== null || loading || todayClosed) return

    const newId = retryQuestId(todayKey, candidate.sourceId)
    setBusyId(newId)
    setMessage('')
    setError('')

    try {
      const initialCount = await countExistingQuests(userId, todayKey)
      const newQuestRef = doc(db, 'users', userId, 'quests', newId)
      const todayDiaryRef = doc(db, 'users', userId, 'diaries', todayKey)
      const sourceDiaryRef = doc(db, 'users', userId, 'diaries', candidate.dateKey)

      await runTransaction(db, async (tx) => {
        // 모든 읽기를 쓰기보다 먼저 수행하여 중복 클릭과 마감 경합을 처리합니다.
        const [todayDiary, sourceDiary, existingQuest, counter] = await Promise.all([
          tx.get(todayDiaryRef),
          tx.get(sourceDiaryRef),
          tx.get(newQuestRef),
          tx.get(dailyCountRef(userId, todayKey)),
        ])
        if (todayDiary.exists()) throw new Error('DAY_CLOSED')
        if (existingQuest.exists()) throw new Error('ALREADY_RETRIED')
        if (!sourceDiary.exists()) throw new Error('SOURCE_MISSING')
        const count = currentCount(counter, initialCount)
        if (count >= MAX_DAILY_QUESTS) throw new Error(DAILY_LIMIT_ERROR)

        const origin = sourceDiary.data().quests
        const item = Array.isArray(origin)
          ? origin.find((quest: { id?: string; completed?: boolean }) => quest.id === candidate.sourceId)
          : undefined
        if (!item || item.completed !== false) throw new Error('SOURCE_CHANGED')

        tx.set(newQuestRef, new RetryQuestCreator().create({
          title: candidate.title,
          category: candidate.category,
          difficulty: candidate.difficulty,
          dateKey: todayKey,
          sourceDateKey: candidate.dateKey,
          sourceQuestId: candidate.sourceId,
        }))
        updateDailyCount(tx, userId, todayKey, count + 1)
      })
      setMessage(`「${candidate.title}」 퀘스트를 오늘 다시 등록했습니다.`)
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'DAY_CLOSED') {
        setError('오늘은 이미 마감했습니다. 다음 날 다시 도전할 수 있습니다.')
      } else if (cause instanceof Error && cause.message === DAILY_LIMIT_ERROR) {
        setError(`하루에 최대 ${MAX_DAILY_QUESTS}개까지 등록할 수 있습니다.`)
      } else if (cause instanceof Error && cause.message === 'ALREADY_RETRIED') {
        setError('이 퀘스트는 오늘 이미 다시 등록했습니다.')
      } else {
        setError('다시 도전에 실패했습니다. 새로고침 후 다시 시도해 주세요.')
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="panel retry-panel">
      <h2>🔄 미완료 퀘스트 다시 도전</h2>
      <p className="retry-description">
        지난 모험에서 끝내지 못한 퀘스트를 오늘 새로 등록합니다.
        과거 기록과 일기는 변경되지 않으며, 오늘 마감 후에는 등록할 수 없습니다.
      </p>
      {todayClosed && <p className="retry-status">📖 오늘은 이미 마감되었습니다. 내일 다시 도전해 주세요.</p>}
      {!todayClosed && todayQuestIds.length >= MAX_DAILY_QUESTS && (
        <p className="retry-status">⚔️ 오늘은 최대 15개까지 등록할 수 있습니다.</p>
      )}
      {message && <p className="retry-success" role="status">{message}</p>}
      {error && <p className="retry-error" role="alert">{error}</p>}
      {loading ? (
        <p className="retry-description">지난 퀘스트를 불러오는 중입니다...</p>
      ) : candidates.length === 0 ? (
        <p className="retry-description">아직 다시 도전할 미완료 퀘스트가 없습니다.</p>
      ) : (
        <div className="retry-list">
          {candidates.map((quest) => {
            const id = retryQuestId(todayKey, quest.sourceId)
            const exists = alreadyRetried.has(id)
            return (
              <div className="retry-item" key={`${quest.dateKey}-${quest.sourceId}`}>
                <div className="retry-item-info">
                  <strong>{quest.title}</strong>
                  <span>{quest.dateKey} · {quest.category} · {quest.difficulty}</span>
                </div>
                <button type="button" disabled={todayClosed || loading || busyId !== null || exists || todayQuestIds.length >= MAX_DAILY_QUESTS}
                  onClick={() => { void retryQuest(quest) }}>
                  {exists ? '오늘 등록됨 ✓' : busyId === id ? '등록 중...' : '다시 도전'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
