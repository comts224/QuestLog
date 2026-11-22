import { useEffect, useRef, useState } from 'react'
import {
  collection, doc, getDocs, onSnapshot, runTransaction, serverTimestamp,
  type DocumentData,
} from 'firebase/firestore'
import { db } from './firebase'
import { AdventureDiaryBuilder, type DiaryEntry, type DiaryQuest } from './diary/diaryBuilder'
import './DiaryPanel.css'

export type SavedDiary = DiaryEntry & { id: string }

type Props = {
  userId: string
  quests: DiaryQuest[]
  diaries: SavedDiary[]
  todayKey: string
  questsLoading: boolean
  diariesLoading: boolean
}

const validDateKey = (key: string) => /^\d{4}-\d{2}-\d{2}$/.test(key)

function fromFirestore(id: string, data: DocumentData): SavedDiary {
  return {
    id,
    dateKey: id,
    characterName: typeof data.characterName === 'string' ? data.characterName : '모험가',
    quests: Array.isArray(data.quests) ? data.quests as DiaryQuest[] : [],
    completedCount: Number(data.completedCount) || 0,
    totalCount: Number(data.totalCount) || 0,
    earnedExp: Number(data.earnedExp) || 0,
    earnedGold: Number(data.earnedGold) || 0,
    story: typeof data.story === 'string' ? data.story : '',
  }
}

export function readDiaries(snapshot: { docs: { id: string; data(): DocumentData }[] }): SavedDiary[] {
  return snapshot.docs.map((item) => fromFirestore(item.id, item.data()))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
}

export default function DiaryPanel({ userId, quests, diaries, todayKey, questsLoading, diariesLoading }: Props) {
  const [characterName, setCharacterName] = useState('모험가')
  const [profileLoading, setProfileLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState('')
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState('')
  const processing = useRef(false)
  const attemptedAutomaticDates = useRef<Set<string>>(new Set())

  useEffect(() => {
    setProfileLoading(true)
    attemptedAutomaticDates.current.clear()
    return onSnapshot(doc(db, 'users', userId, 'profile', 'main'), (snapshot) => {
      const name = snapshot.data()?.characterName
      setCharacterName(typeof name === 'string' && name.trim() ? name.trim() : '모험가')
      setProfileLoading(false)
    }, () => {
      setCharacterName('모험가')
      setProfileLoading(false)
    })
  }, [userId])

  const closedDays = new Set(diaries.map((entry) => entry.dateKey))
  const previousOpenDates = [...new Set(quests.map((quest) => quest.dateKey))]
    .filter((dateKey) => validDateKey(dateKey) && dateKey < todayKey && !closedDays.has(dateKey))
    .sort()

  /** 같은 날짜의 일기는 정해진 문서 ID로 단 한 번만 생성합니다. */
  async function closeDay(dateKey: string, automatic: boolean) {
    if (processing.current || !validDateKey(dateKey) || dateKey > todayKey) return
    processing.current = true
    setClosing(true)
    if (!automatic) setError('')
    try {
      // 트랜잭션에서 현재 문서 내용을 다시 읽어 일기에 고정합니다.
      const questList = await getDocs(collection(db, 'users', userId, 'quests'))
      const questRefs = questList.docs.filter((snapshot) => snapshot.data().dateKey === dateKey)
        .map((snapshot) => snapshot.ref)
      const diaryRef = doc(db, 'users', userId, 'diaries', dateKey)
      await runTransaction(db, async (transaction) => {
        const oldDiary = await transaction.get(diaryRef)
        if (oldDiary.exists()) return
        const questDocs = await Promise.all(questRefs.map((ref) => transaction.get(ref)))
        const latest = questDocs.filter((snapshot) => snapshot.exists()).map((snapshot) => {
          const data = snapshot.data()
          return {
            id: snapshot.id,
            title: typeof data.title === 'string' ? data.title : '이름 없는 퀘스트',
            difficulty: (['쉬움', '보통', '어려움'].includes(data.difficulty) ? data.difficulty : '보통') as DiaryQuest['difficulty'],
            category: (['공부·독서', '운동', '생활·건강', '과제·업무'].includes(data.category) ? data.category : '과제·업무') as DiaryQuest['category'],
            completed: data.completed === true,
            dateKey,
          }
        })
        const entry = new AdventureDiaryBuilder()
          .forDate(dateKey).forCharacter(characterName).withQuests(latest).build()
        transaction.set(diaryRef, { ...entry, createdAt: serverTimestamp() })
      })
    } catch {
      setError(automatic ? '지난 날짜의 자동 마감에 실패했습니다. 다시 접속하거나 직접 마감해 주세요.' : '일기 저장에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      processing.current = false
      setClosing(false)
    }
  }

  // 과거에 열려 있던 날짜는 재접속 시 가장 오래된 날부터 자동 마감합니다.
  useEffect(() => {
    if (questsLoading || diariesLoading || profileLoading || closing || previousOpenDates.length === 0) return
    const nextDate = previousOpenDates.find((date) => !attemptedAutomaticDates.current.has(date))
    if (!nextDate) return
    attemptedAutomaticDates.current.add(nextDate)
    void closeDay(nextDate, true)
    // 마감이 Firestore에 반영되면 diaries가 갱신되어 다음 날짜를 처리합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questsLoading, diariesLoading, profileLoading, closing, diaries, quests, todayKey, characterName])

  const latest = diaries[0]
  const selected = diaries.find((entry) => entry.dateKey === selectedDate) ?? latest
  const todayClosed = closedDays.has(todayKey)
  const todayQuests = quests.filter((quest) => quest.dateKey === todayKey)

  return (
    <section className="panel diary-panel">
      <h2>📖 모험 일기장</h2>
      <p className="diary-note">하루를 마감하면 완료·미완료 퀘스트와 보상이 3인칭 모험 이야기로 저장됩니다. 마감한 날짜는 수정할 수 없습니다.</p>
      <div className="diary-close-row">
        <span>오늘 {todayQuests.length}개 퀘스트 · {todayQuests.filter((quest) => quest.completed).length}개 완료</span>
        <button type="button" disabled={closing || questsLoading || diariesLoading || profileLoading || todayClosed}
          onClick={() => { if (window.confirm('오늘을 마감하면 오늘의 퀘스트를 더 이상 수정할 수 없습니다. 마감할까요?')) void closeDay(todayKey, false) }}>
          {todayClosed ? '오늘 마감 완료 ✓' : closing ? '마감 중...' : '오늘 하루 마감하기'}
        </button>
      </div>
      {error && <p className="diary-error" role="alert">{error}</p>}
      {diaries.length === 0 ? (
        <p className="diary-note">아직 저장된 모험 일기가 없습니다. 하루 마감 버튼으로 첫 일기를 만들어 보세요.</p>
      ) : (
        <>
          <label className="diary-select-label" htmlFor="diary-date">기록 날짜 선택</label>
          <select id="diary-date" value={selected?.dateKey ?? ''} onChange={(event) => setSelectedDate(event.target.value)}>
            {diaries.map((entry) => <option key={entry.dateKey} value={entry.dateKey}>{entry.dateKey}</option>)}
          </select>
          {selected && <article className="diary-page">
            <h3>{selected.dateKey} · {selected.characterName}의 모험</h3>
            <p className="diary-story">{selected.story}</p>
            <p className="diary-summary">✅ {selected.completedCount}/{selected.totalCount} 완료 · ✨ +{selected.earnedExp} EXP · 🪙 +{selected.earnedGold} G</p>
            <h4>그날의 퀘스트</h4>
            <ul>{selected.quests.map((quest) => <li key={quest.id}>{quest.completed ? '✅' : '⬜'} {quest.title} ({quest.difficulty})</li>)}</ul>
          </article>}
        </>
      )}
    </section>
  )
}
