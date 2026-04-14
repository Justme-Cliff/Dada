import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useBrainStore } from '../../store/brainStore'

// Region positions in Three.js world space, matching BrainMesh.tsx
// Derived from FreeSurfer RAS → Three.js: X=R*0.0118, Y=S*0.0118-0.08, Z=-A*0.0118
const AUDITORY_POS = new THREE.Vector3( 0.65,  0.04,  0.24)  // right auditory cortex
const WERNICKE_POS = new THREE.Vector3(-0.61,  0.04,  0.47)  // left posterior temporal
const BROCA_POS    = new THREE.Vector3(-0.59,  0.16, -0.24)  // left inferior frontal

// Pathway definitions: [from, to, color, strengthIndex]
const PATHWAYS = [
  { from: AUDITORY_POS, to: WERNICKE_POS, color: new THREE.Color('#3B82F6'), strengthIdx: 0 },
  { from: WERNICKE_POS, to: BROCA_POS, color: new THREE.Color('#10B981'), strengthIdx: 1 },
  { from: AUDITORY_POS, to: BROCA_POS, color: new THREE.Color('#F59E0B'), strengthIdx: 2 },
]

const PARTICLES_PER_PATH = 30
const TOTAL_PARTICLES = PARTICLES_PER_PATH * PATHWAYS.length

function makeCurve(from: THREE.Vector3, to: THREE.Vector3): THREE.QuadraticBezierCurve3 {
  const mid = from.clone().lerp(to, 0.5)
  // Arc upward / outward
  const normal = new THREE.Vector3().crossVectors(to.clone().sub(from), new THREE.Vector3(0, 1, 0)).normalize()
  mid.addScaledVector(normal, 0.4)
  mid.y += 0.35
  return new THREE.QuadraticBezierCurve3(from, mid, to)
}

export default function NeuralPathways() {
  const pointsRef = useRef<THREE.Points>(null)
  const lineObjects = useRef<THREE.Line[]>([])
  const groupRef = useRef<THREE.Group>(null)
  const activation = useBrainStore((s) => s.activation)
  const pathwayStrength = useBrainStore((s) => s.model.pathwayStrength)

  const smoothedActivation = useRef({ auditory: 0, wernicke: 0, broca: 0 })

  const curves = useMemo(() => PATHWAYS.map((p) => makeCurve(p.from, p.to)), [])

  // Particle progress offsets — staggered
  const offsets = useMemo(
    () =>
      Array.from({ length: TOTAL_PARTICLES }, (_, i) => (i % PARTICLES_PER_PATH) / PARTICLES_PER_PATH),
    [],
  )

  // Particle geometry
  const particleGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(TOTAL_PARTICLES * 3)
    const colors = new Float32Array(TOTAL_PARTICLES * 3)
    for (let p = 0; p < PATHWAYS.length; p++) {
      const c = PATHWAYS[p].color
      for (let i = 0; i < PARTICLES_PER_PATH; i++) {
        const idx = (p * PARTICLES_PER_PATH + i) * 3
        colors[idx] = c.r
        colors[idx + 1] = c.g
        colors[idx + 2] = c.b
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [])

  // Line geometries for each pathway
  const lineGeometries = useMemo(() =>
    curves.map((curve) => {
      const points = curve.getPoints(40)
      return new THREE.BufferGeometry().setFromPoints(points)
    }),
  [curves])

  // Create Three.Line objects imperatively to avoid JSX type collision
  useEffect(() => {
    const lines: THREE.Line[] = lineGeometries.map((geo, i) => {
      const mat = new THREE.LineBasicMaterial({
        color: PATHWAYS[i].color,
        transparent: true,
        opacity: 0.05,
      })
      return new THREE.Line(geo, mat)
    })
    lines.forEach((l) => groupRef.current?.add(l))
    lineObjects.current = lines
    return () => { lines.forEach((l) => { groupRef.current?.remove(l); l.geometry.dispose() }) }
  }, [lineGeometries])

  const time = useRef(0)

  useFrame((_, delta) => {
    time.current += delta

    const lerp = 1 - Math.pow(0.02, delta)
    smoothedActivation.current.auditory +=
      (activation.auditory - smoothedActivation.current.auditory) * lerp
    smoothedActivation.current.wernicke +=
      (activation.wernicke - smoothedActivation.current.wernicke) * lerp
    smoothedActivation.current.broca +=
      (activation.broca - smoothedActivation.current.broca) * lerp

    const actLevels = [
      (smoothedActivation.current.auditory + smoothedActivation.current.wernicke) / 2,
      (smoothedActivation.current.wernicke + smoothedActivation.current.broca) / 2,
      (smoothedActivation.current.auditory + smoothedActivation.current.broca) / 2,
    ]

    // Update particle positions
    const positions = particleGeo.attributes.position as THREE.BufferAttribute
    for (let p = 0; p < PATHWAYS.length; p++) {
      const strength = pathwayStrength[p]
      const speed = 0.08 + strength * 0.25 + actLevels[p] * 0.35
      for (let i = 0; i < PARTICLES_PER_PATH; i++) {
        const idx = p * PARTICLES_PER_PATH + i
        offsets[idx] = (offsets[idx] + delta * speed) % 1
        const pt = curves[p].getPoint(offsets[idx])
        positions.setXYZ(idx, pt.x, pt.y, pt.z)
      }
    }
    positions.needsUpdate = true

    // Update line opacities
    lineObjects.current.forEach((line, p) => {
      if (!line) return
      const mat = line.material as THREE.LineBasicMaterial
      const baseOpacity = 0.05 + pathwayStrength[p] * 0.35
      const actOpacity = actLevels[p] * 0.5
      mat.opacity = Math.min(baseOpacity + actOpacity, 0.9)
    })

    // Particle point size / opacity via material
    if (pointsRef.current) {
      const mat = pointsRef.current.material as THREE.PointsMaterial
      const totalAct = (smoothedActivation.current.auditory + smoothedActivation.current.wernicke + smoothedActivation.current.broca) / 3
      mat.size = 0.02 + totalAct * 0.04
      mat.opacity = 0.3 + totalAct * 0.6
    }
  })

  return (
    <group ref={groupRef}>
      {/* Lines are added imperatively via useEffect */}

      {/* Particles */}
      <points ref={pointsRef} geometry={particleGeo}>
        <pointsMaterial
          vertexColors
          transparent
          opacity={0.4}
          size={0.025}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  )
}
