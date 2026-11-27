import { describe, expect, it, vi } from 'vitest'
import { QuestEventSubject } from '../src/observers/questEvents'
import { QuestEventRegistry } from '../src/singletons/questEventRegistry'

describe('Observer 패턴: 퀘스트 이벤트', () => {
  it('이벤트를 구독자에게 전달하고 해제 후에는 전달하지 않는다', () => {
    const subject = new QuestEventSubject()
    const onQuestEvent = vi.fn()
    const unsubscribe = subject.subscribe({ onQuestEvent })
    const event = { type: 'quest-completed', questId: 'q1', exp: 10, gold: 5 } as const
    subject.notify(event)
    expect(onQuestEvent).toHaveBeenCalledWith(event)
    expect(onQuestEvent).toHaveBeenCalledTimes(1)
    unsubscribe()
    subject.notify(event)
    expect(onQuestEvent).toHaveBeenCalledTimes(1)
  })

  it('서로 다른 구독자에게 동일 이벤트를 전달한다', () => {
    const subject = new QuestEventSubject()
    const first = vi.fn()
    const second = vi.fn()
    subject.subscribe({ onQuestEvent: first })
    subject.subscribe({ onQuestEvent: second })
    subject.notify({ type: 'quest-completion-cancelled', questId: 'q1' })
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })
})

describe('Singleton 패턴: 사용자별 이벤트 등록소', () => {
  it('항상 하나의 Registry 인스턴스를 반환한다', () => {
    expect(QuestEventRegistry.getInstance()).toBe(QuestEventRegistry.getInstance())
  })

  it('사용자별 Subject를 분리하고 같은 사용자는 공유한다', () => {
    const registry = QuestEventRegistry.getInstance()
    const userA = registry.forUser('test-a')
    const userB = registry.forUser('test-b')
    expect(userA).toBe(registry.forUser('test-a'))
    expect(userA).not.toBe(userB)
    const spy = vi.fn()
    const unsubscribe = userA.subscribe({ onQuestEvent: spy })
    userB.notify({ type: 'quest-completion-cancelled', questId: 'test-q' })
    expect(spy).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('빈 사용자 ID를 거부한다', () => {
    expect(() => QuestEventRegistry.getInstance().forUser('  ')).toThrow('USER_ID_REQUIRED')
  })
})
