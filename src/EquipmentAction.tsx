import type { JobId } from './jobs/starterEquipment'

/**
 * 캐릭터의 실제 양팔을 담당하는 단일 레이어입니다.
 * 기본 팔을 배경에 남겨 두지 않고, 장착/동작 보기 시 이 팔을 회전시킵니다.
 * job=null이면 평상시 팔 자세만 표시합니다.
 */
export default function EquipmentAction({ job, skin }: { job: JobId | null; skin: string }) {
  return (
    <g className={`pixel-action ${job ? `pixel-action--${job}` : ''}`} aria-hidden="true">
      {/* 캐릭터의 왼쪽 팔: 평상시는 몸 옆, 농부는 모자 쪽으로 올라감 */}
      <g className="pixel-action__left-arm">
        <rect x="6" y="18" width="3" height="7" fill={skin} />
        {job === 'farmer' && (
          <rect x="6" y="24" width="3" height="2" fill={skin} />
        )}
      </g>
      {/* 캐릭터의 오른쪽 팔: 평상시는 몸 옆, 직업에 따라 움직임 */}
      <g className="pixel-action__right-arm">
        <rect x="23" y="18" width="3" height="7" fill={skin} />
        {job === 'mage' && (
          <g className="pixel-action__held-item">
            <rect x="26" y="9" width="2" height="16" fill="#976b4b" />
            <rect x="24" y="6" width="6" height="5" fill="#80d6ef" />
            <rect x="26" y="4" width="2" height="2" fill="#efffff" />
          </g>
        )}
        {job === 'knight' && (
          <g className="pixel-action__held-item">
            <rect x="26" y="4" width="2" height="17" fill="#b9d6e4" />
            <rect x="23" y="20" width="8" height="2" fill="#e3b759" />
          </g>
        )}
        {job === 'doctor' && (
          <g className="pixel-action__held-item">
            <rect x="25" y="12" width="2" height="10" fill="#577c8a" />
            <rect x="28" y="12" width="2" height="10" fill="#577c8a" />
            <rect x="25" y="21" width="5" height="2" fill="#577c8a" />
            <rect x="26" y="23" width="3" height="3" fill="#e6eeee" />
          </g>
        )}
      </g>
      {job === 'cleric' && (
        <g className="pixel-action__blessing" fill="#f6d976">
          <rect x="15" y="10" width="2" height="6" />
          <rect x="13" y="12" width="6" height="2" />
        </g>
      )}
      {job === 'mage' && (
        <g className="pixel-action__magic" fill="#ffe99a">
          <rect x="17" y="5" width="2" height="2" />
          <rect x="28" y="2" width="2" height="2" />
        </g>
      )}
    </g>
  )
}
