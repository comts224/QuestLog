
/**
 * Strategy 디자인 패턴
 *
 * 퀘스트 난이도에 따라 서로 다른 보상 계산 방식을 사용합니다.
 */

// 퀘스트 난이도
export type Difficulty = '쉬움' | '보통' | '어려움'

// 퀘스트 카테고리
export type QuestCategory =
  | '공부·독서'
  | '운동'
  | '생활·건강'
  | '과제·업무'

// 캐릭터 능력치 종류
export type StatType =
  | 'intelligence'
  | 'strength'
  | 'vitality'
  | 'diligence'

// 보상 계산 결과
export type QuestReward = {
  exp: number
  gold: number
  statPoint: number
}

// Strategy 인터페이스
interface RewardStrategy {
  calculate(): QuestReward
}

// 쉬움 난이도의 보상 계산 전략
class EasyRewardStrategy implements RewardStrategy {
  calculate(): QuestReward {
    return {
      exp: 10,
      gold: 5,
      statPoint: 1,
    }
  }
}

// 보통 난이도의 보상 계산 전략
class NormalRewardStrategy implements RewardStrategy {
  calculate(): QuestReward {
    return {
      exp: 20,
      gold: 10,
      statPoint: 2,
    }
  }
}

// 어려움 난이도의 보상 계산 전략
class HardRewardStrategy implements RewardStrategy {
  calculate(): QuestReward {
    return {
      exp: 35,
      gold: 20,
      statPoint: 3,
    }
  }
}

// 난이도에 따라 사용할 전략을 선택합니다.
function selectStrategy(difficulty: Difficulty): RewardStrategy {
  switch (difficulty) {
    case '쉬움':
      return new EasyRewardStrategy()

    case '보통':
      return new NormalRewardStrategy()

    case '어려움':
      return new HardRewardStrategy()
  }
}

// 외부에서 사용하는 보상 계산 함수
export function calculateReward(
  difficulty: Difficulty
): QuestReward {
  const strategy = selectStrategy(difficulty)
  return strategy.calculate()
}

// 퀘스트 카테고리를 캐릭터 능력치로 변환합니다.
export function getStatType(category: QuestCategory): StatType {
  switch (category) {
    case '공부·독서':
      return 'intelligence'

    case '운동':
      return 'strength'

    case '생활·건강':
      return 'vitality'

    case '과제·업무':
      return 'diligence'
  }
}
