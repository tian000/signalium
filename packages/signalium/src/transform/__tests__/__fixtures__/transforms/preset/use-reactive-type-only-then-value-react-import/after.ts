import type { FC } from 'react';
import { useState, useCallback as _useCallback } from 'react';
import { useReactive } from 'signalium/react';
export const useThing: FC = () => {
  const [n] = useState(0);
  return useReactive(_useCallback(() => n, [n]));
};
