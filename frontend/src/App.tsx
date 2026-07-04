import { Route, Routes } from 'react-router-dom'
import NavBar from './components/NavBar'
import FieldListPage from './pages/FieldListPage'
import FieldMapPage from './pages/FieldMapPage'
import VarietyListPage from './pages/VarietyListPage'
import SettingsPage from './pages/SettingsPage'
import './App.css'

function App() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={<FieldListPage />} />
        <Route path="/fields/:fieldId" element={<FieldMapPage />} />
        <Route path="/varieties" element={<VarietyListPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </>
  )
}

export default App
