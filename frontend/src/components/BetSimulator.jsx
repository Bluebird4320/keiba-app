import { useState } from 'react'
import { Calculator, Plus, X, ChevronDown } from 'lucide-react'
import { simulateBet } from '../services/api'

const BET_TYPES = [
  { key: 'win',       label: '単勝',   desc: '1頭を選ぶ',           min: 1 },
  { key: 'place',     label: '複勝',   desc: '3着以内に入る馬',      min: 1 },
  { key: 'quinella',  label: '馬連',   desc: '1・2着馬の組み合わせ', min: 2 },
  { key: 'exacta',    label: '馬単',   desc: '1・2着の順序通り',     min: 2 },
  { key: 'wide',      label: 'ワイド', desc: '2頭が3着以内',         min: 2 },
  { key: 'trio',      label: '三連複', desc: '1〜3着の組み合わせ',   min: 3 },
  { key: 'trifecta',  label: '三連単', desc: '1〜3着の着順通り',     min: 3 },
]

const FORMAT_OPTIONS = ['通常', 'ボックス', 'マルチ']

export default function BetSimulator({ horses = [], oddsData = {} }) {
  const [betType, setBetType] = useState('trio')
  const [selected, setSelected] = useState([])
  const [amount, setAmount] = useState(100)
  const [format, setFormat] = useState('通常')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const currentBetDef = BET_TYPES.find(b => b.key === betType)

  const toggleHorse = (no) => {
    setSelected(prev =>
      prev.includes(no) ? prev.filter(x => x !== no) : [...prev, no]
    )
    setResult(null)
  }

  const handleSimulate = async () => {
    if (selected.length < currentBetDef.min) {
      setError(`${currentBetDef.label}は${currentBetDef.min}頭以上選んでください`)
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await simulateBet({
        bet_type: betType,
        horses: selected,
        amount_per_bet: amount,
        box: format === 'ボックス',
        multi: format === 'マルチ',
      })
      setResult(res)
    } catch (e) {
      setError('シミュレーションに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // 推定払い戻し計算（単勝オッズから）
  const calcPayout = (combo, type) => {
    if (type === 'win' && oddsData?.win) {
      const odds = oddsData.win.find(o => o.combination === combo)
      if (odds?.odds && amount) return Math.floor(amount * parseFloat(odds.odds))
    }
    return null
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="section-title" style={{ marginBottom: 16, fontSize: 18 }}>
        <Calculator size={18} />
        買い目シミュレーター
      </div>

      {/* 勝式選択 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>勝式</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {BET_TYPES.map(b => (
            <button
              key={b.key}
              onClick={() => { setBetType(b.key); setSelected([]); setResult(null) }}
              style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                background: betType === b.key ? 'linear-gradient(135deg,#1a7a1a,#22c55e)' : 'var(--bg-secondary)',
                color: betType === b.key ? '#fff' : 'var(--text-secondary)',
                boxShadow: betType === b.key ? '0 2px 8px rgba(34,197,94,0.3)' : 'none',
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{currentBetDef?.desc}</div>
      </div>

      {/* 購入形式 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>購入形式</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {FORMAT_OPTIONS.map(f => (
            <button
              key={f}
              onClick={() => { setFormat(f); setResult(null) }}
              style={{
                padding: '5px 12px', borderRadius: 6, border: '1px solid',
                borderColor: format === f ? 'var(--gold)' : 'var(--border)',
                background: format === f ? 'rgba(212,175,55,0.1)' : 'transparent',
                color: format === f ? 'var(--gold)' : 'var(--text-secondary)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* 馬選択 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>
          出走馬選択（{selected.length}頭選択中 / 最低{currentBetDef?.min}頭）
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {horses.map(h => {
            const isSelected = selected.includes(h.horse_no)
            return (
              <button
                key={h.horse_no}
                onClick={() => toggleHorse(h.horse_no)}
                style={{
                  padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
                  border: '1px solid',
                  borderColor: isSelected ? 'var(--green-bright)' : 'var(--border)',
                  background: isSelected ? 'rgba(34,197,94,0.15)' : 'var(--bg-secondary)',
                  color: isSelected ? 'var(--green-bright)' : 'var(--text-secondary)',
                  fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <span style={{ fontWeight: 800 }}>{h.horse_no}</span>
                <span style={{ fontSize: 11 }}>{h.horse_name}</span>
                {isSelected && <X size={10} />}
              </button>
            )
          })}
          {horses.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>レース詳細を開くと馬が表示されます</div>
          )}
        </div>
      </div>

      {/* 金額 */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>1点あたり</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {[100, 200, 500, 1000].map(v => (
            <button
              key={v}
              onClick={() => setAmount(v)}
              style={{
                padding: '4px 10px', borderRadius: 6, border: '1px solid',
                borderColor: amount === v ? 'var(--gold)' : 'var(--border)',
                background: amount === v ? 'rgba(212,175,55,0.1)' : 'transparent',
                color: amount === v ? 'var(--gold)' : 'var(--text-secondary)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {v.toLocaleString()}円
            </button>
          ))}
          <input
            type="number"
            value={amount}
            min={100}
            step={100}
            onChange={e => setAmount(Math.max(100, Math.floor(Number(e.target.value)/100)*100))}
            style={{
              width: 90, padding: '4px 8px', borderRadius: 6,
              border: '1px solid var(--border)', background: 'var(--bg-secondary)',
              color: 'var(--text-primary)', fontSize: 12, textAlign: 'right',
            }}
          />
        </div>
      </div>

      {error && (
        <div style={{ color: '#f87171', fontSize: 12, marginBottom: 10 }}>{error}</div>
      )}

      <button
        className="btn btn-primary"
        onClick={handleSimulate}
        disabled={loading}
        style={{ width: '100%', justifyContent: 'center', fontSize: 14 }}
      >
        <Calculator size={15} />
        {loading ? '計算中...' : '買い目を計算する'}
      </button>

      {/* 結果 */}
      {result && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--text-muted)' }}>点数: </span>
              <strong style={{ color: 'var(--text-primary)' }}>{result.total_bets}点</strong>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold)' }}>
              合計: {result.total_amount.toLocaleString()}円
            </div>
          </div>

          <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {result.combinations.map((c, i) => {
              const payout = calcPayout(c.combination, result.bet_type)
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 10px', borderRadius: 6, background: 'var(--bg-secondary)',
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{c.combination}</span>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{c.amount.toLocaleString()}円</span>
                    {payout && (
                      <span style={{ color: 'var(--green-bright)', fontWeight: 700 }}>
                        ≒{payout.toLocaleString()}円
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
