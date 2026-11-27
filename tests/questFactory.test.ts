import { describe, expect, it } from 'vitest'
import { DailyQuestCreator, RetryQuestCreator } from '../src/factories/questFactory'

describe('Factory Method 패턴: 퀘스트 생성', () => {
  const base = { title: '오늘의 공부', category: '공부·독서', difficulty: '보통', dateKey: '2026-11-27' }

  it('일반 퀘스트는 미완료 상태와 생성 시각을 가진다', () => {
    const quest = new DailyQuestCreator().create(base)
    expect(quest).toMatchObject({ ...base, completed: false, completedAt: null })
    expect(quest.createdAt).toBeDefined()
    expect(quest).not.toHaveProperty('retrySource')
  })

  it('다시 도전 퀘스트는 원본 퀘스트 출처를 기록한다', () => {
    const quest = new RetryQuestCreator().create({ ...base, sourceDateKey: '2026-11-26', sourceQuestId: 'old-q' })
    expect(quest.completed).toBe(false)
    expect(quest.retrySource).toEqual({ dateKey: '2026-11-26', questId: 'old-q' })
  })
})
