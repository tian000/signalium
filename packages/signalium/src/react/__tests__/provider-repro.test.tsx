import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from '@vitest/browser/context';
import React, { Suspense, useState } from 'react';
import { context, reactive } from '../../index.js';
import { ContextProvider, useContext, component } from 'signalium/react';
import { sleep } from '../../__tests__/utils/async.js';

describe('React > ContextProvider value changes', () => {
  test('component() reads updated context value after provider value changes', async () => {
    const ctx = context('default');

    const Consumer = component(() => <span data-testid="out">{useContext(ctx)}</span>);

    function App() {
      const [val, setVal] = useState('a');
      return (
        <>
          <ContextProvider contexts={[[ctx, val]]}>
            <Consumer />
          </ContextProvider>
          <button onClick={() => setVal('b')}>change</button>
        </>
      );
    }

    const { getByTestId, getByRole } = render(<App />);
    await expect.element(getByTestId('out')).toHaveTextContent('a');

    await userEvent.click(getByRole('button', { name: 'change' }));
    await expect.element(getByTestId('out')).toHaveTextContent('b');
  });

  test('component() reads updated context via reactive thunk after provider value changes', async () => {
    const ctx = context('default');

    const readCtx = reactive(() => useContext(ctx));

    const Consumer = component(() => <span data-testid="out">{readCtx()}</span>);

    function App() {
      const [val, setVal] = useState('a');
      return (
        <>
          <ContextProvider contexts={[[ctx, val]]}>
            <Consumer />
          </ContextProvider>
          <button onClick={() => setVal('b')}>change</button>
        </>
      );
    }

    const { getByTestId, getByRole } = render(<App />);
    await expect.element(getByTestId('out')).toHaveTextContent('a');

    await userEvent.click(getByRole('button', { name: 'change' }));
    await expect.element(getByTestId('out')).toHaveTextContent('b');
  });

  test('component() does not recreate signal when provider re-renders without value changes', async () => {
    const ctx = context('default');

    let renderCount = 0;
    const Consumer = component(() => {
      renderCount++;
      return <span data-testid="out">{useContext(ctx)}</span>;
    });

    function App() {
      const [, setTick] = useState(0);
      return (
        <>
          <ContextProvider contexts={[[ctx, 'a']]}>
            <Consumer />
          </ContextProvider>
          <button onClick={() => setTick(t => t + 1)}>rerender</button>
        </>
      );
    }

    const { getByTestId, getByRole } = render(<App />);
    await expect.element(getByTestId('out')).toHaveTextContent('a');
    const initialRenderCount = renderCount;

    await userEvent.click(getByRole('button', { name: 'rerender' }));
    await expect.element(getByTestId('out')).toHaveTextContent('a');
    // The provider re-renders (parent state change) but context values are unchanged,
    // so the scope is stable and the component should not needlessly recompute.
    expect(renderCount).toBe(initialRenderCount);
  });

  test('async component() reads updated context value after provider value changes', async () => {
    const ctx = context('default');

    const flush = reactive(async () => {
      await sleep(0);
    });

    const Consumer = component(async () => {
      await flush();
      return <span data-testid="out">{useContext(ctx)}</span>;
    });

    function App() {
      const [val, setVal] = useState('a');
      return (
        <>
          <ContextProvider contexts={[[ctx, val]]}>
            <Suspense fallback={<span data-testid="fb">loading</span>}>
              <Consumer />
            </Suspense>
          </ContextProvider>
          <button onClick={() => setVal('b')}>change</button>
        </>
      );
    }

    const { getByTestId, getByRole } = render(<App />);
    await expect.element(getByTestId('fb')).toBeInTheDocument();
    await expect.element(getByTestId('out')).toHaveTextContent('a');

    await userEvent.click(getByRole('button', { name: 'change' }));
    await expect.element(getByTestId('out')).toHaveTextContent('b');
  });
});
