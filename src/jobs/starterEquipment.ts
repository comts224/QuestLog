import type { CharacterEquipment } from '../PixelCharacter'

export const JOBS = [
  { id: 'farmer', name: '농부', emoji: '🌾', starter: '밀짚모자 · 작업복' },
  { id: 'mage', name: '마법사', emoji: '🧙', starter: '마법사 모자 · 로브' },
  { id: 'knight', name: '기사', emoji: '⚔️', starter: '투구 · 갑옷' },
  { id: 'doctor', name: '의사', emoji: '🩺', starter: '의사 가운 · 의료가방' },
  { id: 'cleric', name: '성직자', emoji: '✨', starter: '성직자 로브 · 성표' },
] as const
export type JobId = typeof JOBS[number]['id']
export function parseJobId(value: unknown): JobId | null {
  return JOBS.find(job => job.id === value)?.id ?? null
}
export const STARTER_GEAR: Record<JobId, Required<CharacterEquipment>> = {
  farmer: { hat: 'straw', outfit: 'overalls', accessory: 'none' },
  mage: { hat: 'wizard', outfit: 'mageRobe', accessory: 'none' },
  knight: { hat: 'helmet', outfit: 'armor', accessory: 'none' },
  doctor: { hat: 'none', outfit: 'doctorCoat', accessory: 'medicalBag' },
  cleric: { hat: 'hood', outfit: 'clericRobe', accessory: 'holySymbol' },
}
export const JOB_GEAR_CHOICES: Record<JobId, { slot: 'hat' | 'outfit' | 'accessory', value: string, label: string }[]> = {
  farmer: [{ slot: 'hat', value: 'straw', label: '밀짚모자 (농부)' }, { slot: 'outfit', value: 'overalls', label: '작업복 (농부)' }],
  mage: [{ slot: 'hat', value: 'wizard', label: '마법사 모자 (마법사)' }, { slot: 'outfit', value: 'mageRobe', label: '마법사 로브 (마법사)' }],
  knight: [{ slot: 'hat', value: 'helmet', label: '기사 투구 (기사)' }, { slot: 'outfit', value: 'armor', label: '기사 갑옷 (기사)' }],
  doctor: [{ slot: 'outfit', value: 'doctorCoat', label: '의사 가운 (의사)' }, { slot: 'accessory', value: 'medicalBag', label: '의료가방 (의사)' }],
  cleric: [{ slot: 'hat', value: 'hood', label: '성직자 두건 (성직자)' }, { slot: 'outfit', value: 'clericRobe', label: '성직자 로브 (성직자)' }, { slot: 'accessory', value: 'holySymbol', label: '성표 (성직자)' }],
}
export function isJobStarter(job: JobId | null, slot: 'hat' | 'outfit' | 'accessory', itemId: string) {
  return job != null && JOB_GEAR_CHOICES[job].some(item => item.slot === slot && item.value === itemId)
}
