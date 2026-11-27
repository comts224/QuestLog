/**
 * Facade 패턴: 퀘스트 동작을 실행하는 여러 하위 시스템의 단순한 진입점.
 * 1) Command 실행 (내부에서 State 규칙 + Firestore 트랜잭션 검사)
 * 2) 성공 후 Observer 이벤트 발행 (Singleton 등록소에서 사용자별 Subject 조회)
 *
 * 화면에서는 완료/취소에 필요한 값만 전달합니다.
 * 원본 데이터 구조나 트랜잭션 규칙은 변경하지 않습니다.
 */
import {
  CancelQuestCompletionCommand,
  CompleteQuestCommand,
  QuestCommandRunner,
} from '../commands/questCommands'
import { QuestEventRegistry } from '../singletons/questEventRegistry'
import { calculateReward, type Difficulty } from '../strategies/rewardStrategy'

export type CompleteQuestRequest = {
  questId: string
  dateKey: string
  difficulty: Difficulty
}

export type CancelQuestRequest = {
  questId: string
  dateKey: string
  questIds: string[]
}

export class QuestActionFacade {
  private readonly userId: string
  private readonly runner = new QuestCommandRunner()

  constructor(userId: string) {
    if (!userId.trim()) throw new Error('USER_ID_REQUIRED')
    this.userId = userId
  }

  async complete(request: CompleteQuestRequest): Promise<void> {
    await this.runner.run(new CompleteQuestCommand({
      userId: this.userId,
      questId: request.questId,
      dateKey: request.dateKey,
    }))
    // Firestore 저장이 성공한 경우에만 보상 이벤트를 발행합니다.
    const reward = calculateReward(request.difficulty)
    QuestEventRegistry.getInstance().forUser(this.userId).notify({
      type: 'quest-completed',
      questId: request.questId,
      exp: reward.exp,
      gold: reward.gold,
    })
  }

  async cancelCompletion(request: CancelQuestRequest): Promise<void> {
    await this.runner.run(new CancelQuestCompletionCommand({
      userId: this.userId,
      questId: request.questId,
      dateKey: request.dateKey,
      questIds: request.questIds,
    }))
    // 골드 사용 검증을 통과하여 취소가 성공한 경우에만 알림을 발행합니다.
    QuestEventRegistry.getInstance().forUser(this.userId).notify({
      type: 'quest-completion-cancelled',
      questId: request.questId,
    })
  }
}
