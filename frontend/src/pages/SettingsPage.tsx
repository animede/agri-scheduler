import { useState } from 'react'
import type { ClimateZone } from '../api/types'
import { CLIMATE_ZONE_LABELS, getClimateZone, setClimateZone } from '../utils/settings'
import './SettingsPage.css'

const ZONES: ClimateZone[] = ['cold', 'temperate', 'warm']

const ZONE_DESCRIPTIONS: Record<ClimateZone, string> = {
  cold: '寒地(例: 北海道・東北・信越など。種蒔き・植え付けが遅めで、収穫期間も短い)',
  temperate: '温暖地(例: 関東・東海・関西など。もっとも一般的な標準地域)',
  warm: '暖地(例: 九州・四国・沖縄など。種蒔き・植え付けが早めで、収穫期間も長い)',
}

function SettingsPage() {
  const [zone, setZone] = useState<ClimateZone>(getClimateZone())
  const [saved, setSaved] = useState(false)

  function handleSave() {
    setClimateZone(zone)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  return (
    <main className="settings-page">
      <h1>設定</h1>
      <p className="muted">
        あなたの地域の気候帯を設定してください。品種一覧・詳細で該当地域の栽培暦が優先的に見やすく表示されます。
        この設定はサーバーには保存されず、このブラウザ内(localStorage)にのみ保存されます。
      </p>

      <fieldset className="entity-form climate-zone-fieldset">
        <legend>気候帯</legend>
        {ZONES.map((z) => (
          <label key={z} className="radio-label climate-zone-option">
            <input
              type="radio"
              name="climate-zone"
              checked={zone === z}
              onChange={() => setZone(z)}
            />
            <span>
              <strong>{CLIMATE_ZONE_LABELS[z]}</strong>
              <span className="muted"> — {ZONE_DESCRIPTIONS[z]}</span>
            </span>
          </label>
        ))}

        <div className="form-actions">
          <button type="button" onClick={handleSave}>
            保存
          </button>
          {saved && <span className="settings-saved-message">保存しました</span>}
        </div>
      </fieldset>
    </main>
  )
}

export default SettingsPage
