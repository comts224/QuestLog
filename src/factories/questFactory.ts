import { serverTimestamp } from 'firebase/firestore'

/** Firestore에 저장할 퀘스트의 공통 데이터 형태입니다. */
export type QuestCreationInput = {
  title: string
  category: string
  difficulty: string
  dateKey: string
}

export type RetryQuestInput = QuestCreationInput & {
  sourceDateKey: string
  sourceQuestId: string
}

type QuestFields = QuestCreationInput & {
  retrySource?: { dateKey: string; questId: string }
}

/**
 * Factory Method의 Creator입니다.
 * 생성 절차(미완료 상태, 생성 시각)는 공통으로 유지하며,
 * 어떤 종류의 퀘스트를 만들지는 하위 클래스의 factory method가 결정합니다.
 */
export abstract class QuestCreator<TInput> {
  create(input: TInput) {
    return {
      ...this.createFields(input),
      completed: false as const,
      completedAt: null,
      createdAt: serverTimestamp(),
    }
  }

  protected abstract createFields(input: TInput): QuestFields
}

/** 등록 화면에서 만드는 일반 퀘스트입니다. */
export class DailyQuestCreator extends QuestCreator<QuestCreationInput> {
  protected createFields(input: QuestCreationInput): QuestFields {
    return {
      title: input.title,
      category: input.category,
      difficulty: input.difficulty,
      dateKey: input.dateKey,
    }
  }
}

/** 마감된 일기의 미완료 퀘스트를 다시 도전할 때 사용합니다. */
export class RetryQuestCreator extends QuestCreator<RetryQuestInput> {
  protected createFields(input: RetryQuestInput): QuestFields {
    return {
      title: input.title,
      category: input.category,
      difficulty: input.difficulty,
      dateKey: input.dateKey,
      retrySource: {
        dateKey: input.sourceDateKey,
        questId: input.sourceQuestId,
      },
    }
  }
}
