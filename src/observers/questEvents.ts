/** QuestLog 내부 퀘스트 이벤트. 서버 저장 결과와 구별되는 UI 이벤트입니다. */
export type QuestEvent =
  | { readonly type: 'quest-completed'; readonly questId: string; readonly exp: number; readonly gold: number }
  | { readonly type: 'quest-completion-cancelled'; readonly questId: string }

/** Observer 패턴에서 이벤트를 받는 객체의 공통 계약입니다. */
export interface QuestObserver {
  onQuestEvent(event: QuestEvent): void
}

/** Observer 패턴의 Subject: 구독자 등록/해제/알림을 담당합니다. */
export class QuestEventSubject {
  private readonly observers = new Set<QuestObserver>()

  subscribe(observer: QuestObserver): () => void {
    this.observers.add(observer)
    return () => { this.observers.delete(observer) }
  }

  notify(event: QuestEvent): void {
    // 알림 중 구독 해제되더라도 순회가 안정적으로 진행되도록 복사합니다.
    for (const observer of [...this.observers]) {
      observer.onQuestEvent(event)
    }
  }
}
