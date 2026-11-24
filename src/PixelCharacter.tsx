import './PixelCharacter.css'
import { DEFAULT_APPEARANCE, hairHex, skinHex, type CharacterAppearance } from './appearance/palette'

// 각 장비는 32x32 픽셀 좌표계에 별도 레이어로 그립니다.
// 이후 상점과 인벤토리의 장착 상태를 이 props에 연결할 예정입니다.
export type CharacterEquipment = {
  hat?: 'none' | 'wizard' | 'crown' | 'straw' | 'helmet' | 'hood'
  outfit?: 'basic' | 'cape' | 'forest' | 'overalls' | 'mageRobe' | 'armor' | 'doctorCoat' | 'clericRobe'
  accessory?: 'none' | 'star' | 'moon' | 'medicalBag' | 'holySymbol'
}

type PixelCharacterProps = {
  equipment?: CharacterEquipment
  appearance?: CharacterAppearance
}

export default function PixelCharacter({ equipment = {}, appearance = DEFAULT_APPEARANCE }: PixelCharacterProps) {
  const skin = skinHex(appearance.skin)
  const hair = hairHex(appearance.hair)
  const { hat = 'none', outfit = 'basic', accessory = 'none' } = equipment

  return (
    <div className="pixel-character" role="img" aria-label="픽셀 아트 모험가 캐릭터">
      <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        {/* 그림자 */}
        <rect x="7" y="29" width="18" height="2" fill="#443660" opacity="0.4" />
        {/* 다리와 신발 */}
        <rect x="10" y="24" width="5" height="5" fill="#283b67" />
        <rect x="17" y="24" width="5" height="5" fill="#283b67" />
        <rect x="8" y="28" width="8" height="2" fill="#25243e" />
        <rect x="17" y="28" width="8" height="2" fill="#25243e" />
        {/* 몸통과 팔 */}
        <rect x="9" y="17" width="14" height="9" fill="#5977bd" />
        <rect x="6" y="18" width="3" height="7" fill={skin} />
        <rect x="23" y="18" width="3" height="7" fill={skin} />
        <rect x="9" y="24" width="14" height="2" fill="#3e4f82" />
        <rect x="15" y="24" width="3" height="2" fill="#f2cc68" />
        {/* 머리카락, 얼굴 */}
        <rect x="10" y="4" width="12" height="3" fill={hair} />
        <rect x="8" y="7" width="16" height="8" fill={hair} />
        <rect x="9" y="9" width="14" height="8" fill={skin} />
        <rect x="8" y="9" width="3" height="6" fill={hair} />
        <rect x="21" y="9" width="3" height="5" fill={hair} />
        <rect x="12" y="12" width="2" height="2" fill="#342d4f" />
        <rect x="19" y="12" width="2" height="2" fill="#342d4f" />
        <rect x="15" y="15" width="3" height="1" fill="#ae6872" />
        <rect x="14" y="17" width="4" height="2" fill={skin} />
        {/* 의상 레이어 */}
        {outfit === 'cape' && (
          <g>
            <rect x="7" y="18" width="3" height="9" fill="#b85f90" />
            <rect x="22" y="18" width="3" height="9" fill="#b85f90" />
            <rect x="10" y="18" width="12" height="2" fill="#db83ac" />
          </g>
        )}
        {outfit === 'forest' && (
          <g>
            <rect x="7" y="18" width="3" height="10" fill="#34794c" />
            <rect x="22" y="18" width="3" height="10" fill="#34794c" />
            <rect x="10" y="18" width="12" height="3" fill="#69aa64" />
            <rect x="15" y="18" width="3" height="3" fill="#d9ce76" />
          </g>
        )}
        {/* 직업별 의상 레이어 */}
        {outfit === 'overalls' && <g><rect x="9" y="18" width="14" height="8" fill="#688b51"/><rect x="11" y="18" width="3" height="7" fill="#cf9a49"/><rect x="18" y="18" width="3" height="7" fill="#cf9a49"/><rect x="14" y="23" width="4" height="2" fill="#ebd083"/></g>}
        {outfit === 'mageRobe' && <g><rect x="9" y="18" width="14" height="10" fill="#6858ab"/><rect x="7" y="18" width="3" height="9" fill="#8f74c4"/><rect x="22" y="18" width="3" height="9" fill="#8f74c4"/><rect x="15" y="19" width="2" height="7" fill="#e8ce72"/></g>}
        {outfit === 'armor' && <g><rect x="9" y="17" width="14" height="10" fill="#a4b6c9"/><rect x="7" y="18" width="4" height="5" fill="#c2d2df"/><rect x="21" y="18" width="4" height="5" fill="#c2d2df"/><rect x="14" y="19" width="4" height="5" fill="#647d9c"/></g>}
        {outfit === 'doctorCoat' && <g><rect x="8" y="18" width="16" height="10" fill="#f1f6f8"/><rect x="13" y="18" width="6" height="9" fill="#7eb9c5"/><rect x="15" y="19" width="2" height="8" fill="#f9fcff"/><rect x="9" y="24" width="3" height="2" fill="#a3b8c7"/><rect x="20" y="24" width="3" height="2" fill="#a3b8c7"/></g>}
        {outfit === 'clericRobe' && <g><rect x="8" y="18" width="16" height="11" fill="#faf0d7"/><rect x="13" y="18" width="6" height="10" fill="#d6b864"/><rect x="15" y="20" width="2" height="7" fill="#fff9ec"/></g>}
        {/* 모자 레이어 */}
        {hat === 'wizard' && (
          <g>
            <rect x="13" y="0" width="6" height="3" fill="#7564ce" />
            <rect x="11" y="3" width="10" height="3" fill="#7564ce" />
            <rect x="9" y="6" width="14" height="3" fill="#5944aa" />
            <rect x="6" y="9" width="20" height="2" fill="#4b398d" />
            <rect x="15" y="5" width="3" height="2" fill="#f5d269" />
          </g>
        )}
        {hat === 'crown' && (
          <g>
            <rect x="9" y="5" width="14" height="5" fill="#e7b83c" />
            <rect x="9" y="2" width="3" height="4" fill="#f7d665" />
            <rect x="15" y="1" width="3" height="5" fill="#f7d665" />
            <rect x="20" y="2" width="3" height="4" fill="#f7d665" />
            <rect x="15" y="7" width="3" height="2" fill="#bf4886" />
          </g>
        )}
        {/* 직업별 모자 레이어 */}
        {hat === 'straw' && <g><rect x="9" y="5" width="14" height="5" fill="#dcb764"/><rect x="5" y="9" width="22" height="2" fill="#bf9142"/><rect x="9" y="7" width="14" height="2" fill="#735632"/></g>}
        {hat === 'helmet' && <g><rect x="8" y="5" width="16" height="8" fill="#aebfd0"/><rect x="14" y="3" width="4" height="5" fill="#d7e2e8"/><rect x="8" y="12" width="3" height="4" fill="#768aa0"/><rect x="21" y="12" width="3" height="4" fill="#768aa0"/></g>}
        {hat === 'hood' && <g><rect x="10" y="3" width="12" height="3" fill="#f8eacc"/><rect x="8" y="6" width="16" height="5" fill="#f8eacc"/><rect x="7" y="10" width="3" height="7" fill="#e1c482"/><rect x="22" y="10" width="3" height="7" fill="#e1c482"/></g>}
        {/* 액세서리 레이어 */}
        {accessory === 'medicalBag' && <g><rect x="24" y="21" width="7" height="6" fill="#93665a"/><rect x="26" y="19" width="3" height="3" fill="#cba99b"/><rect x="27" y="22" width="2" height="4" fill="#fff3ef"/><rect x="25" y="23" width="5" height="2" fill="#fff3ef"/></g>}
        {accessory === 'holySymbol' && <g><rect x="26" y="15" width="2" height="9" fill="#f2d071"/><rect x="23" y="18" width="8" height="2" fill="#f2d071"/></g>}
        {accessory === 'star' && (
          <g fill="#ffe582">
            <rect x="25" y="13" width="2" height="7" />
            <rect x="22" y="15" width="8" height="2" />
            <rect x="24" y="14" width="4" height="5" fill="#f5c44e" />
          </g>
        )}
        {accessory === 'moon' && (
          <g>
            <rect x="26" y="12" width="3" height="2" fill="#8cbbff" />
            <rect x="24" y="14" width="3" height="6" fill="#8cbbff" />
            <rect x="26" y="18" width="4" height="2" fill="#8cbbff" />
            <rect x="28" y="14" width="2" height="4" fill="#8cbbff" />
          </g>
        )}
      </svg>
    </div>
  )
}
