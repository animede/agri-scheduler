import { NavLink } from 'react-router-dom'
import './NavBar.css'

// 全ページ共通のヘッダーナビゲーション。
function NavBar() {
  return (
    <header className="nav-bar">
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
