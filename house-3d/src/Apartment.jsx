import { Box, Plane } from '@react-three/drei';
import { useStore } from './store';

const Wall = ({ position, args, color = "#f0f0f0" }) => (
  <Box position={position} args={args}>
    <meshStandardMaterial color={color} />
  </Box>
);

const Room = ({ name, position, size, wallColor }) => {
  const [w, h, d] = size;
  return (
    <group position={position}>
      {/* Floor */}
      <Plane rotation={[-Math.PI / 2, 0, 0]} args={[w, d]}>
        <meshStandardMaterial color="#ddd" />
      </Plane>
      {/* Label would go here */}
    </group>
  );
};

export const Apartment = ({ isMirrored = false }) => {
  const wallColor = useStore((state) => state.wallColor);
  
  // Scale factor: 1 unit = 0.3m (roughly 1 foot)
  const scale = 0.3;

  return (
    <group rotation={[0, isMirrored ? Math.PI : 0, 0]} scale={isMirrored ? [-1, 1, 1] : [1, 1, 1]}>
      {/* Simplified Wall Layout based on GOKUL 116B */}
      {/* Outer Perimeter */}
      <Wall position={[0, 1.25, -6]} args={[12, 2.5, 0.2]} color={wallColor} /> {/* North Wall */}
      <Wall position={[0, 1.25, 6]} args={[12, 2.5, 0.2]} color={wallColor} />  {/* South Wall */}
      <Wall position={[-6, 1.25, 0]} args={[0.2, 2.5, 12]} color={wallColor} /> {/* West Wall */}
      <Wall position={[6, 1.25, 0]} args={[0.2, 2.5, 12]} color={wallColor} />  {/* East Wall */}

      {/* Internal Divisions */}
      <Wall position={[0, 1.25, 0]} args={[0.1, 2.5, 12]} color={wallColor} />   {/* Main Corridor */}
      <Wall position={[-3, 1.25, 2]} args={[6, 2.5, 0.1]} color={wallColor} />  {/* Bedroom Partition */}
      
      {/* Flooring */}
      <Plane rotation={[-Math.PI / 2, 0, 0]} args={[12, 12]} position={[0, 0.01, 0]}>
        <meshStandardMaterial color="#f5f5f5" />
      </Plane>
    </group>
  );
};
