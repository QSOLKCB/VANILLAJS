# Make your first moving scene

Serve the checkout with `python3 -m http.server 8000 --bind 127.0.0.1` from the
repository root. Open `http://127.0.0.1:8000/demos/tutorial-lab/`.

1. Select **Load Playground / restart lesson**. The orange box is your player.
2. Enter a positive speed different from the starter, for example **6**. Select
   **Apply speed**, then **Test one second walking right**.
3. Read the measured distance and inspect the final position. The test runs 60
   actual Workbench physics steps, including collision; it does not just move
   a decorative drawing. There is no claim that a one-second test proves a game.
4. Select **Try a zero-speed player**. Read the creator-check diagnostic. Testing
   now refuses the scene because the player cannot move.
5. Apply **6** again and test. Once the changed scene has been tested and the
   zero-speed problem repaired, **Download editable project** becomes available.
6. Keep `first-scene.vproject.json`. Open the [Workbench](../demos/editor/index.html)
   and use **Open project** to load it. Select Play; use WASD and Space. Stop
   before editing more objects. **Save project** keeps those edits.

The lesson uses the existing Playground recipe, v2 components, fixed-step Forge
preview and renderer. `collision` supplies reusable swept box contacts; controller
speed and lesson progression belong to the Workbench/tutorial, not a new engine API.

Restart clears lesson progress and restores the starter. Changing a value after a
test invalidates that test. Navigation to a specialist lab never counts as completing
its tutorial. The controls work with Tab and Enter, and status text describes the
result without requiring interpretation of the canvas.

The download contains scene data and an empty asset library. It contains no engine,
code, licence bundle, scoring, missions or audio. [Package its preview](HOW_TO_EXPORT_A_GAME.md)
to include runtime and notices, or continue with [your own game](HOW_TO_BUILD_A_GAME.md).
