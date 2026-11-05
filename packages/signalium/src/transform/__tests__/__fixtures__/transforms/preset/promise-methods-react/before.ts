import { component } from 'signalium/react';
import { useReactive, useReactiveShallow, useReactiveDeep } from 'signalium/react';

export const Page = component(async (props: { id: string }) => {
  const a = Promise.resolve(props.id);
  const results = await Promise.all([a]);
  return results;
});

export function useThing(id: string) {
  return useReactive(async () => {
    const fastest = await Promise.race([Promise.resolve(id)]);
    return fastest;
  });
}

export function useThingShallow(id: string) {
  return useReactiveShallow(async () => {
    const any = await Promise.any([Promise.resolve(id)]);
    return any;
  });
}

export function useThingDeep(id: string) {
  return useReactiveDeep(async () => {
    const settled = await Promise.allSettled([Promise.resolve(id)]);
    return settled;
  });
}
