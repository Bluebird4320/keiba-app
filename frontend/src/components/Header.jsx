import { Link, useLocation } from 'react-router-dom'
import { Trophy, TrendingUp, Calendar } from 'lucide-react'

export default function Header() {
  const loc = useLocation()
  const navItems = [
    { to: '/', label: 'レース一覧', icon: Calendar },
  ]

  return (
    <header style={{
      background: 'linear-gradient(180deg, #0d160d 0%, rgba(10,15,10,0.95) 100%)',
      borderBottom: '1px solid #1e3a1e',
      backdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        {/* ロゴ */}
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'linear-gradient(135deg, #1a7a1a, #22c55e)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(34,197,94,0.3)',
          }}>
            <Trophy size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: '#d4af37', lineHeight: 1.1 }}>
              競馬 AI 予想
            </div>
            <div style={{ fontSize: 10, color: '#556655', letterSpacing: '0.1em' }}>
              KEIBA AI FORECAST
            </div>
          </div>
        </Link>

        {/* ナビ */}
        <nav style={{ display: 'flex', gap: 8 }}>
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 16px', borderRadius: 8,
              fontSize: 13, fontWeight: 600, textDecoration: 'none',
              color: loc.pathname === to ? '#22c55e' : '#9ab89a',
              background: loc.pathname === to ? 'rgba(34,197,94,0.1)' : 'transparent',
              transition: 'all 0.18s',
            }}>
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </nav>

        {/* ライブバッジ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#22c55e' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse-gold 2s infinite' }} />
          <TrendingUp size={14} />
          LIVE ODDS
        </div>
      </div>
    </header>
  )
}
