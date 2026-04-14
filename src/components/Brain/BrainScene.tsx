import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { Suspense } from 'react'
import BrainMesh from './BrainMesh'
import NeuralPathways from './NeuralPathways'

export default function BrainScene() {
  return (
    <Canvas
      camera={{ position: [0, 0.3, 4.5], fov: 42 }}
      style={{ position: 'fixed', inset: 0, background: 'transparent' }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
    >
      {/* Lighting */}
      <ambientLight intensity={0.15} />
      <pointLight position={[-3, 2, 3]} intensity={0.4} color="#3B82F6" />
      <pointLight position={[3, -1, 2]} intensity={0.3} color="#10B981" />
      <pointLight position={[0, -2, -2]} intensity={0.25} color="#F59E0B" />
      <pointLight position={[0, 3, 1]} intensity={0.2} color="#ffffff" />

      <Suspense fallback={null}>
        <BrainMesh />
        <NeuralPathways />
      </Suspense>

      <OrbitControls
        enableZoom={true}
        enablePan={false}
        minDistance={2.5}
        maxDistance={7}
        autoRotate={false}
        rotateSpeed={0.6}
        zoomSpeed={0.5}
        touches={{ ONE: 2, TWO: 1 }}
      />

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.15}
          luminanceSmoothing={0.9}
          intensity={1.8}
          radius={0.7}
        />
      </EffectComposer>
    </Canvas>
  )
}
