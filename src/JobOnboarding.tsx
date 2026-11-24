import { useEffect, useState } from 'react'
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import './JobOnboarding.css'

// 직업 변경권을 구현할 때에도 동일한 ID를 재사용합니다.
export const JOB_OPTIONS = [
  { id: 'farmer', name: '농부', emoji: '🌾', description: '밭을 가꾸며 하루하루 꾸준히 성장하는 모험가', starter: '밀짚모자 · 작업복' },
  { id: 'mage', name: '마법사', emoji: '🧙', description: '지식과 마법을 탐구하는 모험가', starter: '마법사 모자 · 로브' },
  { id: 'knight', name: '기사', emoji: '⚔️', description: '단련과 용기로 길을 개척하는 모험가', starter: '투구 · 갑옷' },
  { id: 'doctor', name: '의사', emoji: '🩺', description: '생명과 회복의 가치를 지키는 모험가', starter: '의사 가운 · 의료가방' },
  { id: 'cleric', name: '성직자', emoji: '✨', description: '희망과 치유의 빛을 전하는 모험가', starter: '성직자 로브 · 성표' },
] as const

export type JobId = (typeof JOB_OPTIONS)[number]['id']

function isJobId(value: unknown): value is JobId {
  return JOB_OPTIONS.some((job) => job.id === value)
}

/**
 * 최초 직업 선택 전용 창.
 * 저장 위치: users/{uid}/profile/job
 * 직업이 저장된 뒤에는 이 창에서 변경할 수 없습니다.
 * (추후 상점 변경권은 별도 거래 로직으로 구현합니다.)
 */
export default function JobOnboarding({ userId }: { userId: string }) {
  const [currentJob, setCurrentJob] = useState<JobId | null>(null)
  const [selectedJob, setSelectedJob] = useState<JobId>('farmer')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setCurrentJob(null)
    setError('')

    return onSnapshot(
      doc(db, 'users', userId, 'profile', 'job'),
      (snapshot) => {
        const value = snapshot.data()?.jobId
        setCurrentJob(isJobId(value) ? value : null)
        setLoading(false)
      },
      () => {
        setError('직업 정보를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.')
        setLoading(false)
      },
    )
  }, [userId])

  async function chooseJob() {
    if (saving || loading || currentJob !== null) return
    setSaving(true)
    setError('')

    try {
      const ref = doc(db, 'users', userId, 'profile', 'job')
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref)
        // 다른 탭에서 먼저 선택했더라도 최초 직업을 덮어쓰지 않습니다.
        if (snapshot.exists()) {
          throw new Error('JOB_ALREADY_CHOSEN')
        }
        transaction.set(ref, {
          jobId: selectedJob,
          selectedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      })
    } catch (caught) {
      if (caught instanceof Error && caught.message === 'JOB_ALREADY_CHOSEN') {
        setError('이미 직업이 선택되어 있습니다. 다른 탭에서 선택했다면 새로고침해 주세요.')
      } else {
        setError('직업 선택을 저장하지 못했습니다. 다시 시도해 주세요.')
      }
    } finally {
      setSaving(false)
    }
  }

  // 선택한 직업은 작은 상태 표시로 확인할 수 있고 이 화면에서 변경할 수 없습니다.
  if (loading) return null
  if (currentJob !== null) {
    const job = JOB_OPTIONS.find((item) => item.id === currentJob)
    return <p className="job-onboarding-current" aria-label="현재 직업">{job?.emoji} 현재 직업: <strong>{job?.name}</strong></p>
  }

  return (
    <div className="job-onboarding-backdrop">
      <section className="job-onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="job-onboarding-title">
        <p className="job-onboarding-eyebrow">CHOOSE YOUR PATH</p>
        <h2 id="job-onboarding-title">첫 번째 직업을 선택하세요</h2>
        <p className="job-onboarding-description">
          처음 직업은 무료입니다. 선택 후에는 상점의 직업 변경권으로만 바꿀 수 있도록 구현할 예정입니다.
        </p>

        <div className="job-onboarding-grid" role="radiogroup" aria-label="모험가 직업">
          {JOB_OPTIONS.map((job) => (
            <label key={job.id} className={`job-onboarding-option ${selectedJob === job.id ? 'is-selected' : ''}`}>
              <input
                type="radio"
                name="questlog-first-job"
                value={job.id}
                checked={selectedJob === job.id}
                onChange={() => setSelectedJob(job.id)}
                disabled={saving}
              />
              <span className="job-onboarding-emoji" aria-hidden="true">{job.emoji}</span>
              <strong>{job.name}</strong>
              <span className="job-onboarding-flavor">{job.description}</span>
              <span className="job-onboarding-starter">기본 장비 예정: {job.starter}</span>
            </label>
          ))}
        </div>

        {error && <p className="job-onboarding-error" role="alert">{error}</p>}
        <button className="job-onboarding-confirm" type="button" onClick={chooseJob} disabled={saving || Boolean(error && error.includes('불러오지'))}>
          {saving ? '저장하는 중...' : `${JOB_OPTIONS.find((job) => job.id === selectedJob)?.name}로 모험 시작하기`}
        </button>
        <p className="job-onboarding-footnote">선택한 직업은 Firebase에 저장됩니다. 직업별 장비와 변경권은 다음 개발 단계에서 추가합니다.</p>
      </section>
    </div>
  )
}
