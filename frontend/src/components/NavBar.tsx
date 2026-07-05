import { NavLink } from 'react-router-dom'
import './NavBar.css'

// ヘッダー背景を彩る野菜・作物アイコン。
// 完全なランダムだとページ再描画のたびに位置がちらつくため、固定シードの疑似乱数
// (mulberry32)でモジュール読み込み時に1度だけ座標・サイズ・不透明度を決め、以降は
// 再レンダリングされても同じ配置を保つ。装飾のみなのでクリックは奪わない
// (pointer-events: none / aria-hidden)。
const VEGGIE_EMOJIS = ['🍅', '🥕', '🥬', '🌽', '🍆', '🥔', '🌱', '🍓', '🧅', '🥦']

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface DecorIcon {
  emoji: string
  top: number
  left: number
  size: number
  opacity: number
  rotate: number
}

const DECOR_ICON_COUNT = 14
const DECOR_SEED = 20260705 // 固定シード(見た目が安定する限り値そのものに意味はない)

function buildDecorIcons(): DecorIcon[] {
  const rand = mulberry32(DECOR_SEED)
  return Array.from({ length: DECOR_ICON_COUNT }, (_, i) => ({
    emoji: VEGGIE_EMOJIS[i % VEGGIE_EMOJIS.length],
    top: rand() * 100,
    left: rand() * 100,
    size: 14 + rand() * 16,
    opacity: 0.15 + rand() * 0.2,
    rotate: rand() * 40 - 20,
  }))
}

// モジュールスコープで一度だけ計算(コンポーネントの再レンダリングでは再計算しない)。
const decorIcons = buildDecorIcons()

// 全ページ共通のヘッダーナビゲーション。
function NavBar() {
  return (
    <header className="nav-bar">
      <div className="nav-bar-decor" aria-hidden="true">
        {decorIcons.map((icon, i) => (
          <span
            key={i}
            className="nav-bar-decor-icon"
            style={{
              top: `${icon.top}%`,
              left: `${icon.left}%`,
              fontSize: `${icon.size}px`,
              opacity: icon.opacity,
              transform: `rotate(${icon.rotate}deg)`,
            }}
          >
            {icon.emoji}
          </span>
        ))}
      </div>
      <span className="nav-bar-title">農場作付け管理システム</span>
      <nav className="nav-bar-links">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}>
          圃場一覧
        </NavLink>
        <NavLink
          to="/varieties"
          className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}
        >
          品種管理
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}
        >
          設定
        </NavLink>
      </nav>
    </header>
  )
}

export default NavBar
