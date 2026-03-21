import { useState, useEffect } from 'react'
import { Calculator, X, BookmarkPlus, Trash2 } from 'lucide-react'
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
const BET_TYPE_LABELS = Object.fromEntries(BET_TYPES.map(b => [b.key, b.label]))

export default function BetSimulator({ horses = [], oddsData = {}, raceName = '' }) {
  const [view, setView]         = useState('sim')   // 'sim' | 'saved'
  const [betType, setBetType]   = useState('trio')
  const [selected, setSelected] = useState([])
  const [amount, setAmount]     = useState(100)
  const [format, setFormat]     = useState('通常')
  const [result, setResult]     = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  // Feature 4: even distribution mode
  const [evenMode, setEvenMode]       = useState(false)
  const [totalBudget, setTotalBudget] = useState(1000)

  // Feature 3: saved bets (localStorage)
  const [savedBets, setSavedBets] = useState(() => {
    try { return JSON.parse(localStorage.getItem('savedBets') || '[]') } catch { return [] }
  })

  useEffect(() => {
    localStorage.setItem('savedBets', JSON.stringify(savedBets))
  }, [savedBets])

  const currentBetDef = BET_TYPES.find(b => b.key === betType)

  const toggleHorse = (no) => {
    setSelected(prev => prev.includes(no) ? prev.filter(x => x !== no) : [...prev, no])
    setResult(null)
  }

  // Feature 5: synthetic odds = 1 / Σ(1/Oi) — only for win bets with known odds
  const calcSyntheticOdds = (combinations) => {
    if (!combinations?.length || !oddsData?.win) return null
    const inverseSum = combinations.reduce((sum, c) => {
      const entry = oddsData.win.find(o => o.combination === c.combination)
      const o = entry ? parseFloat(entry.odds) : 0
      return o > 0 ? sum + 1 / o : sum
    }, 0)
    return inverseSum > 0 ? (1 / inverseSum).toFixed(1) : null
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
      // Feature 4: redistribute totalBudget evenly across combinations
      if (evenMode && res.total_bets > 0) {
        const amountPerBet = Math.max(100, Math.floor(totalBudget / res.total_bets / 100) * 100)
        setResult({
          ...res,
          combinations: res.combinations.map(c => ({ ...c, amount: amountPerBet })),
          total_amount: amountPerBet * res.total_bets,
        })
      } else {
        setResult(res)
      }
    } catch {
      setError('シミュレーションに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveBet = () => {
    if (!result) return
    setSavedBets(prev => [{
      id: Date.now(),
      raceName,
      betType: result.bet_type,
      format,
      combinations: result.combinations,
      totalAmount: result.total_amount,
      totalBets: result.total_bets,
      savedAt: new Date().toISOString(),
    }, ...prev])
  }

  const handleDeleteBet = (id) => setSavedBets(prev => prev.filter(b => b.id !== id))

  const syntheticOdds = result?.bet_type === 'win' ? calcSyntheticOdds(result.combinations) : null

  const calcPayout = (combo, type, betAmount) => {
    if (type === 'win' && oddsData?.win) {
      const odds = oddsData.win.find(o => o.combination === combo)
      if (odds?.odds && betAmount) return Math.floor(betAmount * parseFloat(odds.odds))
    }
    return null
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      {/* View tabs: シミュレーター / 保存済み */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {[
          { key: 'sim',   label: 'シミュレーター' },
          { key: 'saved', label: `保存済み${savedBets.length > 0 ? ` (${savedBets.length})` : ''}` },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setView(key)} style={{
            padding: '8px 18px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            color: view === key ? 'var(--green-bright)' : 'var(--text-muted)',
            borderBottom: view === key ? '2px solid var(--green-bright)' : '2px solid transparent',
            marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {/* ===== 保存済みビュー ===== */}
      {view === 'saved' ? (
        savedBets.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            保存済みの買い目がありません
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {savedBets.map(bet => (
              <div key={bet.id} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 14, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {bet.raceName || 'レース'}
                    </span>
                    <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                      {BET_TYPE_LABELS[bet.betType] || bet.betType} / {bet.format}
                    </span>
                  </div>
                  <button onClick={() => handleDeleteBet(bet.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: 4, borderRadius: 4,
                  }}>
                    <Trash2 size={13} />
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.6 }}>
                  {bet.combinations.slice(0, 6).map(c => c.combination).join(' / ')}
                  {bet.combinations.length > 6 && ` … (+${bet.combinations.length - 6}点)`}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700 }}>
                    {bet.totalBets}点 / {bet.totalAmount.toLocaleString()}円
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {new Date(bet.savedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (

        /* ===== シミュレータービュー ===== */
        <>
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
                    className="bet-horse-btn"
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

          {/* Feature 4: 均等分散トグル */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: evenMode ? 10 : 0 }}>
              <button
                onClick={() => { setEvenMode(v => !v); setResult(null) }}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: '1px solid',
                  borderColor: evenMode ? 'var(--gold)' : 'var(--border)',
                  background: evenMode ? 'rgba(212,175,55,0.12)' : 'transparent',
                  color: evenMode ? 'var(--gold)' : 'var(--text-muted)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                均等分散モード {evenMode ? 'ON' : 'OFF'}
              </button>
              {evenMode && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  総予算を組合せ数で均等割り
                </span>
              )}
            </div>
            {evenMode ? (
              /* 総予算入力 */
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>総予算</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[500, 1000, 2000, 5000].map(v => (
                    <button
                      key={v}
                      onClick={() => setTotalBudget(v)}
                      style={{
                        padding: '4px 10px', borderRadius: 6, border: '1px solid',
                        borderColor: totalBudget === v ? 'var(--gold)' : 'var(--border)',
                        background: totalBudget === v ? 'rgba(212,175,55,0.1)' : 'transparent',
                        color: totalBudget === v ? 'var(--gold)' : 'var(--text-secondary)',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {v.toLocaleString()}円
                    </button>
                  ))}
                  <input
                    type="number"
                    value={totalBudget}
                    min={100}
                    step={100}
                    onChange={e => setTotalBudget(Math.max(100, Math.floor(Number(e.target.value) / 100) * 100))}
                    style={{
                      width: 90, padding: '4px 8px', borderRadius: 6,
                      border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)', fontSize: 12, textAlign: 'right',
                    }}
                  />
                </div>
              </div>
            ) : (
              /* 通常モード: 1点あたり金額 */
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>1点あたり</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
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
                    onChange={e => setAmount(Math.max(100, Math.floor(Number(e.target.value) / 100) * 100))}
                    style={{
                      width: 90, padding: '4px 8px', borderRadius: 6,
                      border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)', fontSize: 12, textAlign: 'right',
                    }}
                  />
                </div>
              </div>
            )}
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
              {/* サマリー行 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <span>
                    <span style={{ color: 'var(--text-muted)' }}>点数: </span>
                    <strong style={{ color: 'var(--text-primary)' }}>{result.total_bets}点</strong>
                  </span>
                  {/* Feature 5: 合成オッズ */}
                  {syntheticOdds && (
                    <span>
                      <span style={{ color: 'var(--text-muted)' }}>合成オッズ: </span>
                      <strong style={{ color: 'var(--green-bright)' }}>{syntheticOdds}倍</strong>
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold)' }}>
                    合計: {result.total_amount.toLocaleString()}円
                  </div>
                  {/* Feature 3: 保存ボタン */}
                  <button
                    onClick={handleSaveBet}
                    title="買い目を保存"
                    style={{
                      padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)',
                      background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
                    }}
                  >
                    <BookmarkPlus size={13} />保存
                  </button>
                </div>
              </div>

              <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {result.combinations.map((c, i) => {
                  const payout = calcPayout(c.combination, result.bet_type, c.amount)
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
        </>
      )}
    </div>
  )
}
