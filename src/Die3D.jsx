import React from 'react';
import FaceIcon from './FaceIcon.jsx';
import { FACES } from './faces.js';
import { useT } from './i18n.jsx';

// Which face of the cube carries which figure, and the cube rotation [rotateX, rotateY]
// that brings that face toward the viewer.
const SLOTS = [
  ['front', 'langur'], ['back', 'burja'], ['right', 'paan'],
  ['left', 'surat'], ['top', 'eent'], ['bottom', 'chidiya'],
];
const INK = Object.fromEntries(FACES.map((f) => [f.key, f.ink]));
const REST = {
  langur: [0, 0], burja: [0, 180], paan: [0, -90],
  surat: [0, 90], eent: [-90, 0], chidiya: [90, 0],
};

// Timing of one die's throw, shared with the CSS keyframes (@keyframes toss) and the sound.
export const dieDurationMs = (index) => Math.round((1.3 + index * 0.07) * 1000);
export const dieDelayMs = (index) => index * 30;
const IMPACT_AT = [0.30, 0.60, 0.80, 0.98];           // fraction of the throw when the die hits the felt
const IMPACT_VOL = [1, 0.62, 0.36, 0.2];              // each bounce is quieter
/** [{ at: ms after the roll starts, vol }] for one die. */
export const impacts = (index) => IMPACT_AT.map((f, k) => ({ at: dieDelayMs(index) + dieDurationMs(index) * f, vol: IMPACT_VOL[k] }));

/**
 * A real 3D cube. `face` is the figure that must end up facing the viewer.
 * Every time `rollId` changes the cube adds several full turns on both axes, so the CSS
 * transition tumbles it through the air before it lands on the new face.
 */
export default function Die3D({ face, rollId, index, tossing, hit }) {
  const [rx, ry] = REST[face] ?? REST.langur;
  const turnsX = rollId * 2 + (index % 3);
  const turnsY = rollId * 3 + (index % 2) + 1;
  const yaw = ((rollId * 37 + index * 53) % 17) - 8; // slight rotation so dice never look lined up
  const dx = (((rollId * 53 + index * 97) % 9) - 4) * 26 || 70; // sideways travel in px, different for every die and roll
  const transform = `rotateZ(${yaw}deg) rotateX(${rx + 360 * turnsX}deg) rotateY(${ry + 360 * turnsY}deg)`;
  const { faceName, faceAlt } = useT();

  return (
    <div
      className={`die3d ${tossing ? 'tossing' : 'settled'} ${hit ? 'hit' : ''}`}
      style={{ '--i': index, '--dur': `${dieDurationMs(index) / 1000}s`, '--dx': `${dx}px` }}
      role="img"
      aria-label={`${faceName(face)} ${faceAlt(face)}`}
    >
      <div className="toss">
        <div className="scene">
          <div className="tilt">
            <div className="cube" style={{ transform }}>
              {SLOTS.map(([slot, key]) => {
                return (
                  <div key={slot} className={`face ${slot} ${key === face ? 'facing' : ''}`} style={{ '--ink': INK[key] }}>
                    <FaceIcon face={key} size="50%" />
                    <span>{faceName(key)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="die-shadow" />
    </div>
  );
}
