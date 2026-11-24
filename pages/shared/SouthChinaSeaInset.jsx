import React from 'react';
import china from '../h01/src/china.json';

const width = 52;
const height = 65;
const outline = china.features.flatMap(({ geometry }) => {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.filter(([outer]) => outer.every(([, latitude]) => latitude < 17.6))
    .flatMap(polygon => polygon.map(ring => ring.map(([longitude, latitude], index) => {
      const x = 5 + (longitude - 107.5) / 12.5 * 42;
      const y = 4 + (18 - latitude) / 15 * 48;
      return `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join('') + 'Z'));
}).join('');

export default function SouthChinaSeaInset({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} data-south-china-sea-inset="" role="img" aria-label="南海诸岛附图" pointerEvents="none">
      <rect width={width} height={height} rx="2" fill="white" stroke="var(--border, #cbd5e1)" strokeWidth=".8" />
      <path className="land" d={outline} style={{ fill: '#d9e8ff', stroke: '#537ba8', strokeWidth: 0.55, strokeLinejoin: 'round' }} fillRule="evenodd" />
      <text x={width / 2} y="60" textAnchor="middle" style={{ fontSize: 11.5, fill: 'var(--text-secondary, #475569)' }}>南海诸岛</text>
    </g>
  );
}
