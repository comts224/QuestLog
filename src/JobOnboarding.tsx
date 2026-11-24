import { useEffect, useState } from 'react'
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import './JobOnboarding.css'

import { JOBS, STARTER_GEAR, parseJobId, type JobId } from './jobs/starterEquipment'

const JOB_OPTIONS = JOBS.map(job => ({ ...job, description: `${job.name}의 길을 선택합니다.` }))

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
        setCurrentJob(parseJobId(value))
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
      const equipmentRef = doc(db, 'users', userId, 'equipment', 'current')
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref)
        await transaction.get(equipmentRef)
        // 다른 탭에서 먼저 선택했더라도 최초 직업을 덮어쓰지 않습니다.
        if (snapshot.exists()) {
          throw new Error('JOB_ALREADY_CHOSEN')
        }
        // 최초 직업을 선택할 때 기본 장비도 함께 지급합니다.
        // 기존 구매 내역(shop/state)은 절대 변경하지 않습니다.
        const starter = STARTER_GEAR[selectedJob]
        transaction.set(equipmentRef, {
          ...starter,
          starterJobId: selectedJob,
          updatedAt: serverTimestamp(),
        }, { merge: true })
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
              <span className="job-onboarding-starter">기본 장비: {job.starter}</span>
            </label>
          ))}
        </div>

        {error && <p className="job-onboarding-error" role="alert">{error}</p>}
        <button className="job-onboarding-confirm" type="button" onClick={chooseJob} disabled={saving || Boolean(error && error.includes('불러오지'))}>
          {saving ? '저장하는 중...' : `${JOB_OPTIONS.find((job) => job.id === selectedJob)?.name}로 모험 시작하기`}
        </button>
        <p className="job-onboarding-footnote">선택한 직업은 Firebase에 저장됩니다. 기본 장비가 함께 지급됩니다. 직업 변경권은 다음 개발 단계에서 추가됩니다.</p>
      </section>
    </div>
  )
}
