/** 캐릭터 외형용 고정 색상 목록입니다. 저장할 때는 색상 코드가 아닌 ID를 사용합니다. */
export const SKIN_COLORS = [
  { id: 'porcelain', label: '밝은 베이지', hex: '#f8d9bb' },
  { id: 'peach', label: '복숭아빛', hex: '#f5c39b' },
  { id: 'honey', label: '꿀빛', hex: '#d9a16f' },
  { id: 'bronze', label: '구릿빛', hex: '#b97751' },
  { id: 'deep', label: '짙은 갈색', hex: '#75462f' },
] as const

export const HAIR_COLORS = [
  { id: 'violet', label: '보라색', hex: '#59416d' },
  { id: 'black', label: '검정', hex: '#302d3a' },
  { id: 'brown', label: '갈색', hex: '#805039' },
  { id: 'blonde', label: '금발', hex: '#e6b95b' },
  { id: 'silver', label: '은발', hex: '#c5c8da' },
  { id: 'pink', label: '분홍', hex: '#d47ca1' },
  { id: 'blue', label: '푸른색', hex: '#557dc1' },
] as const

export type SkinColorId = (typeof SKIN_COLORS)[number]['id']
export type HairColorId = (typeof HAIR_COLORS)[number]['id']
export type CharacterAppearance = { skin: SkinColorId; hair: HairColorId }

export const DEFAULT_APPEARANCE: CharacterAppearance = { skin: 'peach', hair: 'violet' }

export function normalizeAppearance(data: Record<string, unknown> | undefined): CharacterAppearance {
  const skin = SKIN_COLORS.find((option) => option.id === data?.skin)?.id ?? DEFAULT_APPEARANCE.skin
  const hair = HAIR_COLORS.find((option) => option.id === data?.hair)?.id ?? DEFAULT_APPEARANCE.hair
  return { skin, hair }
}

export function skinHex(id: SkinColorId): string {
  return SKIN_COLORS.find((option) => option.id === id)?.hex ?? '#f5c39b'
}

export function hairHex(id: HairColorId): string {
  return HAIR_COLORS.find((option) => option.id === id)?.hex ?? '#59416d'
}
