import type { Difficulty, QuestCategory } from '../strategies/rewardStrategy'

/** 화면이 사용하는 퀘스트 모델 (Firestore API와 무관합니다). */
export type Quest = {
  id: string
  title: string
  difficulty: Difficulty
  category: QuestCategory
  completed: boolean
  dateKey: string
}

/** 기존 Firestore 문서에는 category가 없을 수 있어 기본값을 유지합니다. */
export const DEFAULT_CATEGORY: QuestCategory = '과제·업무'
export const CATEGORIES: QuestCategory[] = ['공부·독서', '운동', '생활·건강', '과제·업무']

/** 외부 저장소 데이터를 화면 모델로 바꾸는 Adapter 계약입니다. */
export interface QuestDataAdapter {
  adapt(id: string, source: Record<string, unknown>): Quest
}

/**
 * Adapter 패턴의 구체 구현체입니다.
 * Firestore의 느슨한 데이터 구조를 화면에서 사용하기 좋은 Quest 타입으로 변환합니다.
 * Firestore 접근/저장/보안 규칙 자체는 변경하지 않습니다.
 */
export class FirestoreQuestAdapter implements QuestDataAdapter {
  adapt(id: string, source: Record<string, unknown>): Quest {
    const category = source.category
    const difficulty = source.difficulty
    return {
      id,
      title: typeof source.title === 'string' ? source.title : '',
      difficulty: difficulty === '쉬움' || difficulty === '보통' || difficulty === '어려움'
        ? difficulty
        : '보통',
      category: CATEGORIES.includes(category as QuestCategory)
        ? category as QuestCategory
        : DEFAULT_CATEGORY,
      completed: source.completed === true,
      dateKey: typeof source.dateKey === 'string' ? source.dateKey : '',
    }
  }
}
