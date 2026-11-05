import { reactive } from 'signalium';

export function useThing() {
  return reactive(function* () {
    const items = yield getItems();
    const results = [];
    for (const item of items) {
      results.push(item);
    }
    return results;
  });
}
