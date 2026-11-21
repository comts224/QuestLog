
import { useState } from 'react'
import './App.css'

// 퀘스트 한 개가 가지는 데이터 형태
type Quest = {
  id: number
  title: string
  difficulty: '쉬움' | '보통' | '어려움'
  completed: boolean
}

// 난이도에 따라 지급되는 보상
const rewards = {
  쉬움: { exp: 10, gold: 5 },
  보통: { exp: 20, gold: 10 },
  어려움: { exp: 35, gold: 20 },
}

function App() {
  // 캐릭터의 누적 경험치와 보유 골드
  const [totalExp, setTotalExp] = useState(0)
  const [gold, setGold] = useState(0)

  // 지금은 테스트용 퀘스트 3개를 사용합니다.
  const [quests, setQuests] = useState<Quest[]>([
    { id: 1, title: '알고리즘 문제 풀기', difficulty: '보통', completed: false },
    { id: 2, title: '운동 30분', difficulty: '쉬움', completed: false },
    { id: 3, title: '과제 정리하기', difficulty: '어려움', completed: false },
  ])

  // 누적 경험치를 이용해 레벨 계산
  function calculateLevel(exp: number) {
    let level = 1
    let remaining = exp

    while (remaining >= level * 100) {
      remaining -= level * 100
      level++
    }

    return {
      level,
      currentExp: remaining,
      requiredExp: level * 100,
    }
  }

  const character = calculateLevel(totalExp)
  const completedCount = quests.filter((quest) => quest.completed).length

  // 퀘스트 완료 버튼을 누르면 보상을 한 번만 지급
  function completeQuest(id: number) {
    const target = quests.find((quest) => quest.id === id)

    if (!target || target.completed) return

    const reward = rewards[target.difficulty]

    setQuests((previous) =>
      previous.map((quest) =>
        quest.id === id ? { ...quest, completed: true } : quest
      )
    )

    setTotalExp((previous) => previous + reward.exp)
    setGold((previous) => previous + reward.gold)
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <p className="eyebrow">MY DAILY ADVENTURE</p>
          <h1>QuestLog</h1>
          <p>오늘의 할 일을 퀘스트로 완료하고 모험가를 성장시키세요.</p>
        </div>
      </header>

      <main className="dashboard">
        <section className="panel character-panel">
          <h2>나의 모험가</h2>

          <div className="character-image" aria-label="캐릭터 임시 이미지">
            🧙
          </div>

          <h3>Lv. {character.level} 초보 모험가</h3>

          <div className="exp-label">
            <span>EXP</span>
            <span>
              {character.currentExp} / {character.requiredExp}
            </span>
          </div>

          <div className="exp-bar">
            <div
              className="exp-fill"
              style={{
                width: `${
                  (character.currentExp / character.requiredExp) * 100
                }%`,
              }}
            />
          </div>

          <p className="gold">🪙 보유 골드: {gold} G</p>

          <p className="character-info">
            퀘스트를 완료하면 경험치와 골드를 얻습니다.
          </p>
        </section>

        <section className="panel quest-panel">
          <div className="quest-heading">
            <div>
              <h2>오늘의 퀘스트</h2>
              <p>완료한 퀘스트: {completedCount} / {quests.length}</p>
            </div>
          </div>

          <div className="quest-list">
            {quests.map((quest) => {
              const reward = rewards[quest.difficulty]

              return (
                <div className="quest-item" key={quest.id}>
                  <div>
                    <h3>{quest.title}</h3>
                    <p>
                      난이도: {quest.difficulty} · EXP +{reward.exp} ·
                      골드 +{reward.gold}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => completeQuest(quest.id)}
                    disabled={quest.completed}
                  >
                    {quest.completed ? '완료!' : '퀘스트 완료'}
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
