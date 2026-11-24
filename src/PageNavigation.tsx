export type QuestLogPage = 'character' | 'quests' | 'shop' | 'diary'

const PAGES: { id: QuestLogPage; icon: string; label: string; subtitle: string }[] = [
  { id: 'character', icon: '🧙', label: '나의 모험가', subtitle: '성장과 장비' },
  { id: 'quests', icon: '⚔️', label: '오늘의 퀘스트', subtitle: '할 일과 다시 도전' },
  { id: 'shop', icon: '🛍️', label: '모험가 상점', subtitle: '아이템과 인벤토리' },
  { id: 'diary', icon: '📖', label: '모험 일기장', subtitle: '하루의 기록' },
]

export function getPageFromHash(): QuestLogPage {
  const hash = window.location.hash.slice(1)
  return PAGES.find((page) => page.id === hash)?.id ?? 'quests'
}

export default function PageNavigation({ activePage }: { activePage: QuestLogPage }) {
  return (
    <nav className="questlog-navigation" aria-label="QuestLog 메뉴">
      {PAGES.map((page) => (
        <a
          key={page.id}
          href={`#${page.id}`}
          className={`questlog-nav-link ${activePage === page.id ? 'is-active' : ''}`}
          aria-current={activePage === page.id ? 'page' : undefined}
        >
          <span className="questlog-nav-icon" aria-hidden="true">{page.icon}</span>
          <span className="questlog-nav-text">
            <span className="questlog-nav-label">{page.label}</span>
            <span className="questlog-nav-subtitle">{page.subtitle}</span>
          </span>
        </a>
      ))}
    </nav>
  )
}
