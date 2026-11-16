// The puzzles Little Detective draws from. Made once from the earlier lesson data; edit by hand from here on.
// Which one does not belong: three things from one group and one that is not.
export const ODD = [
{"group":"animals","others":["cat","dog","fish"],"odd":"car"},
{"group":"things we can eat","others":["apple","grape","cake"],"odd":"bus"},
{"group":"things in the sky","others":["sun","moon","star"],"odd":"shoe"},
{"group":"birds","others":["duck","hen","owl"],"odd":"car"},
{"group":"containers","others":["cup","mug","jar"],"odd":"frog"},
{"group":"animals that spend time in water","others":["fish","frog","duck"],"odd":"bus"},
{"group":"round things","others":["ball","coin","ring"],"odd":"dog"},
{"group":"things we wear","others":["sock","shoe","hat"],"odd":"apple"},
{"group":"sweet treats","others":["cake","cookie","pie"],"odd":"car"},
{"group":"birds","others":["bird","owl","hen"],"odd":"fish"},
{"group":"vehicles","others":["car","bus","bike"],"odd":"dog"},
{"group":"things in the sky","others":["sun","star","moon"],"odd":"cup"},
{"group":"animals","others":["dog","cat","pig"],"odd":"cake"},
{"group":"things that grow","others":["flower","tree","seed"],"odd":"car"},
{"group":"things we wear","others":["hat","shoe","sock"],"odd":"fish"},
{"group":"animals","others":["lion","zebra","goat"],"odd":"van"},
{"group":"things we can eat","others":["grape","apple","cake"],"odd":"owl"},
{"group":"things in the sky","others":["star","sun","moon"],"odd":"tree"},
{"group":"containers","others":["cup","jar","mug"],"odd":"pig"},
{"group":"vehicles","others":["car","bus","bike"],"odd":"cat"}
];
// What goes together, and why.
export const GOES = [
{"thing":"sock","partner":"shoe","others":["hat","cup"],"why":"We put socks inside shoes."},
{"thing":"bird","partner":"nest","others":["bone","lock"],"why":"A bird can make a nest for its eggs."},
{"thing":"dog","partner":"bone","others":["nest","key"],"why":"A dog can chew a suitable bone."},
{"thing":"key","partner":"lock","others":["shoe","nest"],"why":"A matching key opens a lock."},
{"thing":"toothbrush","partner":"toothpaste","others":["cup","sock"],"why":"We put toothpaste on a toothbrush."},
{"thing":"hen","partner":"egg","others":["sock","lock"],"why":"A hen lays eggs."},
{"thing":"rain","partner":"umbrella","others":["shoe","bone"],"why":"An umbrella helps keep us dry in the rain."},
{"thing":"cat","partner":"mouse","others":["nest","lock"],"why":"A cat may chase a mouse."},
{"thing":"fish","partner":"net","others":["bone","key"],"why":"A net can catch a fish."},
{"thing":"toe","partner":"sock","others":["cup","nest"],"why":"A sock covers our toes."},
{"thing":"seed","partner":"flower","others":["lock","cup"],"why":"With care, a flower seed can grow into a flower."},
{"thing":"cow","partner":"milk","others":["shoe","key"],"why":"Cows make milk for their calves."},
{"thing":"king","partner":"queen","others":["nest","sock"],"why":"A king and a queen are royal titles."},
{"thing":"rain","partner":"cloud","others":["shoe","cup"],"why":"Rain falls from clouds."},
{"thing":"car","partner":"key","others":["nest","bone"],"why":"A car key can unlock a car."},
{"thing":"moon","partner":"star","others":["cup","sock"],"why":"We can see the moon and stars in the sky."},
{"thing":"bird","partner":"egg","others":["lock","shoe"],"why":"Birds lay eggs."},
{"thing":"pig","partner":"mud","others":["cup","key"],"why":"Mud helps pigs cool down."},
{"thing":"fish","partner":"puddle","others":["shoe","lock"],"why":"Fish need water to breathe."}
];
// What happens next: a little story, what follows, and why.
export const NEXT = [
{"thing":"ice","story":"The ice is getting warm.","then":"puddle","others":["flower","star"],"why":"Warm ice melts into water."},
{"thing":"seed","story":"We plant a seed and give it water and light.","then":"flower","others":["puddle","rain"],"why":"A seed can sprout and grow into a plant."},
{"thing":"glass","story":"A glass falls onto a hard floor. What might happen?","then":"broken","others":["flower","star"],"why":"Glass can break when it hits a hard floor."},
{"thing":"cloud","story":"A dark rain cloud moves overhead. What might happen?","then":"rain","others":["flower","star"],"why":"Rain can fall from a cloud and collect in puddles."},
{"thing":"egg","story":"A baby chicken is ready to hatch.","then":"chick","others":["flower","rain"],"why":"A chick comes out of its egg."},
{"thing":"caterpillar","story":"The caterpillar makes a chrysalis. Later…","then":"butterfly","others":["flower","rain"],"why":"After changing inside a chrysalis, a butterfly emerges."},
{"thing":"rain","story":"Sunlight shines through raindrops. What might appear?","then":"rainbow","others":["star","broken"],"why":"Sunlight passing through raindrops can make a rainbow."},
{"thing":"chick","story":"The chick eats and grows for many weeks.","then":"hen","others":["star","broken"],"why":"A female chick grows into a hen."},
{"thing":"seed","story":"We plant a seed and give it water and light.","then":"sprout","others":["rain","star"],"why":"A seed can sprout and grow into a plant."},
{"thing":"cloud","story":"A dark rain cloud moves overhead. What might happen?","then":"puddle","others":["flower","star"],"why":"Rain can fall from a cloud and collect in puddles."},
{"thing":"sprout","story":"We care for this little flowering plant.","then":"flower","others":["broken","rain"],"why":"A sprout grows and can make flowers."}
];
// Stories that could not really happen, and why not.
export const SILLY = [
{"items":["fish","tree"],"story":"A fish grows on a tree.","why":"Fish hatch from eggs. They do not grow on trees."},
{"items":["car","cookie"],"story":"A car eats a cookie.","why":"Cars do not eat food."},
{"items":["tree","hat"],"story":"A tree walks to school.","why":"Trees have roots and cannot walk."},
{"items":["cup","egg"],"story":"A cup lays an egg.","why":"Birds lay eggs. Cups do not."},
{"items":["fish","book"],"story":"A fish reads a book.","why":"People read books. Fish cannot read."},
{"items":["apple","cloud"],"story":"An apple flies by flapping its wings.","why":"Apples have no wings."},
{"items":["elephant","cup"],"story":"A whole grown elephant fits inside a tea cup.","why":"A grown elephant is much bigger than a tea cup."},
{"items":["hat","cookie"],"story":"A child eats a hat for lunch.","why":"A hat is clothing, not food."},
{"items":["cloud","book"],"story":"A cloud turns the pages of a book.","why":"Clouds have no hands to turn pages."},
{"items":["dog","car"],"story":"A dog drives a car by itself.","why":"A dog cannot drive a real car."},
{"items":["ice","flower"],"story":"An ice cube grows roots and flowers.","why":"Ice is frozen water, not a plant."},
{"items":["fish","tree"],"story":"A fish climbs a tree using hands.","why":"Fish have fins, not hands."},
{"items":["cookie","egg"],"story":"A cookie hatches from a chicken egg.","why":"A chick can hatch from a chicken egg."},
{"items":["book","apple"],"story":"A book takes a bite of an apple.","why":"A book has pages, not a mouth."},
{"items":["cup","tree"],"story":"A tea cup grows into a tree.","why":"Trees can grow from seeds. A tea cup cannot."},
{"items":["car","flower"],"story":"A car drinks nectar like a butterfly.","why":"Cars cannot drink nectar."},
{"items":["apple","ball"],"story":"An apple bounces itself to the park.","why":"An apple cannot move itself to the park."},
{"items":["fish","car"],"story":"A fish drives a car on the road.","why":"Fish cannot drive real cars."},
{"items":["egg","book"],"story":"An egg reads a bedtime story aloud.","why":"An egg cannot speak or read."},
{"items":["elephant","flower"],"story":"An elephant is smaller than a tiny flower.","why":"A real elephant is much bigger than a tiny flower."}
];
// Ordinary stories to set beside a silly one.
export const NORMAL = [
{"items":["dog","ball"],"story":"A dog plays with a ball."},
{"items":["seed","flower"],"story":"A seed grows into a flower."},
{"items":["hat"],"story":"A child wears a hat."},
{"items":["book"],"story":"A grown-up reads a book."},
{"items":["apple"],"story":"A child eats an apple."},
{"items":["egg"],"story":"A hen lays an egg."}
];
// Things that happen in order.
export const ORDER = [["seed","sprout","flower"],["egg","chick","hen"],["cloud","rain","rainbow"],["egg","caterpillar","butterfly"],["seed","sprout","tree"],["cloud","rain","puddle"]];
// Pictures for things with no clay model.
export const PICTURES = {"bike":"🚲","bird":"🐦","bone":"🦴","broken":"🧨","bus":"🚌","butterfly":"🦋","cake":"🍰","caterpillar":"🐛","chick":"🐥","coin":"🪙","cow":"🐄","glass":"🥛","goat":"🐐","grape":"🍇","hen":"🐔","jar":"🏺","key":"🔑","king":"🤴","lock":"🔒","milk":"🥛","moon":"🌙","mouse":"🐭","mud":"🟫","mug":"☕","nest":"🪹","net":"🥅","pie":"🥧","pig":"🐷","puddle":"🌊","queen":"👑","rain":"🌧","rainbow":"🌈","ring":"💍","shoe":"👟","sock":"🧦","star":"⭐","sun":"☀️","toe":"🦶","toothbrush":"🪥","toothpaste":"🧴","umbrella":"☂️","van":"🚐","zebra":"🦓"};
