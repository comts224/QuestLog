/**
 * QuestLog 퀘스트 State 패턴.
 * 저장 형식(completed:boolean)은 유지하고, 일기 마감 여부를 조합해 상태 객체를 결정합니다.
 * UI의 버튼 활성화 검사와 Firestore 트랜잭션 내부 검증에 같은 규칙을 사용합니다.
 */
export type QuestAction = 'complete' | 'cancel' | 'edit' | 'delete'
export type QuestStatus = 'pending' | 'completed' | 'closed'

export type QuestStateContext = {
  completed: boolean
  closed: boolean
}

export class QuestStateError extends Error {
  readonly code: 'QUEST_CHANGED' | 'DAY_CLOSED'

  constructor(code: 'QUEST_CHANGED' | 'DAY_CLOSED') {
    super(code)
    this.name = 'QuestStateError'
    this.code = code
  }
}

/** State: 상태마다 허용되는 전이를 하위 클래스에서 정의합니다. */
export abstract class QuestState {
  abstract readonly status: QuestStatus

  /** 완료나 완료 취소 등 상태 전이가 완료된 다음 상태를 반환합니다. */
  complete(): QuestState { throw new QuestStateError('QUEST_CHANGED') }
  cancel(): QuestState { throw new QuestStateError('QUEST_CHANGED') }
  edit(): QuestState { throw new QuestStateError('QUEST_CHANGED') }
  delete(): QuestState { throw new QuestStateError('QUEST_CHANGED') }

  can(action: QuestAction): boolean {
    try {
      this.transition(action)
      return true
    } catch (error) {
      if (error instanceof QuestStateError) return false
      throw error
    }
  }

  transition(action: QuestAction): QuestState {
    switch (action) {
      case 'complete': return this.complete()
      case 'cancel': return this.cancel()
      case 'edit': return this.edit()
      case 'delete': return this.delete()
    }
  }
}

/** 진행 중: 완료/수정/삭제만 허용합니다. */
export class PendingQuestState extends QuestState {
  readonly status = 'pending' as const
  override complete(): QuestState { return new CompletedQuestState() }
  override edit(): QuestState { return this }
  override delete(): QuestState { return this }
}

/** 완료: 완료 취소만 허용합니다(골드 잔액 검증은 별도 도메인 규칙). */
export class CompletedQuestState extends QuestState {
  readonly status = 'completed' as const
  override cancel(): QuestState { return new PendingQuestState() }
}

/** 마감: 해당 날짜의 모든 퀘스트 변경을 차단합니다. */
export class ClosedQuestState extends QuestState {
  readonly status = 'closed' as const
  override transition(_action: QuestAction): QuestState { throw new QuestStateError('DAY_CLOSED') }
}

/** Firestore의 기존 필드로 현재 상태를 복원합니다. */
export function getQuestState(context: QuestStateContext): QuestState {
  if (context.closed) return new ClosedQuestState()
  return context.completed ? new CompletedQuestState() : new PendingQuestState()
}

export function canQuestAction(context: QuestStateContext, action: QuestAction): boolean {
  return getQuestState(context).can(action)
}

export function transitionQuest(context: QuestStateContext, action: QuestAction): QuestState {
  return getQuestState(context).transition(action)
}
