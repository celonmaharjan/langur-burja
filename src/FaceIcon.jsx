import React from 'react';

/** Vector artwork for the six faces. Colour comes from `currentColor`. */
export default function FaceIcon({ face, size = 40, className }) {
  const key = typeof face === 'string' ? face : face.key;
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true, className };
  switch (key) {
    case 'langur': // flag
      return (
        <svg {...p}>
          <rect x="4.2" y="2.2" width="2" height="19.6" rx="1" />
          <path d="M7 3.4c3.2-1.4 5.2 1.4 8.4 0 1.5-.6 2.8-.7 4.1-.2v9.2c-1.3-.5-2.6-.4-4.1.2-3.2 1.4-5.2-1.4-8.4 0z" />
        </svg>
      );
    case 'burja': // crown
      return (
        <svg {...p}>
          <path d="M2.6 8.2l4.6 3.9L12 4.2l4.8 7.9 4.6-3.9-1.6 10H4.2z" />
          <rect x="4.2" y="19.4" width="15.6" height="2.2" rx="1" />
          <circle cx="12" cy="3.4" r="1.3" />
          <circle cx="2.6" cy="7.2" r="1.3" />
          <circle cx="21.4" cy="7.2" r="1.3" />
        </svg>
      );
    case 'paan': // heart
      return (
        <svg {...p}>
          <path d="M12 21.2S3.4 15.6 3.4 9.6c0-3.1 2.2-5.2 4.8-5.2 1.6 0 2.9.8 3.8 2.1.9-1.3 2.2-2.1 3.8-2.1 2.6 0 4.8 2.1 4.8 5.2 0 6-8.6 11.6-8.6 11.6z" />
        </svg>
      );
    case 'surat': // spade
      return (
        <svg {...p}>
          <path d="M12 2.2C9 6.3 4 9.3 4 13.5c0 2.4 1.8 4 3.9 4 1.5 0 2.7-.7 3.4-1.8-.1 1.9-.8 3.6-2.3 4.9h6c-1.5-1.3-2.2-3-2.3-4.9.7 1.1 1.9 1.8 3.4 1.8 2.1 0 3.9-1.6 3.9-4 0-4.2-5-7.2-8-11.3z" />
        </svg>
      );
    case 'eent': // diamond
      return (
        <svg {...p}>
          <path d="M12 2l7.6 10L12 22 4.4 12z" />
        </svg>
      );
    default: // chidiya — club
      return (
        <svg {...p}>
          <circle cx="12" cy="7.3" r="4.3" />
          <circle cx="6.6" cy="14" r="4.3" />
          <circle cx="17.4" cy="14" r="4.3" />
          <path d="M12 11.5l-2.8 10.2h5.6z" />
        </svg>
      );
  }
}
