import { Route, Routes } from 'react-router-dom'
import FieldListPage from './pages/FieldListPage'
import FieldMapPage from './pages/FieldMapPage'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<FieldListPage />} />
      <Route path="/fields/:fieldId" element={<FieldMapPage />} />
    </Routes>
  )
}

export default App
