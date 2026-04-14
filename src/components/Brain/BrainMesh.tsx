import { useRef, useMemo, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useBrainStore } from '../../store/brainStore'

// Use local Draco decoder (copied to public/)
useGLTF.setDecoderPath('/')

// ─── Region colours ───────────────────────────────────────────────────────────
const REGION_COLORS = {
  auditory: new THREE.Color('#3B82F6'),
  wernicke: new THREE.Color('#10B981'),
  broca:    new THREE.Color('#F59E0B'),
}
const RESTING = 0.018

// ─── Coordinate transform constants ──────────────────────────────────────────
// FreeSurfer pial surface coordinates are in RAS millimetres.
// Map to Three.js space:
//   Three.js X  =  FreeSurfer R  * SCALE
//   Three.js Y  =  FreeSurfer S  * SCALE   (superior = up)
//   Three.js Z  = -FreeSurfer A  * SCALE   (anterior = toward viewer)
// Applied via rotation.x = -PI/2 on a group, which swaps Y↔Z and negates Z.
const SCALE = 0.0118   // ~170 mm brain → ~2 Three.js units
const Y_OFFSET = -0.08  // slight downward nudge so brain centres nicely

// ─── Anatomical region positions (Three.js space after transform) ─────────────
// Derived from standard MNI landmarks → scaled to Three.js units.
// Using: X = R*SCALE, Y = S*SCALE, Z = -A*SCALE
const REGIONS = {
  // Primary auditory cortex (right hemisphere — dominant for audio onset)
  auditoryR: new THREE.Vector3( 0.65,  0.12,  0.24),
  // Left auditory cortex (secondary overlay)
  auditoryL: new THREE.Vector3(-0.65,  0.12,  0.24),
  // Wernicke's area — left posterior superior temporal gyrus
  wernicke:  new THREE.Vector3(-0.62,  0.12,  0.47),
  // Broca's area — left inferior frontal gyrus (pars triangularis)
  broca:     new THREE.Vector3(-0.59,  0.24, -0.24),
}

// ─── Material ─────────────────────────────────────────────────────────────────
// Warm pinkish-grey cortex with a wet clearcoat sheen, matching real human brain
const CORTEX_COLOR = new THREE.Color(0.80, 0.65, 0.62)  // warm pink-grey

// Preload both hemispheres
useGLTF.preload('/lh.glb')
useGLTF.preload('/rh.glb')

export default function BrainMesh() {
  const groupRef    = useRef<THREE.Group>(null)
  const auditoryRef = useRef<THREE.Mesh>(null)
  const wernickeRef = useRef<THREE.Mesh>(null)
  const brocaRef    = useRef<THREE.Mesh>(null)

  const activation      = useBrainStore((s) => s.activation)
  const pathwayStrength = useBrainStore((s) => s.model.pathwayStrength)
  const brainAge        = useBrainStore((s) => s.model.brainAge)
  const smoothed     = useRef({ auditory: 0, wernicke: 0, broca: 0 })
  const smoothedAge  = useRef(0)

  // ── Load real MRI-derived hemispheres ─────────────────────────────────────
  const lh = useGLTF('/lh.glb')
  const rh = useGLTF('/rh.glb')

  // ── Build mesh geometry from GLTF scene ───────────────────────────────────
  const lhGeometry = useMemo(() => {
    let geo: THREE.BufferGeometry | null = null
    lh.scene.traverse((child) => {
      if (child instanceof THREE.Mesh && !geo) {
        geo = (child as THREE.Mesh).geometry
      }
    })
    return geo as THREE.BufferGeometry | null
  }, [lh])

  const rhGeometry = useMemo(() => {
    let geo: THREE.BufferGeometry | null = null
    rh.scene.traverse((child) => {
      if (child instanceof THREE.Mesh && !geo) {
        geo = (child as THREE.Mesh).geometry
      }
    })
    return geo as THREE.BufferGeometry | null
  }, [rh])

  // ── Cortex material ────────────────────────────────────────────────────────
  const cortexMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: CORTEX_COLOR,
    emissive: new THREE.Color(0.28, 0.12, 0.10),
    emissiveIntensity: 0.025,
    roughness: 0.58,
    metalness: 0.0,
    clearcoat: 0.55,
    clearcoatRoughness: 0.35,
  }), [])

  // ── Smoothed activation + brain-age → animate materials ──────────────────
  useFrame((_, delta) => {
    const t = 1 - Math.pow(0.004, delta)
    smoothed.current.auditory += (activation.auditory - smoothed.current.auditory) * t
    smoothed.current.wernicke += (activation.wernicke - smoothed.current.wernicke) * t
    smoothed.current.broca    += (activation.broca    - smoothed.current.broca)    * t

    // Brain age smoothed very slowly (grows over minutes, not frames)
    smoothedAge.current += (brainAge - smoothedAge.current) * 0.002

    const { auditory, wernicke, broca } = smoothed.current
    const total = (auditory + wernicke + broca) / 3

    // Brain grows from 88% to 100% of full size as age increases
    const ageScale = 0.88 + smoothedAge.current * 0.12
    if (groupRef.current) {
      groupRef.current.scale.setScalar(SCALE * ageScale)
    }

    // Cortex gets slightly more moist-looking (clearcoat) as development progresses
    cortexMat.clearcoat = 0.35 + smoothedAge.current * 0.30
    cortexMat.emissiveIntensity = 0.018 + total * 0.13 + smoothedAge.current * 0.012

    const setRegion = (
      ref: RefObject<THREE.Mesh>,
      act: number,
      color: THREE.Color,
      pwBase: number,
    ) => {
      if (!ref.current) return
      const m = ref.current.material as THREE.MeshStandardMaterial
      m.emissive = color
      m.emissiveIntensity = pwBase + act * 2.8
      ref.current.scale.setScalar(1 + act * 0.05)
    }

    setRegion(auditoryRef, auditory, REGION_COLORS.auditory, RESTING + pathwayStrength[0] * 0.14)
    setRegion(wernickeRef, wernicke, REGION_COLORS.wernicke, RESTING + pathwayStrength[1] * 0.14)
    setRegion(brocaRef,    broca,    REGION_COLORS.broca,    RESTING + pathwayStrength[2] * 0.12)
  })

  if (!lhGeometry || !rhGeometry) return null

  return (
    // Outer group: coordinate transform + brain-age scale (driven by useFrame)
    // rotation.x = -PI/2 maps FreeSurfer RAS → Three.js Y-up space
    // scale is set every frame in useFrame (brain grows with development)
    <group
      ref={groupRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, Y_OFFSET, 0]}
    >
      {/* Left hemisphere */}
      <mesh geometry={lhGeometry} material={cortexMat} />

      {/* Right hemisphere */}
      <mesh geometry={rhGeometry} material={cortexMat} />

      {/* ── Region glow overlays ── */}
      {/* These positions are in FreeSurfer RAS space (mm) — the parent group
          transforms them into Three.js space automatically */}

      {/* Auditory cortex — right (primary) */}
      <mesh ref={auditoryRef} position={[55, 10, -20]}>
        <sphereGeometry args={[6, 24, 18]} />
        <meshStandardMaterial
          color="#050d20" emissive={REGION_COLORS.auditory}
          emissiveIntensity={RESTING} transparent opacity={0.78}
          roughness={0.5} depthWrite={false} blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Auditory cortex — left (secondary) */}
      <mesh position={[-55, 10, -20]}>
        <sphereGeometry args={[5, 20, 16]} />
        <meshStandardMaterial
          color="#050d20" emissive={REGION_COLORS.auditory}
          emissiveIntensity={RESTING * 0.6} transparent opacity={0.55}
          roughness={0.5} depthWrite={false} blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Wernicke's area — left posterior superior temporal */}
      <mesh ref={wernickeRef} position={[-52, 10, -40]}>
        <sphereGeometry args={[6, 24, 18]} />
        <meshStandardMaterial
          color="#05200e" emissive={REGION_COLORS.wernicke}
          emissiveIntensity={RESTING} transparent opacity={0.78}
          roughness={0.5} depthWrite={false} blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Broca's area — left inferior frontal gyrus */}
      <mesh ref={brocaRef} position={[-50, 20, 20]}>
        <sphereGeometry args={[5.5, 24, 18]} />
        <meshStandardMaterial
          color="#201005" emissive={REGION_COLORS.broca}
          emissiveIntensity={RESTING} transparent opacity={0.78}
          roughness={0.5} depthWrite={false} blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}
