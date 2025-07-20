import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Error } from '~/components/Error';
import { Loader } from '~/components/Loader';
import { client } from '~/lib/client/client';
import { TweetsScheme } from '~/lib/scheme/tweets';
import { AddTweetForm } from '../../src/components/tweets/AddTweetForm';
import { LikeButton } from '../../src/components/tweets/LikeButton';
import { RepliesButton } from '../../src/components/tweets/RepliesButton';
import { Tweet } from '../../src/components/tweets/Tweet';
import TwitterLayout from '../../src/components/TwitterLayout';

const notifyFailed = () => toast.error("Couldn't fetch tweet...");

const getTweets = async (signal?: AbortSignal, page = 0) =>
  client(`/api/tweets?page=${page}`, { signal, zodSchema: TweetsScheme });

const tweetKeys = {
  all: ['tweets'],
  getById: (tweetId: number) => ['tweets', tweetId],
};

const useInfiniteTweets = () => {
  return useInfiniteQuery({
    queryKey: tweetKeys.all,
    queryFn: ({ signal, pageParam }) => getTweets(signal, pageParam),
    onError: notifyFailed,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });
};

export default function FetchAllTweets() {
  const {
    data,
    isLoading,
    isError,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteTweets();

  if (isLoading) return <Loader />;
  if (isError)
    return <Error error="Couldn't fetch tweet ..." reset={refetch} />;

  const tweets = data.pages.flatMap((page) => page.tweets);

  const nextPageStatus = hasNextPage ? 'Next page ' : 'No more tweet';

  return (
    <TwitterLayout>
      <AddTweet />
      {tweets.map((tweet) => (
        <Tweet key={tweet.id} tweet={tweet}>
          <RepliesButton count={tweet._count.replies} />
          <LikeButton count={tweet._count.likes} liked={tweet.liked} />
        </Tweet>
      ))}
      <button
        onClick={() => hasNextPage && fetchNextPage()}
        className="block py-4"
      >
        {isFetchingNextPage ? 'Loading...' : nextPageStatus}
      </button>
    </TwitterLayout>
  );
}
export const AddTweet = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation(
    (content: string) =>
      client('/api/tweets', {
        method: 'POST',
        data: {
          content,
        },
      }),
    {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: tweetKeys.all });
      },
    }
  );

  const handleSubmit = (content: string) => {
    mutation.mutate(content);
  };
  return <AddTweetForm onSubmit={handleSubmit} disabled={mutation.isLoading} />;
};
