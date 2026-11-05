import { ReactiveSignal } from './reactive.js';

let CURRENT_CONSUMER: ReactiveSignal<any, any> | undefined;

export const setCurrentConsumer = (consumer: ReactiveSignal<any, any> | undefined) => {
  CURRENT_CONSUMER = consumer;
};

export const getCurrentConsumer = () => {
  return CURRENT_CONSUMER;
};
