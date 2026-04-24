import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Sky, Environment, KeyboardControls } from '@react-three/drei';
import { Suspense, useState } from 'react';
import { Apartment } from './Apartment';
import { Surroundings } from './Surroundings';
import { useStore } from './store';
import { Settings, User, Eye, EyeOff, Layout, Box } from 'lucide-react';
import './App.css';

function App() {
  const { unit, setUnit, viewMode, toggleViewMode, furnitureEnabled, toggleFurniture, wallColor, setWallColor } = useStore();
  const [showSettings, setShowSettings] = useState(true);

  return (
    <div className="app-container">
      <Canvas shadows dpr={[1, 2]}>
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={viewMode === 'top' ? [20, 20, 20] : [0, 1.6, 5]} fov={50} />
          <OrbitControls makeDefault enablePan={viewMode === 'top'} enableZoom={viewMode === 'top'} minDistance={5} maxDistance={50} />
          
          <Sky distance={450000} sunPosition={[0, 1, 0.5]} inclination={0} azimuth={0.25} />
          <Environment preset="city" />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1.5} castShadow />

          <Apartment isMirrored={false} />
          <Apartment isMirrored={true} />
          
          <Surroundings />
        </Suspense>
      </Canvas>

      {/* UI Overlay */}
      <div className={`ui-panel ${showSettings ? 'open' : 'closed'}`}>
        <div className="panel-header" onClick={() => setShowSettings(!showSettings)}>
          <Settings className="icon" />
          <h2>Design Hub</h2>
        </div>
        
        {showSettings && (
          <div className="panel-content">
            <div className="setting-group">
              <label><Layout className="icon-sm" /> Select Unit</label>
              <div className="button-row">
                <button className={unit === 'A' ? 'active' : ''} onClick={() => setUnit('A')}>Unit A</button>
                <button className={unit === 'B' ? 'active' : ''} onClick={() => setUnit('B')}>Unit B</button>
              </div>
            </div>

            <div className="setting-group">
              <label><Eye className="icon-sm" /> View Mode</label>
              <button 
                className={`full-btn ${viewMode === 'walkthrough' ? 'active' : ''}`}
                onClick={toggleViewMode}
              >
                {viewMode === 'top' ? 'Start Walkthrough' : 'Exit to Dollhouse'}
              </button>
            </div>

            <div className="setting-group">
              <label><Box className="icon-sm" /> Furniture</label>
              <button className="full-btn" onClick={toggleFurniture}>
                {furnitureEnabled ? 'Hide All' : 'Show All'}
              </button>
            </div>

            <div className="setting-group">
              <label>Wall Color</label>
              <input 
                type="color" 
                value={wallColor} 
                onChange={(e) => setWallColor(e.target.value)} 
                className="color-picker"
              />
            </div>

            <div className="ventilation-info">
              <h3>💨 Airflow Status</h3>
              <p>Main intake: <strong>North (Road)</strong></p>
              <p>Exit points: <strong>West / North</strong></p>
              <p className="warning">Note: South/East blocked by new buildings.</p>
            </div>
          </div>
        )}
      </div>

      <div className="hud">
        <p>GOKUL 116B | Interactive 3D Walkthrough</p>
      </div>
    </div>
  );
}

export default App;
