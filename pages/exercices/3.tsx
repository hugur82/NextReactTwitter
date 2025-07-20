import { QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Error } from '~/components/Error';
import { Loader } from '~/components/Loader';
import { AddTweet } from '~/components/tweets/AddTweet';
import { TweetsNextButton } from '~/components/tweets/TweetsNextButton';
import { useUser } from '~/hooks/UserProvider';
import { client } from '~/lib/client/client';
import { tweetKeys, useInfiniteTweets } from '~/lib/tweets/query.tweet';
import { LikeButton } from '../../src/components/tweets/LikeButton';
import { RepliesButton } from '../../src/components/tweets/RepliesButton';
import { Tweet } from '../../src/components/tweets/Tweet';
import TwitterLayout from '../../src/components/TwitterLayout';
import { TlTweetsPage } from '~/lib/scheme/tweets';

export default function OptimisticUpdate() {
  const {
    data,
    isLoading,
    isError,
    isFetchingNextPage,
    hasNextPage,
    refetch,
    fetchNextPage,
  } = useInfiniteTweets();

  if (isLoading) {
    return <Loader />;
  }

  if (isError) {
    return <Error error="Couldn't fetch tweet..." reset={() => refetch()} />;
  }

  const tweets = data.pages.flatMap((page) => page.tweets);

  return (
    <TwitterLayout>
      <AddTweet />
      {tweets.map((tweet) => (
        <Tweet key={tweet.id} tweet={tweet}>
          <RepliesButton count={tweet._count.replies} />
          <Like
            tweetId={tweet.id}
            liked={tweet.liked}
            count={tweet._count.likes}
          />
        </Tweet>
      ))}
      <TweetsNextButton
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        fetchNextPage={fetchNextPage}
      />
    </TwitterLayout>
  );
}

const notifyFailed = () => toast.error("Couldn't like tweet");

const likeTweet = async (tweetId: string, liked: boolean) => {
  // 🦁 Utilise `client` pour faire un appel à l'API
  // url : `/api/tweets/${tweetId}/like`
  // la method sera DELETE si liked est true, POST sinon
  // data : { userId }
  return client(`/api/tweets/${tweetId}/like`, {
    method: liked ? 'DELETE' : 'POST',
  });
};

type LikeUpdateProps = {
  tweetId: string;
  count: number;
  liked: boolean;
};

const Like = ({ count, liked, tweetId }: LikeUpdateProps) => {
  const queryClient = useQueryClient();
  const { user } = useUser();

  const mutation = useMutation(() => likeTweet(tweetId, liked), {
    onMutate: async () => {
      void queryClient.cancelQueries({ queryKey: tweetKeys.all });

      const previousValue: [QueryKey, unknown][] = queryClient.getQueryData(
        tweetKeys.all
      );
      queryClient.setQueryData(
        tweetKeys.all,
        (old?: { pages: TlTweetsPage[] }) => {
          // S'il n'y a pas de données, on fait rien !
          if (!old) {
            return old;
          }

          return {
            pages: old.pages.map((page) => {
              return {
                ...page,
                tweets: page.tweets.map((tweet) => {
                  if (tweet.id !== tweetId) {
                    return tweet; // Si ce n'est pas le tweet qu'on veut modifier, on le retourne tel quel
                  }
                  return {
                    ...tweet,
                    liked: !liked,
                    _count: {
                      ...tweet._count,
                      likes: tweet._count.likes + (liked ? -1 : 1), // On met à jour le compteur de likes
                    },
                  };
                }) /* à toi de jouer */,
              };
            }),
          };
        }
      );

      return { previousValue };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: tweetKeys.all,
        refetchPage: (lastPage: TlTweetsPage) => {
          return lastPage.tweets.some((tweet) => tweet.id === tweetId);
        },
      });
    },
    onError: (err: unknown, variables, context) => {
      queryClient.setQueryData(tweetKeys.all, context?.previousValue);
      console.error(err);
      notifyFailed();
    },
  });

  return (
    <LikeButton
      count={count}
      disabled={!user || mutation.isLoading} // 🦁 Désactive le bouton si isLoading est true
      onClick={() => {
        mutation.mutate(); // 🦁 Appelle la fonction onClick
      }}
      liked={liked}
    />
  );
};
