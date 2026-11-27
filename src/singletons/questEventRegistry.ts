import { QuestEventSubject } from '../observers/questEvents'

/**
 * Singleton 패턴: 앱 전체가 공유하는 퀘스트 이벤트 Subject 등록소.
 * 사용자별 Subject를 분리하여 다른 계정의 보상 알림이 섞이지 않게 합니다.
 *
 * Subject 자체는 기존 Observer 패턴의 구현을 재사용합니다.
 */
export class QuestEventRegistry {
  private static instance: QuestEventRegistry | undefined
  private readonly subjects = new Map<string, QuestEventSubject>()

  // 외부에서 new QuestEventRegistry() 호출을 막습니다.
  private constructor() {}

  static getInstance(): QuestEventRegistry {
    if (!QuestEventRegistry.instance) {
      QuestEventRegistry.instance = new QuestEventRegistry()
    }
    return QuestEventRegistry.instance
  }

  /** 동일 사용자 ID는 항상 동일한 Subject를 반환합니다. */
  forUser(userId: string): QuestEventSubject {
    if (!userId.trim()) throw new Error('USER_ID_REQUIRED')
    let subject = this.subjects.get(userId)
    if (!subject) {
      subject = new QuestEventSubject()
      this.subjects.set(userId, subject)
    }
    return subject
  }
}
