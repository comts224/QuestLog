/**
 * QuestLog의 Command 패턴.
 * 요청(완료/완료 취소)을 객체로 캡슐화하여 UI와 Firebase 저장 절차를 분리합니다.
 * State 패턴은 전이 허용 여부, Command 패턴은 실제 실행을 담당합니다.
 */
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { transitionQuest } from '../quest/questState'
import { parseShop } from '../shop/shopState'
import { calculateReward, type Difficulty } from '../strategies/rewardStrategy'

/** 모든 Command가 동일한 실행 규약을 따르도록 합니다. */
export interface QuestCommand {
  execute(): Promise<void>
}

/** Command 실행기(Invoker): 어떤 종류의 명령인지 몰라도 동일하게 실행할 수 있습니다. */
export class QuestCommandRunner {
  run(command: QuestCommand): Promise<void> {
    return command.execute()
  }
}

export type QuestCommandTarget = {
  userId: string
  questId: string
  dateKey: string
}

/** 퀘스트 완료: 트랜잭션에서 최신 상태와 마감 여부를 확인합니다. */
export class CompleteQuestCommand implements QuestCommand {
  private readonly target: QuestCommandTarget

  constructor(target: QuestCommandTarget) {
    this.target = target
  }

  async execute(): Promise<void> {
    const { userId, questId, dateKey } = this.target
    const questRef = doc(db, 'users', userId, 'quests', questId)
    const diaryRef = doc(db, 'users', userId, 'diaries', dateKey)
    await runTransaction(db, async (transaction) => {
      const diary = await transaction.get(diaryRef)
      const current = await transaction.get(questRef)
      if (!current.exists()) throw new Error('QUEST_CHANGED')
      const next = transitionQuest(
        { completed: current.data().completed === true, closed: diary.exists() },
        'complete',
      )
      transaction.update(questRef, {
        completed: next.status === 'completed',
        completedAt: serverTimestamp(),
      })
    })
  }
}

export type CancelQuestCompletionTarget = QuestCommandTarget & {
  /** 화면에서 보고 있는 퀘스트 IDs. 기존 트랜잭션의 골드 재계산과 동일한 입력입니다. */
  questIds: string[]
}

/** 완료 취소: 사용한 골드를 제외하고도 잔액이 음수가 아닌지 확인합니다. */
export class CancelQuestCompletionCommand implements QuestCommand {
  private readonly target: CancelQuestCompletionTarget

  constructor(target: CancelQuestCompletionTarget) {
    this.target = target
  }

  async execute(): Promise<void> {
    const { userId, questId, dateKey, questIds } = this.target
    const questRef = doc(db, 'users', userId, 'quests', questId)
    const walletRef = doc(db, 'users', userId, 'shop', 'state')
    const questRefs = questIds.map((id) => doc(db, 'users', userId, 'quests', id))

    await runTransaction(db, async (transaction) => {
      const diarySnap = await transaction.get(doc(db, 'users', userId, 'diaries', dateKey))
      const walletSnap = await transaction.get(walletRef)
      const currentShop = parseShop(walletSnap.data())
      const questDocs = await Promise.all(questRefs.map((ref) => transaction.get(ref)))
      const target = questDocs.find((item) => item.id === questRef.id)
      if (!target?.exists()) throw new Error('QUEST_CHANGED')
      const next = transitionQuest(
        { completed: target.data().completed === true, closed: diarySnap.exists() },
        'cancel',
      )
      const earnedAfterCancel = questDocs.reduce((sum, item) => {
        if (!item.exists() || item.id === questRef.id) return sum
        const data = item.data()
        return sum + (data.completed && ['쉬움', '보통', '어려움'].includes(data.difficulty)
          ? calculateReward(data.difficulty as Difficulty).gold : 0)
      }, 0)
      if (earnedAfterCancel < currentShop.spentGold) throw new Error('SPENT_REWARD')
      transaction.update(questRef, { completed: next.status === 'completed', completedAt: null })
    })
  }
}
