import { calculateReward, type Difficulty, type QuestCategory } from '../strategies/rewardStrategy'

export type DiaryQuest = {
  id: string
  title: string
  difficulty: Difficulty
  category: QuestCategory
  completed: boolean
  dateKey: string
}

export type DiaryEntry = {
  dateKey: string
  characterName: string
  quests: DiaryQuest[]
  completedCount: number
  totalCount: number
  earnedExp: number
  earnedGold: number
  story: string
}

const PLACES: Record<QuestCategory, string> = {
  '공부·독서': '마법 도서관에서 새로운 지식을 탐구했다',
  '운동': '훈련장에서 몸을 단련했다',
  '생활·건강': '회복의 숲에서 자신을 돌보았다',
  '과제·업무': '모험가 길드의 중요한 의뢰를 처리했다',
}

/** Builder 패턴: 하루의 원시 퀘스트로부터 통계와 3인칭 모험 서사를 단계별로 구성합니다. */
export class AdventureDiaryBuilder {
  private dateKey = ''
  private characterName = '모험가'
  private quests: DiaryQuest[] = []

  forDate(dateKey: string): this {
    this.dateKey = dateKey
    return this
  }

  forCharacter(name: string): this {
    this.characterName = name.trim().slice(0, 20) || '모험가'
    return this
  }

  withQuests(quests: DiaryQuest[]): this {
    this.quests = quests.map(({ id, title, difficulty, category, completed, dateKey }) => ({
      id, title, difficulty, category, completed, dateKey,
    }))
    return this
  }

  build(): DiaryEntry {
    const quests = this.quests.filter((quest) => quest.dateKey === this.dateKey)
    const completed = quests.filter((quest) => quest.completed)
    const earnedExp = completed.reduce((sum, quest) => sum + calculateReward(quest.difficulty).exp, 0)
    const earnedGold = completed.reduce((sum, quest) => sum + calculateReward(quest.difficulty).gold, 0)
    const name = this.characterName
    const snippets = completed.slice(0, 3).map((quest) => {
      const place = PLACES[quest.category] ?? '새로운 장소에서 모험을 이어 갔다'
      return `「${quest.title}」 임무를 수행하며 ${place}`
    })

    let story: string
    if (quests.length === 0) {
      story = `${name}에게는 오늘 기록된 의뢰가 없었다. 조용한 하루도 다음 모험을 위한 준비가 되었다.`
    } else if (completed.length === 0) {
      story = `${name}는 오늘 ${quests.length}개의 의뢰를 마주했지만 아직 완수하지 못했다. 남은 의뢰는 기록으로 남기고 다음 모험을 준비했다.`
    } else {
      story = `${name}는 ${snippets.join(', ')}. ${completed.length}개의 의뢰를 완수하며 경험치 ${earnedExp}와 골드 ${earnedGold}G를 얻었다.`
      if (completed.length > 3) story += ` 그 밖에도 ${completed.length - 3}개의 임무를 더 마쳤다.`
      const unfinished = quests.length - completed.length
      if (unfinished > 0) story += ` 마치지 못한 ${unfinished}개의 의뢰는 아쉬움으로 남았다.`
    }

    return {
      dateKey: this.dateKey,
      characterName: name,
      quests,
      completedCount: completed.length,
      totalCount: quests.length,
      earnedExp,
      earnedGold,
      story,
    }
  }
}
