// frontend/src/components/Sidebar.tsx

interface Props {
  activeView: string
  onNavigate: (view: any) => void
  t: (key: string) => string
}

const items = [
  { id: 'search',    icon: '🔍', key: 'nav.search'    },
  { id: 'installed', icon: '📦', key: 'nav.installed'  },
  { id: 'updates',   icon: '🔄', key: 'nav.updates'    },
  { id: 'settings',  icon: '⚙️',  key: 'nav.settings'  },
]

export function Sidebar({ activeView, onNavigate, t }: Props) {
  return (
    <aside className="sidebar">
      {items.map(item => (
        <button
          key={item.id}
          className={`sidebar__item ${activeView === item.id ? 'sidebar__item--active' : ''}`}
          onClick={() => onNavigate(item.id)}
        >
          <span className="sidebar__icon">{item.icon}</span>
          <span>{t(item.key)}</span>
        </button>
      ))}
    </aside>
  )
}
