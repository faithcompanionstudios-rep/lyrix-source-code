import { Box, Cylinder, Plane, Text } from '@react-three/drei';

export const Surroundings = () => {
  return (
    <group>
      {/* Road - North Side */}
      <Plane rotation={[-Math.PI / 2, 0, 0]} args={[50, 10]} position={[0, -0.1, -12]}>
        <meshStandardMaterial color="#333" />
      </Plane>
      <Text position={[0, 0.1, -12]} rotation={[-Math.PI / 2, 0, 0]} fontSize={1} color="white">
        MAIN ROAD
      </Text>

      {/* High Tension Pole - West Side (13m away) */}
      <group position={[-19, 0, 0]}> {/* 6m (house half) + 13m = 19m */}
        <Cylinder args={[0.2, 0.5, 15]} position={[0, 7.5, 0]}>
          <meshStandardMaterial color="#555" metalness={0.8} roughness={0.2} />
        </Cylinder>
        {/* Cross arms */}
        <Box args={[6, 0.2, 0.2]} position={[0, 12, 0]}>
          <meshStandardMaterial color="#555" />
        </Box>
        <Box args={[6, 0.2, 0.2]} position={[0, 14, 0]}>
          <meshStandardMaterial color="#555" />
        </Box>
        <Text position={[0, 1, 0]} rotation={[0, Math.PI / 2, 0]} fontSize={0.5} color="yellow">
          HT POLE (13m DISTANCE)
        </Text>
      </group>

      {/* Neighbor Buildings - Blocked Sides */}
      {/* South */}
      <Box args={[30, 20, 10]} position={[0, 10, 15]}>
        <meshStandardMaterial color="#222" opacity={0.5} transparent />
      </Box>
      <Text position={[0, 5, 10]} rotation={[0, Math.PI, 0]} fontSize={1} color="#666">
        SOUTH APARTMENT (BLOCKED)
      </Text>

      {/* East */}
      <Box args={[10, 20, 30]} position={[15, 10, 0]}>
        <meshStandardMaterial color="#222" opacity={0.5} transparent />
      </Box>
      <Text position={[10, 5, 0]} rotation={[0, -Math.PI / 2, 0]} fontSize={1} color="#666">
        EAST APARTMENT (BLOCKED)
      </Text>
      
      {/* Ground */}
      <Plane rotation={[-Math.PI / 2, 0, 0]} args={[100, 100]} position={[0, -0.2, 0]}>
        <meshStandardMaterial color="#1a1a1a" />
      </Plane>
    </group>
  );
};
