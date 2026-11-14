'use client';

import { useMemo } from 'react';

interface Props {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
  className?: string;
}

const DEFAULT_CLASS =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white';

// <select> over a numeric range. The (often hundreds of) <option> elements are
// memoized so that re-renders of the parent — e.g. on every keystroke in another
// field — don't rebuild and re-reconcile the whole list.
export default function NumberSelect({ value, onChange, min, max, step, unit, className }: Props) {
  const options = useMemo(
    () =>
      Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, i) => min + i * step).map(v => (
        <option key={v} value={v}>{v} {unit}</option>
      )),
    [min, max, step, unit]
  );

  return (
    <select
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className={className ?? DEFAULT_CLASS}
    >
      {options}
    </select>
  );
}
