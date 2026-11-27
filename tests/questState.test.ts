import { describe, expect, it } from 'vitest'
import { canQuestAction, getQuestState, QuestStateError, transitionQuest } from '../src/quest/questState'

describe('State 패턴: 퀘스트 상태 전이', () => {
  it('진행 중 퀘스트는 완료·수정·삭제할 수 있지만 완료 취소는 불가능하다', () => {
    const context = { completed: false, closed: false }
    expect(getQuestState(context).status).toBe('pending')
    expect(canQuestAction(context, 'complete')).toBe(true)
    expect(canQuestAction(context, 'edit')).toBe(true)
    expect(canQuestAction(context, 'delete')).toBe(true)
    expect(canQuestAction(context, 'cancel')).toBe(false)
    expect(transitionQuest(context, 'complete').status).toBe('completed')
  })

  it('완료 퀘스트는 완료 취소만 허용한다', () => {
    const context = { completed: true, closed: false }
    expect(canQuestAction(context, 'cancel')).toBe(true)
    expect(canQuestAction(context, 'complete')).toBe(false)
    expect(canQuestAction(context, 'edit')).toBe(false)
    expect(canQuestAction(context, 'delete')).toBe(false)
    expect(transitionQuest(context, 'cancel').status).toBe('pending')
  })

  it.each(['complete', 'cancel', 'edit', 'delete'] as const)('마감된 일기장에서는 %s 작업을 거절한다', (action) => {
    const context = { completed: false, closed: true }
    expect(canQuestAction(context, action)).toBe(false)
    expect(() => transitionQuest(context, action)).toThrowError(QuestStateError)
    try {
      transitionQuest(context, action)
    } catch (error) {
      expect(error).toMatchObject({ code: 'DAY_CLOSED' })
    }
  })
})
