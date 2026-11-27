import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORY, FirestoreQuestAdapter } from '../src/adapters/questAdapter'

describe('Adapter 패턴: Firestore 문서 → 화면 퀘스트', () => {
  const adapter = new FirestoreQuestAdapter()

  it('정상 문서를 변환한다', () => {
    expect(adapter.adapt('q1', {
      title: '책 읽기', difficulty: '어려움', category: '공부·독서', completed: true, dateKey: '2026-11-27',
    })).toEqual({
      id: 'q1', title: '책 읽기', difficulty: '어려움', category: '공부·독서', completed: true, dateKey: '2026-11-27',
    })
  })

  it('과거 문서에 카테고리가 없어도 기본값을 사용한다', () => {
    const quest = adapter.adapt('old', { title: '옛 퀘스트', completed: false })
    expect(quest.category).toBe(DEFAULT_CATEGORY)
    expect(quest.difficulty).toBe('보통')
    expect(quest.dateKey).toBe('')
  })

  it('잘못된 필드 형식을 안전한 기본값으로 변환한다', () => {
    const quest = adapter.adapt('bad', { title: 99, completed: 'true', category: '없는 분류', difficulty: '극악', dateKey: 123 })
    expect(quest).toMatchObject({ title: '', completed: false, category: DEFAULT_CATEGORY, difficulty: '보통', dateKey: '' })
  })
})
