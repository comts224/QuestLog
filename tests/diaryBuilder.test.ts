import { describe, expect, it } from 'vitest'
import { AdventureDiaryBuilder, type DiaryQuest } from '../src/diary/diaryBuilder'

const quests: DiaryQuest[] = [
  { id: 'q1', title: '독서', difficulty: '쉬움', category: '공부·독서', completed: true, dateKey: '2026-11-27' },
  { id: 'q2', title: '운동', difficulty: '어려움', category: '운동', completed: true, dateKey: '2026-11-27' },
  { id: 'q3', title: '청소', difficulty: '보통', category: '생활·건강', completed: false, dateKey: '2026-11-27' },
  { id: 'q4', title: '다른 날', difficulty: '어려움', category: '과제·업무', completed: true, dateKey: '2026-11-26' },
]

describe('Builder 패턴: 모험 일기', () => {
  it('선택한 날짜만 합산하고 완료 퀘스트의 보상만 기록한다', () => {
    const entry = new AdventureDiaryBuilder().forDate('2026-11-27').forCharacter('용사').withQuests(quests).build()
    expect(entry.totalCount).toBe(3)
    expect(entry.completedCount).toBe(2)
    expect(entry.earnedExp).toBe(45)
    expect(entry.earnedGold).toBe(25)
    expect(entry.story).toContain('용사')
    expect(entry.story).toContain('독서')
    expect(entry.story).toContain('운동')
    expect(entry.story).not.toContain('다른 날')
  })

  it('퀘스트가 없는 날짜에도 일기를 만들 수 있다', () => {
    const entry = new AdventureDiaryBuilder().forDate('2026-11-28').forCharacter('  ').withQuests(quests).build()
    expect(entry.characterName).toBe('모험가')
    expect(entry.totalCount).toBe(0)
    expect(entry.earnedGold).toBe(0)
    expect(entry.story).toContain('기록된 의뢰가 없었다')
  })

  it('모든 퀘스트가 미완료여도 일기를 만들 수 있다', () => {
    const entry = new AdventureDiaryBuilder().forDate('2026-11-27').withQuests([quests[2]]).build()
    expect(entry.completedCount).toBe(0)
    expect(entry.earnedExp).toBe(0)
    expect(entry.story).toContain('완수하지 못했다')
  })
})
