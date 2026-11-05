import { useCallback as _useCallback } from "react";
import type { FC } from 'react';
import { useReactive } from 'signalium/react';
export const useThing: FC = () => useReactive(_useCallback(() => ['a', 'b'], []));
