import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, TrendingUp, ExternalLink } from 'lucide-react'
import { fetchOdds } from '../services/api'

const ODDS_LABELS = {
  win:              '単勝',
  place:            '複勝',
  bracket_quinella: '枠連',
  quinella:         '馬連',
  exacta:           '馬単',
  wide:             'ワイド',
  trio:             '三連複',
  trifecta:         '三連単',
}

export default function OddsPanel({ raceId }) {
  const [odds, setOdds]             = useState({})
  const [activeTab, setActiveTab]   = useState('win')
  const [loading, setLoading]       = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  const loadOdds = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchOdds(raceId)
      setOdds(data.odds || {})
      setLastUpdated(new Date())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [raceId])

  useEffect(() => { loadOdds() }, [loadOdds])

  // 5分ごとに自動更新
  useEffect(() => {
    const timer = setInterval(loadOdds, 5 * 60 * 1000)
    return () => clearInterval(timer)
  }, [loadOdds])

  const currentData   = odds[activeTab]
  const isUnavailable = currentData?.unavailable === true
  const currentOdds   = Array.isArray(currentData) ? currentData : []

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="section-title" style={{ fontSize: 18 }}>
          <TrendingUp size={18} />
          オッズ
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {lastUpdated && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {lastUpdated.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 更新
            </span>
          )}
          <button
            onClick={loadOdds}
            disabled={loading}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* タブ */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
        {Object.entries(ODDS_LABELS).map(([key, label]) => {
          const tabData = odds[key]
          const tabUnavailable = tabData?.unavailable === true
          const isActive = activeTab === key
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                padding: '4px 10px', borderRadius: 6, border: '1px solid',
                borderColor: isActive
                  ? (tabUnavailable ? 'rgba(248,113,113,0.6)' : 'var(--green-bright)')
                  : 'var(--border)',
                background: isActive
                  ? (tabUnavailable ? 'rgba(248,113,113,0.08)' : 'rgba(34,197,94,0.1)')
                  : 'transparent',
                color: isActive
                  ? (tabUnavailable ? '#f87171' : 'var(--green-bright)')
                  : (tabUnavailable ? 'var(--text-muted)' : 'var(--text-secondary)'),
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              {label}
              {tabUnavailable && (
                <span style={{
                  fontSize: 9, padding: '1px 4px', borderRadius: 3,
                  background: 'rgba(248,113,113,0.15)', color: '#f87171',
                  fontWeight: 700, lineHeight: 1.4,
                }}>
                  非対応
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* オッズ表 / 非対応メッセージ */}
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {isUnavailable ? (
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
              {ODDS_LABELS[activeTab]}のオッズはリアルタイム取得に非対応です。<br />
              JRA公式サイトでご確認ください。
            </div>
            <a
              href="https://www.jra.go.jp/keiba/odds/"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 18px', borderRadius: 8,
                background: 'linear-gradient(135deg,#1a7a1a,#22c55e)',
                color: '#fff', fontSize: 13, fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <ExternalLink size={13} />
              JRA公式オッズページへ
            </a>
          </div>
        ) : currentOdds.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {currentOdds.map((item, i) => {
              const oddsVal = parseFloat(item.odds) || 0
              const isLow = oddsVal > 0 && oddsVal <= 5
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 10px', borderRadius: 6,
                    background: isLow ? 'rgba(212,175,55,0.06)' : 'var(--bg-secondary)',
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>{item.combination}</span>
                  <span style={{ fontWeight: 700, color: isLow ? 'var(--gold)' : 'var(--text-primary)' }}>
                    {item.odds}
                  </span>
                </div>
              )
            })}
          </div>
        ) : loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 32 }} />
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
            オッズデータなし
          </div>
        )}
      </div>
    </div>
  )
}
