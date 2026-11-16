# Little Detective

Viaan's thinking puzzles, as a game: twelve cases in three lands. The early stops teach
one kind of puzzle each; the cases mix them.

- **Odd one out**: four things, three from one group.
- **Patterns**: a line of pictures that repeats; made fresh every time at three levels
  (AB, then AAB/ABB/ABC, then four-part units). The repeating part is always shown twice,
  so the next picture is certain.
- **Goes together**, **What happens next?**: one right picture of three, with the reason
  spoken afterwards.
- **That's silly!**: three little stories; tap each to hear it, then say which could
  not really happen.
- **Put in order**: tap three pictures in the order they happen.

`cases.js` holds the puzzles (made once from the earlier lesson data, with repeats
removed); `rules.js` the stops and round maker; `game.js` and `style.css` the six task
screens. Everything else is `../play-kit`. Visits are saved in `viaan-detective-v1`.
Run `node --test little-detective/*.test.mjs`.
