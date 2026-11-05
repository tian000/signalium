/* eslint-disable react-hooks/rules-of-hooks -- signalium useContext is designed to work inside withContexts callbacks */
import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { signal, reactive, context, getContext, withContexts } from '../../index.js';
import { ContextProvider, useReactive, useContext } from 'signalium/react';
import React from 'react';

describe('React > useContext with withContexts overrides', () => {
  test('useContext honors withContexts override in a component render body', async () => {
    const ctx = context('default');

    function Component(): React.ReactNode {
      const result = withContexts([[ctx, 'override']], () => `${getContext(ctx)}|${useContext(ctx)}`);
      return <div>{result}</div>;
    }

    const { getByText } = render(
      <ContextProvider contexts={[]}>
        <Component />
      </ContextProvider>,
    );

    await expect.element(getByText('override|override')).toBeInTheDocument();
  });

  test('useContext without withContexts still returns the default value', async () => {
    const value = signal('Hello');
    const ctx = context(value);

    function Component(): React.ReactNode {
      const v = useContext(ctx);
      return <div>{useReactive(() => v.value)}, World</div>;
    }

    const { getByText } = render(
      <ContextProvider contexts={[]}>
        <Component />
      </ContextProvider>,
    );

    await expect.element(getByText('Hello, World')).toBeInTheDocument();
  });

  test('useContext inside withContexts overrides ContextProvider value', async () => {
    const value = signal('default');
    const providerOverride = signal('provider-override');
    const dynamicOverride = signal('dynamic-override');
    const ctx = context(value);

    const derived = reactive(() => withContexts([[ctx, dynamicOverride]], () => useContext(ctx).value));

    function Component(): React.ReactNode {
      return <div>{useReactive(() => derived())}</div>;
    }

    const { getByText } = render(
      <ContextProvider contexts={[[ctx, providerOverride]]}>
        <Component />
      </ContextProvider>,
    );

    await expect.element(getByText('dynamic-override')).toBeInTheDocument();
  });
});
