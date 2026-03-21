import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, ChevronRight, MapPin, Clock, Loader2 } from 'lucide-react'
import { fetchRaces } from '../services/api'

const DATE_LABELS = ['昨日', '今日', '明日']

export default function RaceListPage() {
  const [venuesByDate, setVenuesByDate] = useState({})  // { date: venues } キャッシュ
  const [dates, setDates] = useState([])
  const [loading, setLoading] = useState(true)
  const [tabLoading, setTabLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeDate, setActiveDate] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchRaces()
      .then(res => {
        const allData = res.dates || {}
        const dateKeys = Object.keys(allData)
        setDates(dateKeys)
        setVenuesByDate(allData)
        // 今日（index 1）をデフォルトに
        setActiveDate(dateKeys[1] || dateKeys[0])
      })
      .catch(() => setError('レース情報の取得に失敗しました。バックエンドが起動しているか確認してください。'))
      .finally(() => setLoading(false))
  }, [])

  const handleDateChange = (d) => {
    if (d === activeDate) return
    setActiveDate(d)
    localStorage.setItem('lastDate', d)
    if (venuesByDate[d] !== undefined) return  // キャッシュあり → 即切替
    // 未キャッシュ → 個別取得
    setTabLoading(true)
    fetchRaces(d)
      .then(res => {
        const venues = Object.values(res.dates || {})[0] || {}
        setVenuesByDate(prev => ({ ...prev, [d]: venues }))
      })
      .catch(() => {})
      .finally(() => setTabLoading(false))
  }

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr.length !== 8) return dateStr
    const y = dateStr.slice(0, 4)
    const m = parseInt(dateStr.slice(4, 6))
    const d = parseInt(dateStr.slice(6, 8))
    const date = new Date(y, m - 1, d)
    const weekdays = ['日', '月', '火', '水', '木', '金', '土']
    return `${m}/${d}（${weekdays[date.getDay()]}）`
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400, flexDirection: 'column', gap: 14 }}>
      <Loader2 size={36} style={{ animation: 'spin 1s linear infinite', color: 'var(--gold)' }} />
      <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>レース情報を取得中...</div>
    </div>
  )

  if (error) return (
    <div style={{ maxWidth: 600, margin: '60px auto', padding: '0 24px' }}>
      <div className="card" style={{ padding: 30, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🏇</div>
        <div style={{ color: '#f87171', fontSize: 14, marginBottom: 12 }}>{error}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          バックエンド起動: <code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4 }}>cd backend && uvicorn main:app --reload</code>
        </div>
      </div>
    </div>
  )

  return (
    <div className="page-container">
      {/* ページタイトル */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, color: 'var(--gold)', marginBottom: 6 }}>
          開催レース
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>昨日・今日・明日のJRA全開催レース一覧</p>
      </div>

      {/* 日付タブ */}
      {dates.length > 1 && (
        <div className="date-tabs" style={{ gap: 8, marginBottom: 24 }}>
          {dates.map((d, i) => (
            <button
              key={d}
              onClick={() => handleDateChange(d)}
              style={{
                padding: '8px 24px', borderRadius: 10, border: '1px solid',
                borderColor: activeDate === d ? 'var(--gold)' : 'var(--border)',
                background: activeDate === d ? 'rgba(212,175,55,0.1)' : 'var(--bg-card)',
                color: activeDate === d ? 'var(--gold)' : 'var(--text-secondary)',
                fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.18s',
              }}
            >
              {DATE_LABELS[i] ?? formatDate(d)} {formatDate(d)}
            </button>
          ))}
        </div>
      )}

      {/* 開催場別レース */}
      {tabLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200, gap: 12 }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--gold)' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>取得中...</span>
        </div>
      ) : activeDate && venuesByDate[activeDate] && Object.keys(venuesByDate[activeDate]).length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
          {Object.entries(venuesByDate[activeDate]).map(([venueName, races]) => (
            <div key={venueName} className="card animate-in" style={{ padding: 0, overflow: 'hidden' }}>
              {/* 開催場ヘッダー */}
              {(() => {
                const turfCond = races.find(r => r.surface === '芝')?.track_condition || ''
                const dirtCond = races.find(r => r.surface === 'ダート')?.track_condition || ''
                return (
                  <div style={{
                    padding: '12px 18px',
                    background: 'linear-gradient(135deg, rgba(26,122,26,0.3), rgba(34,197,94,0.1))',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <MapPin size={14} color="var(--green-bright)" />
                    <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--green-bright)' }}>{venueName}</span>
                    <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', alignItems: 'center' }}>
                      {turfCond && <span className="badge badge-green" style={{ fontSize: 10 }}>芝:{turfCond}</span>}
                      {dirtCond && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(180,130,50,0.2)', color: '#c8a060', border: '1px solid rgba(180,130,50,0.3)' }}>ダ:{dirtCond}</span>}
                      <span className="badge badge-green">{races.length}R</span>
                    </div>
                  </div>
                )
              })()}

              {/* レース一覧 */}
              <div style={{ padding: '8px 0' }}>
                {races.map((race) => (
                  <div
                    key={race.race_id}
                    onClick={() => navigate(`/race/${race.race_id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', padding: '10px 18px',
                      cursor: 'pointer', transition: 'background 0.15s', gap: 12,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: 'var(--bg-secondary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: 14, color: 'var(--text-primary)',
                      flexShrink: 0,
                    }}>
                      {race.race_no}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                        {race.race_name || `第${race.race_no}レース`}
                      </div>
                      {race.start_time && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                          <Clock size={10} /> {race.start_time}
                        </div>
                      )}
                    </div>
                    <ChevronRight size={14} color="var(--text-muted)" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏁</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>この日の開催はありません</div>
        </div>
      )}
    </div>
  )
}
