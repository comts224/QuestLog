import { describe, expect, it } from 'vitest'
import { calculateReward, getStatType } from '../src/strategies/rewardStrategy'

describe('Strategy 패턴: 난이도별 보상', () => {
  it.each([
    ['쉬움', 10, 5, 1],
    ['보통', 20, 10, 2],
    ['어려움', 35, 20, 3],
  ] as const)('%s 난이도의 경험치·골드·능력치가 정확하다', (difficulty, exp, gold, statPoint) => {
    expect(calculateReward(difficulty)).toEqual({ exp, gold, statPoint })
  })

  it('카테고리를 올바른 캐릭터 능력치로 변환한다', () => {
    expect(getStatType('공부·독서')).toBe('intelligence')
    expect(getStatType('운동')).toBe('strength')
    expect(getStatType('생활·건강')).toBe('vitality')
    expect(getStatType('과제·업무')).toBe('diligence')
  })
})
