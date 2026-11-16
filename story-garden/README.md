# Story Garden

Viaan's English, as a game. It plays through the same phonics course as the lessons it
replaced: forty weeks in six phases, in the order the sounds are taught, with the same
114 words and the same recordings. One stop a week; each stop is a plant that goes from
seed to sprout to flower as it is visited.

## The games

A visit is five tasks mixed from what that week teaches (`planFor` in `rules.js`):

- **Hear**: a recorded sound or tricky word plays; tap the letters that say it. In the
  first weeks, also a picture to find the starting sound of.
- **Read**: a word shown as sound tiles, which can be tapped to hear each sound. Tap its
  picture. The whole word is only spoken after a miss or when it is right.
- **Build**: hear a word and build it from sound tiles in order; the caterpillar grows a
  part for each sound. Two or three spare tiles are never sounds from the word.
- **Story**: finish a sentence with the word that makes sense; then it is read aloud.
- **Rhyme**: tap cards to hear them, then choose the one that rhymes.

Wrong choices and review come only from what has already been met (`known`). When the
task is only to listen, two spellings of one sound are never set against each other.

## Files

- `words.js`: the course (`WEEKS`, `PHASES`) and emoji pictures for words with no clay
  model. Made once from the earlier lesson data; edited by hand from here on.
- `rules.js`: stops, task makers and clip names. Runs in Node.
- `game.js`, `style.css`: the five task screens. Everything else is `../play-kit`.

Visits are saved in `viaan-story-v1`. Run `node --test story-garden/*.test.mjs`: the
tests check the course is intact, every sound and word has its recording, and hundreds
of rounds for every week have one right answer among different choices.
