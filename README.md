## Inspiration
We wanted to **push** the boundaries of what Storyblok can do. Most people use it for websites, blogs, or content-driven apps , but we asked ourselves:

**“What if Storyblok could power an actual game engine?”**

Our goal was to see how far we could stretch Storyblok’s flexible schema and content blocks. Instead of just managing text or media, we imagined it as a **level editor**, where backgrounds, enemies, music, and HUD elements could be **created** and **rearranged** as easily as writing a blog post.

At the same time, we wanted to make **level design accessible**. Developers often hard-code levels and mechanics, but we believed that with Storyblok, anyone like artists, teachers, writers, even non-coders should be able to design a game world simply by **dragging, dropping, and editing** blocks in the CMS dashboard.

That drive to make **game creation** as easy as **content editing** was what inspired us to build gameBlok.

## What it does

**GameBlok** turns **Storyblok** into a **game engine**. Instead of hardcoding every level, background, or enemy, our system **pulls all of this from Storyblok’s CMS** and **renders it live** in the game.

Here’s what it enables:

• **Level Design in the CMS –** _Levels_ are created as _content types_. Designers can _add_ blocks, enemies, coins, and HUD elements _directly_ from the Storyblok dashboard.
![Alt text](https://i.imgur.com/0hu2obB.png)

• **Dynamic Assets –** Background images, character sprites, and even music tracks are _stored_ in Storyblok as _assets_. Swapping a sprite or soundtrack is as _simple_ as uploading a new file.
![Alt text](https://i.imgur.com/uhbsgzk.png)

• **Customizable Gameplay –** Enemies, blocks, and coins are defined as _reusable components_ with their _own properties_ (movement patterns, textures, collision). This allows _flexible level design without touching code_.
![Alt text](https://i.imgur.com/oorQKEr.png)

• **Structured HUD & Text –** On-screen instructions, scores, and labels are _editable inside Storyblok_, giving _non-developers control_ over the game interface.
![Alt text](https://i.imgur.com/nrD9OuN.png)

• **Instant Updates –** Any _change_ made in Storyblok like adding a new platform, changing the background, or adjusting music — is _reflected immediately_ in the frontend React game.
![Alt text](https://i.imgur.com/MZZwHAH.png)

In short, **GameBlok** makes building a game as _easy_ as _editing content in a CMS_, _empowering creators_ to design, update, and play their own worlds one blok at a time.


## How we built it
We built GameBlok by blending Storyblok’s headless CMS with a React-powered frontend that interprets content as gameplay elements. Our process unfolded in several key steps:

**1. Modeling the Schema in Storyblok :**
![Alt text](https://i.imgur.com/XnQX7Fg.png)


• Defined _levels_ as _content types_.

• Added block fields for maps, enemies, coins, and overlays.

• Created _custom components_ like Block, Enemy, Coin, and Text to represent game objects.

• Uploaded assets (backgrounds, sprites, and music) into Storyblok’s media library.

• Used whitelisting to restrict block types in certain fields, keeping the schema structured and user-friendly.
![Alt text](https://i.imgur.com/OdsEqcC.png)


**2. Building the React Frontend :**

• The frontend fetches content using the _Storyblok API_.


```  
useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await storyblokApi.get("cdn/stories/game", { version: "published" });
        const content = res?.data?.story?.content || {};
        const levelBlocks = Array.isArray(content?.level) ? content.level : [];
        const built = [];
        for (let i = 0; i < levelBlocks.length; i++) {
          const blk = levelBlocks[i];
          const title = blk?.Title || Level ${i + 1};
          const { grid: parsedMap, spawn } = parseGridWithSpawn(blk?.map);
          const coin = parseGridSmart(blk?.coin_map);
          
          const rawTheme = typeof blk?.theme === "string" ? blk.theme.trim() : "";
          const lowered = rawTheme.toLowerCase();
          const isDefaultTheme = !rawTheme || lowered === "default";
          const levelPrimary = !isDefaultTheme ? normalizeHex(rawTheme) : null;

          const tileURL = blk?.tiles?.filename || "";
          const tileImg = await loadImage(tileURL);
          
          const overlayURL = blk?.overlay?.filename || "";
          const overlay = overlayURL ? overlayURL : null;

          built.push({
            title,
            map: parsedMap,
            coin,
            tileImg,
            levelPrimary,
            spawn,
            useDefaultTheme: isDefaultTheme || !levelPrimary,
            overlay,
          });
        }

        if (!built.length) {
          built.push({
            title: "Level 1",
            map: makeGrid(DEFAULT_ROWS, DEFAULT_COLS, 0),
            coin: makeGrid(DEFAULT_ROWS, DEFAULT_COLS, 0),
            tileImg: null,
            levelPrimary: null,
            spawn: { r: 6, c: 1 },
            useDefaultTheme: true,
            overlay: null,
          });
        }

        if (cancelled) return;
        levelsRef.current = built;
        loadLevelIndex(0);

        const enemyAsset = (content?.assets || []).find((asset) => asset?.component === "enemy");
        if (enemyAsset?.sprite?.filename) {
          const sprite = await loadImage(enemyAsset.sprite.filename);
          if (!cancelled) enemySpriteRef.current = sprite;
        } else if (!cancelled) {
          enemySpriteRef.current = null;
        }

        // coin frames
        const frames = (content?.assets?.[0]?.frames ?? []).map(f => f.filename);
        const sorted = frames.slice().sort((a, b) => {
          const na = parseInt((a.split("/").pop() || "").replace(".png", ""), 10);
          const nb = parseInt((b.split("/").pop() || "").replace(".png", ""), 10);
          return (isNaN(na) ? 0 : na) - (isNaN(nb) ? 0 : nb);
        });
        if (sorted.length) {
          const imgs = await Promise.all(sorted.map(url => loadImage(url)));
          const drawable = imgs.filter(isDrawableImage);
          if (!cancelled) {
            setCoinFrames(drawable);
            setCoinReady(drawable.length > 0);
          }
        } else if (!cancelled) {
          setCoinFrames([]);
          setCoinReady(false);
        }
            
      } catch (e) {
        console.error("Storyblok load error:", e);
        levelsRef.current = [{
          title: "Level 1",
          map: makeGrid(DEFAULT_ROWS, DEFAULT_COLS, 0),
          coin: makeGrid(DEFAULT_ROWS, DEFAULT_COLS, 0),
          tileImg: null,
          levelPrimary: null,
          spawn: { r: 6, c: 1 },
          useDefaultTheme: true,
          overlay: null,
        }];
        enemySpriteRef.current = null;
        loadLevelIndex(0);
      }
    })();
    return () => { cancelled = true; clearTimeout(passTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyblokApi]);
```

• Each Storyblok component _maps_ to a React component .

• TailwindCSS styles the HUD and UI elements.

• Framer Motion animates transitions and effects for smoother gameplay.


**3. Implementing Game Logic :**

• JavaScript handles collisions, gravity, and movement.
```
if (phase === "play") {
        const accel = P.speed;
        let targetVX = 0;
        if (keys.current.left) targetVX -= accel;
        if (keys.current.right) targetVX += accel;
        P.vx = targetVX * dt;
        P.vy += gravity * dt; if (P.vy > maxFall) P.vy = maxFall;

        const solved = rectVsWorld({ x: P.x, y: P.y, w: P.w, h: P.h, vx: P.vx, vy: P.vy * dt });
        P.x = solved.x; P.y = solved.y; P.vx = solved.vx; P.vy = solved.vy / dt; P.onGround = solved.onGround;
        if (P.onGround) P.vx *= friction;
      }
```

• Properties like collidable or enemy behavior are read directly from Storyblok.

• Levels progress using Storyblok references, linking blocks together.


**4. Integrating Assets and Music :**

• Background images and textures are pulled directly from Storyblok’s asset library.

• Music tracks are stored as audio assets, allowing instant soundtrack changes from the CMS.

• Asset swaps require no code changes — just an update in Storyblok.


**5. Iteration and Testing :**

• Tested gameplay by editing content in the Storyblok dashboard and instantly seeing results in React.

• Verified block ordering, enemy behaviors, and level progression.

• Refined schema design to balance flexibility with simplicity for non-developers.

The outcome: A system where Storyblok becomes a level editor, letting creators design and modify a fully playable game without touching code.

## Challenges we ran into 

**1. Mapping CMS Concepts to Game Logic :**
Storyblok is designed for _content management_, not _game mechanics_. One of our biggest challenges was figuring out how to translate content types and block fields into playable game elements (like platforms, enemies, and coins) without overcomplicating the schema. We had to balance flexibility (letting creators experiment) with structure (preventing invalid game states).

**2. Asset Integration and Performance :**
Handling images, sprites, and music from Storyblok introduced performance issues. We faced caching delays and load times, especially when swapping out larger assets mid-game. Getting assets to load seamlessly in the frontend required extra optimization.

**3. Music and Audio Handling :**
Unlike backgrounds or sprites, music assets introduced new complexity. Syncing background music with scene changes and ensuring smooth transitions was tricky. We had to carefully design how audio was referenced in Storyblok to avoid interruptions.

**4. Schema Complexity vs Simplicity :**
We wanted a schema that was powerful enough for developers but intuitive for non-coders. Early versions of the schema became too complex, with too many nested blocks. Simplifying it while still keeping all essential functionality (enemies, coins, overlays, music) was a real design challenge.

## Accomplishments that we're proud of

**1. Turning Storyblok into a Game Engine :**
We successfully showed that Storyblok can power more than websites — it can actually be used as a game engine. By mapping content types and blocks to levels, assets, and enemies, we transformed a CMS into a playable, interactive system.

**2. Making Level Design Easy for Everyone :**
We built a workflow where non-developers can design levels. Artists, teachers, or storytellers can log into Storyblok, upload sprites and music, drag-and-drop blocks, and instantly create a playable world — no coding required.

**3. Creating a Flexible but Structured Schema :**
We designed a schema that balances flexibility with control. By whitelisting valid blocks and defining clear custom components, we prevented schema chaos while still allowing creativity. This gives creators freedom without overwhelming them.

**4. Building a Full CMS-Driven Game in Hackathon Time :**
In just a short hackathon timeframe, we went from idea → schema → React engine → playable game. We proved that it’s possible to rapidly prototype a CMS-driven game that feels both functional and fun.

## What we learned

**1. Storyblok is More Versatile Than We Imagined :**
We discovered that Storyblok’s content types, block fields, and assets aren’t limited to web pages. They can map directly to game structures like levels, enemies, and even music. This showed us the potential of using a headless CMS as a creative tool beyond traditional websites.

**2. Level Design Can Be Simplified for Non-Developers :**
By using Storyblok as the level editor, we learned that game design doesn’t have to be locked behind code. Writers, artists, and teachers could design worlds simply by editing blocks in a CMS dashboard. This opened our eyes to the idea of accessible game creation.

**3. Importance of Schema Design :**
We realized how important schema design is. Too many nested blocks overwhelm creators, while too little flexibility limits creativity. Finding the right balance between power and simplicity was one of our biggest takeaways.

**4. Asset and Music Integration is Key :**
We learned how valuable it is to treat music and visuals as assets in the CMS. By pulling backgrounds, sprites, and soundtracks directly from Storyblok, we made content changes effortless. This taught us the value of CMS-driven dynamic asset pipelines.

**5. Building Fast, Learning Faster :**
Working within hackathon time constraints forced us to prioritize what mattered most. We learned how to prototype rapidly, validate ideas quickly, and adapt the schema and frontend as we went.

## What's next for GameBlok

**1. More Advanced Game Mechanics :**
Right now, GameBlok supports basic blocks, enemies, coins, and music. Next, we want to introduce:

• Power-ups and collectibles with special effects

• Boss characters with unique behaviors

• Advanced enemy AI (patrolling, chasing, jumping)

• Physics-based mechanics for more dynamic gameplay

**2. Visual Level Editor :**
While Storyblok’s CMS dashboard works well, we want to build a drag-and-drop visual level editor integrated with Storyblok. This would allow creators to design levels visually (placing blocks and enemies on a grid) while still saving everything back into Storyblok as structured content.
![Alt text](https://i.imgur.com/0BuZI0a.png)

**3. Multiplayer & Collaboration :**
Game creation should be social. We want to explore:

• Multiplayer modes where players can compete or co-op in Storyblok-powered worlds

• Collaboration tools so multiple creators can design levels together in the same space

**4. Templates & Presets :**
We plan to add ready-made templates and presets (like “forest world” or “space world”) with pre-configured assets, music, and enemies. This lowers the barrier to entry for new creators.

**5. Broader Use Cases :**
We see GameBlok being used not just for fun games, but also for:

•  Education – teachers designing interactive math or language games directly in Storyblok

•  Storytelling – creators blending narrative with gameplay, similar to visual novels but more interactive

•  Community-driven games – where anyone can log into Storyblok and contribute levels

**6. Scaling & Optimization :**
To prepare for real-world use, we want to:

• Improve asset caching and loading for smoother gameplay

• Optimize schema design further for large-scale games

• Explore Storyblok’s APIs for real-time updates


**In short:** GameBlok started as a hackathon experiment, but we see it growing into a full CMS-powered game creation platform — where anyone can build, play, and share games, one blok at a time.
