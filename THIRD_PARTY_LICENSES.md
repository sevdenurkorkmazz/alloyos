# Third-Party Licenses — AlloyOS

AlloyOS builds its own original brand identity, UI system, 3D characters and 3D
environment. The reference project **The Delegation** (github.com/arturitu/the-delegation)
was used **only as conceptual inspiration**. None of its assets are used.

## Explicitly NOT used
- The Delegation's 3D models, textures, materials or animations
  (its 3D assets are licensed **CC BY-NC 4.0**, i.e. non-commercial — incompatible
  with a commercial product).
- The Delegation's UI design, brand, logo, name or visual identity.
- Its characters or source code.

## Original assets in AlloyOS
- **3D office, desks, characters and the flying-envelope**: 100% procedural,
  generated at runtime with `three` primitives (boxes, spheres, capsules) in
  `src/components/three/OfficeScene.jsx`. No downloaded/imported model files.

## Runtime open-source libraries
| Library | License |
|---|---|
| three | MIT |
| @react-three/fiber | MIT |
| @react-three/drei | MIT |
| React, react-router-dom | MIT |
| FastAPI, Motor, PyJWT, bcrypt | MIT / BSD / Apache-2.0 |
| lucide-react (icons) | ISC |
| Fonts: Cabinet Grotesk (Fontshare), Chivo, Geist, Geist Mono | OFL / free-to-use |

## AI
- Text generation via Emergent Universal LLM key (server-side only).
