import type { FC } from 'react';
import { useReactive } from 'signalium/react';

export const useThing: FC = () => useReactive(() => ['a', 'b']);
