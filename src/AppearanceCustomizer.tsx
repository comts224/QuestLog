import { useEffect, useState } from 'react'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import {
  DEFAULT_APPEARANCE,
  HAIR_COLORS,
  SKIN_COLORS,
  normalizeAppearance,
  type CharacterAppearance,
} from './appearance/palette'
import './AppearanceCustomizer.css'

type Props = {
  userId: string
  onAppearanceChange: (appearance: CharacterAppearance) => void
}

/** 피부색/머리색은 장비 구매·장착과 독립적으로 저장됩니다. */
export default function AppearanceCustomizer({ userId, onAppearanceChange }: Props) {
  const [appearance, setAppearance] = useState<CharacterAppearance>(DEFAULT_APPEARANCE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setAppearance(DEFAULT_APPEARANCE)
    onAppearanceChange(DEFAULT_APPEARANCE)
    setLoading(true)
    setError('')

    return onSnapshot(
      doc(db, 'users', userId, 'appearance', 'current'),
      (snapshot) => {
        const next = normalizeAppearance(snapshot.data())
        setAppearance(next)
        onAppearanceChange(next)
        setLoading(false)
      },
      () => {
        setError('캐릭터 외형을 불러오지 못했습니다.')
        setLoading(false)
      },
    )
  }, [userId, onAppearanceChange])

  async function save(next: CharacterAppearance) {
    if (loading || saving) return
    setSaving(true)
    setError('')
    try {
      await setDoc(
        doc(db, 'users', userId, 'appearance', 'current'),
        { ...next, updatedAt: serverTimestamp() },
        { merge: true },
      )
      // 저장 완료 후 onSnapshot이 실제 저장된 값을 다시 전달합니다.
    } catch {
      setError('외형 저장에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="appearance-customizer">
      <h3>캐릭터 외형</h3>
      <p className="appearance-hint">피부색과 머리색은 무료로 변경할 수 있어요.</p>
      <div className="appearance-group">
        <span className="appearance-label">피부색</span>
        <div className="appearance-swatches" role="group" aria-label="피부색 선택">
          {SKIN_COLORS.map((option) => (
            <button
              key={option.id}
              type="button"
              title={option.label}
              aria-label={`피부색: ${option.label}`}
              aria-pressed={appearance.skin === option.id}
              className={`appearance-swatch ${appearance.skin === option.id ? 'selected' : ''}`}
              style={{ backgroundColor: option.hex }}
              disabled={loading || saving}
              onClick={() => { void save({ ...appearance, skin: option.id }) }}
            />
          ))}
        </div>
        <span className="appearance-selected">{SKIN_COLORS.find((o) => o.id === appearance.skin)?.label}</span>
      </div>
      <div className="appearance-group">
        <span className="appearance-label">머리색</span>
        <div className="appearance-swatches" role="group" aria-label="머리색 선택">
          {HAIR_COLORS.map((option) => (
            <button
              key={option.id}
              type="button"
              title={option.label}
              aria-label={`머리색: ${option.label}`}
              aria-pressed={appearance.hair === option.id}
              className={`appearance-swatch ${appearance.hair === option.id ? 'selected' : ''}`}
              style={{ backgroundColor: option.hex }}
              disabled={loading || saving}
              onClick={() => { void save({ ...appearance, hair: option.id }) }}
            />
          ))}
        </div>
        <span className="appearance-selected">{HAIR_COLORS.find((o) => o.id === appearance.hair)?.label}</span>
      </div>
      {(loading || saving) && <p className="appearance-hint">{loading ? '외형 불러오는 중...' : '외형 저장 중...'}</p>}
      {error && <p className="equipment-error" role="alert">{error}</p>}
    </div>
  )
}
