import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import z from 'zod';
import { Loader } from '~/components/Loader';
import type { TlTweets } from '~/lib/scheme/tweets';
import { AddTweetForm } from '../../src/components/tweets/AddTweetForm';
import { LikeButton } from '../../src/components/tweets/LikeButton';
import { RepliesButton } from '../../src/components/tweets/RepliesButton';
import { Tweet } from '../../src/components/tweets/Tweet';
import TwitterLayout from '../../src/components/TwitterLayout';

const notifyFailed = () => toast.error("Couldn't fetch tweet...");

const TweetsScheme = z.object({
  tweets: z.array(
    z.object({
      id: z.string(),
      content: z.string(),
      createdAt: z.string(),
      user: z.object({
        id: z.string(),
        displayName: z.string(),
        username: z.string(),
        avatarUrl: z.string(),
      }),
      _count: z.object({
        replies: z.number(),
        likes: z.number(),
      }),
      liked: z.boolean(),
    })
  ),
});

export type ClientConfig<T> = {
  data?: unknown;
  // On utilise T dans le zod schema
  // Ce qui va faire que notre fetch va être automatiquement être typé en fonction du schéma
  zodSchema?: z.ZodSchema<T>;
  method?: 'DELETE' | 'GET' | 'OPTIONS' | 'PATCH' | 'POST' | 'PUT';
  headers?: HeadersInit;
  // Pour pouvoir override la config
  customConfig?: RequestInit;
  signal?: AbortSignal;
};

export async function client<T>(
  url: string,
  {
    data,
    zodSchema,
    method,
    headers: customHeaders,
    signal,
    customConfig,
  }: ClientConfig<T> = {} // On passe T en paramètre de ClientConfig
): Promise<T> {
  const config: RequestInit = {
    method: method ?? (data ? 'POST' : 'GET'),
    // On stringify les données s'il y en a
    body: data ? JSON.stringify(data) : null,
    headers: {
      'Content-Type': data ? 'application/json' : '',
      Accept: 'application/json',
      // Mais on laisse l'utilisateur override les headers
      ...customHeaders,
    },
    signal,
    // On laisse l'utilisateur override la config
    // S'il passe body, method, headers, etc... on les écrasera
    ...customConfig,
  };

  return window.fetch(url, config).then(async (response) => {
    // on gère le status 401 en arrêtant directement la request
    if (response.status === 401) {
      return Promise.reject(new Error("You're not authenticated"));
    }

    let result = null;
    // 🦁 à toi de parse le json dans un try catch
    try {
      result = response.status === 204 ? null : await response.json();
    } catch (error: unknown) {
      return Promise.reject(error);
    }
    if (response.ok) {
      return zodSchema && result ? zodSchema.parse(result) : result;
    } else {
      return Promise.reject(result);
    }
  });
}

const getTweets = async (signal: AbortSignal) =>
  client('/api/tweets?error=test', { signal, zodSchema: TweetsScheme }); // ℹ️ tu peux remplacer l'url par `/api/tweets?error=erreur` pour voir le problème

export default function FetchAllTweets() {
  const [tweets, setTweets] = useState<TlTweets | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    getTweets(abortController.signal)
      .then((data) => {
        setTweets(data.tweets);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        notifyFailed();
      });

    return () => {
      abortController.abort();
    };
  }, []);

  if (!tweets) return <Loader />;

  return (
    <TwitterLayout>
      <AddTweetForm />
      {tweets.map((tweet) => (
        <Tweet key={tweet.id} tweet={tweet}>
          <RepliesButton count={tweet._count.replies} />
          <LikeButton count={tweet._count.likes} />
        </Tweet>
      ))}
    </TwitterLayout>
  );
}
