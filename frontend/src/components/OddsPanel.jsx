import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, TrendingUp } from 'lucide-react'
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

const JS_ONLY_TABS = ['quinella', 'exacta', 'wide', 'trio', 'trifecta']

export default function OddsPanel({ raceId }) {
  const [odds, setOdds] = useState({})
  const [activeTab, setActiveTab] = useState('win')
  const [loading, setLoading] = useState(false)
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

  const currentOdds = odds[activeTab] || []

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
        {Object.entries(ODDS_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: '4px 12px', borderRadius: 6, border: '1px solid',
              borderColor: activeTab === key ? 'var(--green-bright)' : 'var(--border)',
              background: activeTab === key ? 'rgba(34,197,94,0.1)' : 'transparent',
              color: activeTab === key ? 'var(--green-bright)' : 'var(--text-muted)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* オッズ表 */}
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {currentOdds.length > 0 ? (
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
                  <span style={{
                    fontWeight: 700,
                    color: isLow ? 'var(--gold)' : 'var(--text-primary)',
                  }}>
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
        ) : JS_ONLY_TABS.includes(activeTab) ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
            取得不可（リアルタイムデータ非対応）
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
