import { reactive } from 'signalium';

export function useThing() {
  return reactive(async () => {
    const items = await getItems();
    const results = [];
    for (const item of items) {
      results.push(item);
    }
    return results;
  });
}
