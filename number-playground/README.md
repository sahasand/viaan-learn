# Number Playground

Viaan's math, as a game. It replaces the old five-question math lessons: here the
playing is the maths. A path of 26 stops runs through three lands, and each stop is one
of six games at one difficulty. Every visit sets fresh numbers, so nothing can be
learned by heart.

## Play locally

From the repository root run `python3 -m http.server 8765` and open
`http://127.0.0.1:8765/number-playground/`. The home page's Number Playground card and
the Daily Adventure's math stop both open it. No build step and no network service.

## The games

- **Feed** (count out a set): a friend asks for a number of apples, cookies or fish.
  Tap food onto the plate, each one counted aloud, then feed. Too few or too many gets
  "That is 3. Bear wants 4." and another go.
- **Pop** (read numbers, count on, count back, skip count): pop the balloon with the
  number asked for, or pop a whole sequence in order: 1 to 5, 1 to 10, 11 to 20, the
  rocket countdown from 10, and counting by 2s, 5s and 10s.
- **More** (compare): two friends with two piles, or two number cards. Who has more,
  or fewer? There is never a tie.
- **Domino** (add): how many dots altogether? Tapping the dots counts them aloud.
  Includes a doubles stop.
- **Hop** (add and take away on a number line): the frog hops forward or back; tap the
  lily pad where it lands. In Catch the fly, choose how many hops reach the fly.
- **Bowl** (take away): roll the ball, then say how many pins are still standing.
  Tapping pins counts them. A strike leaves zero.

## Rewards

Every finished task earns a star, and one more when it was right first time. A wrong
try is never punished: a boing, a hint, and the task stays open. There is no timer,
no score to lose and no way to fail. Stops open one after another and stay open for
replay. Ten stars hatch a surprise egg (tap it three times), which always holds a
sticker not yet found: eleven animal friends and sixteen toys. Animals that have
hatched take turns in the Feed and More games.

## Files

- `rules.js`: the path (`LANDS`, `STOPS`), task makers for every game and answer checks.
  Plain data, runs in Node.
- `game.js`, `style.css`: the six task screens.
- The map, stars, eggs, sticker book, speech and sound are shared with the other
  learning games: see `../play-kit/README.md`. Numbers are spoken from the recorded clips
  in `../audio/num_*.mp3` when one exists, otherwise by the device voice.

## Saving

`viaan-numbers-v1` holds `{ done: { stopId: visits }, next }`. Stars and stickers are
shared with the other learning games in `viaan-rewards-v1`. `next` is the title of the
next stop, which the home page shows without loading the game. When the page is opened with `?adventure=1` and today's
Daily Adventure (kept in the curriculum's `vla4`) is waiting at its math stop, finishing
a visit moves the adventure on by one.

## Checks

```sh
node --test number-playground/*.test.mjs
```

Tests make hundreds of rounds for every stop and check ranges, answers, sequences, no
ties and no repeated task. Stars, eggs and the adventure hand-off are tested in
`../play-kit`. In a browser, play one visit of each game with a wrong
try and a right one, hatch an egg, open the sticker book, and check a phone both ways up.
`window.playground` exposes the rewards, visits, current task and `startStop(id)`.
