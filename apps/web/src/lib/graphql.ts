import { Client, cacheExchange, fetchExchange, subscriptionExchange } from 'urql';
import { createClient as createSSEClient } from 'graphql-sse';

const sseClient = createSSEClient({
  url: import.meta.env.VITE_GRAPHQL_URL ?? '/graphql',
});

export const graphqlClient = new Client({
  url: import.meta.env.VITE_GRAPHQL_URL ?? '/graphql',
  exchanges: [
    cacheExchange,
    fetchExchange,
    subscriptionExchange({
      forwardSubscription(request) {
        return {
          subscribe(sink) {
            const unsubscribe = sseClient.subscribe({ ...request, query: request.query ?? '' }, sink);
            return { unsubscribe };
          },
        };
      },
    }),
  ],
});
