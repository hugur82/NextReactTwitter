import { useQuery } from '@tanstack/react-query';
import type { IncomingMessage } from 'http';
import { AddTweet } from '~/components/tweets/AddTweet';
import { TweetWithLikes } from '~/components/tweets/TweetWithLikes';
import TwitterLayout from '~/components/TwitterLayout';
import { getTweet } from '~/db/tweets';
import { client } from '~/lib/client/client';
import { getOptionalUserIdInCookie } from '~/lib/client/getUserIdCookie';
import { TweetScheme, type TweetView } from '~/lib/scheme/tweets';
import { tweetKeys } from '~/lib/tweets/query.tweet';

const getApiTeet = async (tweetId: string) => {
  return client(`api/tweets/${tweetId}`, {
    zodSchema: TweetScheme,
  });
};

export default function TweetId({ tweet: defaultTweet }: { tweet: TweetView }) {
  const { data } = useQuery({
    queryKey: tweetKeys.getById(defaultTweet.id),
    queryFn: () => getApiTeet(defaultTweet.id),
    initialData: {
      tweet: defaultTweet,
    },
  });

  const tweet = data.tweet;

  return (
    <TwitterLayout>
      <TweetWithLikes tweet={tweet} parentTweetId={tweet.id} />
      <AddTweet tweetId={tweet.id} />
      <h2 className="p-4 text-2xl font-bold">Replies</h2>
      {tweet.replies?.map((reply) => (
        <TweetWithLikes tweet={reply} parentTweetId={tweet.id} key={reply.id} />
      ))}
    </TwitterLayout>
  );
}

export const getServerSideProps = async (context: {
  params: { tweetId: string };
  req: IncomingMessage;
}) => {
  const { tweetId } = context.params;
  const userId: string | undefined = getOptionalUserIdInCookie(context.req);

  // 🦁 Récupère le tweet avec la fonction getTweet

  const tweet = await getTweet(tweetId, userId);
  return {
    props: {
      // ⚠️ Utilise le trick de JSON pour copier l'objet tweet
      tweet,
    },
  };
};
