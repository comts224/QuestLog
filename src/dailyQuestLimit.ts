import {
  collection,
  doc,
  getCountFromServer,
  query,
  where,
  type Transaction,
} from 'firebase/firestore'
import { db } from './firebase'

/** 동일 날짜에 등록 가능한 최대 퀘스트 수. 완료/다시 도전 모두 포함. */
export const MAX_DAILY_QUESTS = 15

export const DAILY_LIMIT_ERROR = 'DAILY_QUEST_LIMIT'

/**
 * 이전 버전의 퀘스트는 카운터 문서가 없으므로 초기 개수를 서버에서 조회합니다.
 * 쿼리 값은 초기 마이그레이션용이며, 이후 등록/삭제는 카운터 트랜잭션으로 직렬화합니다.
 */
export async function countExistingQuests(userId: string, dateKey: string): Promise<number> {
  const questsQuery = query(
    collection(db, 'users', userId, 'quests'),
    where('dateKey', '==', dateKey)
  )
  const result = await getCountFromServer(questsQuery)
  return result.data().count
}

export function dailyCountRef(userId: string, dateKey: string) {
  return doc(db, 'users', userId, 'dailyQuestCounts', dateKey)
}

/** 카운터 문서가 없으면 기존 퀘스트 개수로 시작합니다. 모든 읽기는 쓰기 전에 수행하세요. */
export function currentCount(
  snapshot: { exists(): boolean; data(): Record<string, unknown> | undefined },
  initialCount: number
): number {
  const value = snapshot.exists() ? snapshot.data()?.count : initialCount
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : initialCount
}

/** 동일 카운터 문서를 읽고 쓰면 동시 등록 시 한 작업만 재시도됩니다. */
export function updateDailyCount(
  tx: Transaction,
  userId: string,
  dateKey: string,
  nextCount: number
) {
  tx.set(dailyCountRef(userId, dateKey), { count: nextCount })
}
