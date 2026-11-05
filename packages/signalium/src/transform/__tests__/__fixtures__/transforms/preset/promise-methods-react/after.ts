import { useCallback as _useCallback } from "react";
import { ReactivePromise } from "signalium";
import { component } from 'signalium/react';
import { useReactive, useReactiveShallow, useReactiveDeep } from 'signalium/react';
export const Page = component(function* (props: {
  id: string;
}) {
  const a = ReactivePromise.resolve(props.id);
  const results = yield ReactivePromise.all([a]);
  return results;
});
export function useThing(id: string) {
  return useReactive(_useCallback(function* () {
    const fastest = yield ReactivePromise.race([ReactivePromise.resolve(id)]);
    return fastest;
  }, [id]));
}
export function useThingShallow(id: string) {
  return useReactiveShallow(_useCallback(function* () {
    const any = yield ReactivePromise.any([ReactivePromise.resolve(id)]);
    return any;
  }, [id]));
}
export function useThingDeep(id: string) {
  return useReactiveDeep(_useCallback(function* () {
    const settled = yield ReactivePromise.allSettled([ReactivePromise.resolve(id)]);
    return settled;
  }, [id]));
}
