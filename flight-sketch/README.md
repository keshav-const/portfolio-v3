# Flight sketch (throwaway)

A disposable 3D prototype for judging flight feel. It is not production code, it is not part of
`portfolio-v3`, and approving it is not approval to build the real universe.

## Run it

    cd flight-sketch
    python3 serve.py

`serve.py` turns off browser caching, so a normal reload always picks up the latest files.
(`python3 -m http.server 8123` also works, but then use a hard reload: Cmd+Shift+R.)

Open http://localhost:8123 in Chrome, Edge or Safari. An internet connection is needed the first time
(Three.js and the fonts load from CDNs).

## Controls

| Key | Action |
|---|---|
| W / S | Throttle up / down |
| A / D | Yaw |
| ↑ / ↓ or drag | Pitch |
| Q / E | Roll |
| Space | Brake |
| 1 2 3 4 | Speed level: Manoeuvre, Cruise (default), Fast, Warp |
| Click a marker | Set a course to that world |
| Esc | Cancel course |
| H | Fly back to Mission Control and dock automatically |
| C | Cockpit / chase view |
| V | Inspect: orbit the vessel, any world or Mission Control (drag to turn, scroll to zoom, Tab for next) |
| U | Undock (or press W, or click a world while docked) |
| I | Go inside Mission Control while docked (walk with W A S D, drag to look, E at the hatch to leave) |
| G | In orbit: send the lander down. Near Mission Control: dock automatically |
| O | Show or hide the orbit paths |
| P | Graphics: Auto, Low, Medium, High (also the button top right; remembered) |

Flying the lander on a surface:

| Key | Action |
|---|---|
| W / S | Forward / back (the lander tilts its thrust) |
| A / D | Turn |
| ← / → | Sideways |
| Space / Shift | Climb / descend (hold Shift to settle and land) |
| R | Boost |
| E | Step outside (once landed) |
| T | Back to orbit |
| M | Place labels on/off |

On foot: W A S D walk, Shift run (on Cosmos you lope), Space jump, drag to look, scroll to zoom, E board the lander,
B back to the lander from anywhere, T straight back to orbit. The same actions are buttons under the readouts.

The rover: unloaded beside the lander when you first step out. E next to it to drive, E again to get out (once slow).
W / S drive and reverse, A D (or ← →) steer, Shift fast (72 km/h), Space brake. F calls it to you if you have left
it behind. Six metal wheels on rocker-bogie suspension, each reaching for the ground under it.
- Grip is friction against gravity: on Ekatva it holds the road and climbs steep slopes; on Cosmos it slides in
  turns, pulls away slowly and flies off crests.
- Wind pushes on its side (and turns it a little); a head wind slows it.
- Rocks lower than about 0.75 m are driven over (the wheels ride up them); bigger rocks and trees are hit: you lose
  most of the speed, bounce back and the body shakes.
- Water (Ekatva's river and seas): it wades through shallows, slowing with depth and throwing spray; past 1.1 m it
  floats, paddles at walking pace and drifts with the current. The river banks are too steep to climb out of, so
  cross at one of the three fords (labelled), or float down to one. On foot you wade, then swim.

Water is one shaded plane: ripples flow with the river, colour deepens with depth, the sky and sun reflect at low
angles, shores fade out with foam, and anything moving through it leaves a wake.

The panel under the readouts counts down to the next sunset and sunrise at the landing site (worked out by running the
planet's spin and orbit forward), with the length of daylight and dark; the dial shows where the sun is in the day.

Docking yourself: fly toward the berth on the front of the station. Within 3 km a guide appears (range, closing speed, distance off the axis, nose angle). Speed is limited near the station, an assist holds you on the axis once your nose is on the berth, and the vessel is captured inside about 70 m.
| N | Sound: Vacuum, Ambience, Music (display only), Off |
| L | Luna: compact, expanded, minimized, hidden |

On a phone or tablet, the on-screen controls change with what you are doing (touch.js). They are laid out like a game:
- **Stick:** put your thumb down anywhere in the lower left and a stick appears under it.
- **Look:** drag anywhere else to look around; pinch to zoom.
- **Right thumb:** a big round button and smaller ones around it.
- **Main action:** what you can do right now (Get in, Get out, Step out, Undock) shows as one large button above them.

The controls switch on with the first touch, including when the desktop browser switches to device emulation after loading. They hide again when a mouse is used. Add `?touch` to force them on, or `?notouch` to turn them off.

| Mode | Stick (left) | Right side | Actions (top right) |
|---|---|---|---|
| Docked | — | — | Undock, Go inside; ··· for views, sound, graphics |
| Flying | steer (yaw, pitch) | throttle slider; Brake, Roll ◁ ▷ held | Dock (near the station) or Mission Control, Cancel course |
| Travelling | — | — | Cancel course |
| In orbit | — | — | Land, Leave orbit, Mission Control |
| Inspect | — | — | Next, Zoom + / −, Back to flight (and pinch to zoom) |
| Lander | fly | Up, Down, Boost held | Step out, Leave the planet |
| On foot | move | Jump; Sprint (tap to latch) | Get in (rover) / Board the lander, Call the rover, To the lander |
| Driving | drive and steer | Brake held; Boost (tap to latch) | Get out, To the lander |
| Inside | walk | Sprint (tap to latch) | Back to the vessel |

One finger on the view looks around (or steers in flight); two fingers pinch to zoom. Tap a marker to set a course;
the speed levels stay at the top left. The stick is analog.

## Graphics levels and performance

Auto picks a level from the device (phones and integrated graphics: Low; Apple M-series: Medium; M Pro/Max and
discrete GPUs: High), then keeps the frame rate up: it lowers the resolution when frames run long, raises it again
when there is room, and drops a whole level if the lowest resolution of a level is still too slow. The button shows
the live frame rate.

| | Low | Medium | High |
|---|---|---|---|
| Resolution (× screen pixels) | 0.6–1 | 0.75–1.5 | 1–2 |
| Anti-aliasing (MSAA) | off | 4× | 4× |
| Bloom | off | half resolution | full |
| Shadows | off | 1024 | 2048, soft |
| Planet maps (per cube face) | 512 | 768 | 1024 |
| Grass reach / spacing | 24 m / 0.6 m | 34 m / 0.5 m | 46 m / 0.42 m |
| Trees and rocks drawn to | 480 m | 800 m | 1150 m |
| Ground detail | 5×5 chunks, no fine relief | 7×7, relief to 170 m | 7×7, relief to 260 m |

What changed to make it smooth:
- The planets are rendered once at load into cube maps (colour, relief normals, night lights, clouds) and only
  sampled afterwards. Before, each pixel of a planet ran over a hundred noise functions every frame.
- The surfaces have their own renderer without the logarithmic depth buffer space needs. That buffer turns off the
  GPU's early depth test, which made every blade of grass and leaf cost full shading even when hidden.
- Terrain chunks and tree/rock placement are computed in a background worker (terrain-worker.js, using the pure-JS
  fields.js and noise.js), so moving never stalls a frame. Heights for physics come from the loaded map.
- Trees and rocks have three levels of detail; only the nearest cast shadows. Models are indexed (about 6× fewer
  vertices than before).
- You land once the ground, plants and shaders are ready, behind the fade, instead of watching them pop in.

## What is in it

- Three vessel designs (A Survey, B Lancet, C Courier), chosen at Mission Control, built with detailed parts: foil insulation, truss, tanks, radiators, solar arrays, antennas, thrusters and lights.
- Mission Control: a large station with a rotating habitat wheel, lit windows, docking ports and solar arrays.
- Docking: the vessel starts berthed. Undocking releases it, backs it out and turns it; returning flies a final approach along the docking axis and latches.
- Thrusters: every steering nozzle fires only when its push is needed (turning, docking, braking); the main engine glows with actual acceleration.
- Bloom, self-shadowing, reflections and a light cast by the nearest planet. Graphics levels and adaptive resolution (below).
- Four procedural worlds with atmosphere, clouds and day/night; The Arena has auroras and floodlit grounds on its night side.
- Journeys: about 30 s at Cruise, 9 s Fast, 1.6 s Warp. Arrival leads into a slow orbit.
- Luna: the lit side grows with the song's progress (a demo timer, no Spotify connection); the ring shows journey progress.
- Synthesised cabin sound, starting when you board.
- Each surface has its own soundscape (ambience.js), synthesised with Web Audio, with no recordings. Wind comes in random gusts. Apart from birds, nothing is struck or pitched: the worlds are made of air, grit and water.
  - **Technova:** a dry, high wind with its low weight under it; grit skating over the basalt; gravel slipping on slopes. Near the installations: the rumble of plant and its venting.
  - **Ekatva:** leaves and grass; the river, louder as you near it and panned toward it, with spray at the fords; birds by day; insects and croaks by night.
  - **The Arena:** wind through the grass; crowds from the grounds; cheers, sometimes after the crack of a bat; the stands clapping in time; larks by day; crickets and floodlight hum at night.
  - **Cosmos:** mostly your suit, its fan and your breathing. Also a wisp of thin wind, frost fizzing in the sun, ice settling in long low swells, and the Observatory's servos.
  - **The rover:** motor whine that rises with speed, wheel crunch, and splashing in water.
- **First or third person (C):** on foot, in the rover and in the lander. Scrolling all the way in also switches to first person, and scrolling out switches back. On touch screens a "1st person / 3rd person" chip does the same.
  - On foot you see through the helmet, with a slight bob as you walk.
  - In the rover you sit in the driver's seat behind the console.
  - In the lander you look out of the front window, tipped down toward the ground.
- Time keeps running while you are away. A browser stops drawing a tab you are not looking at; on your return, the planets, their spin and the sun move on by the real time that passed. Only the system moves on; you are not.
- The planets orbit the star on tilted orbits (4° to 17°), each with its own year, and turn on tilted axes. Sunrise to sunrise takes 20 minutes on Technova, 30 on Ekatva, 40 on The Arena and 25 on Cosmos. Years run from one to two hours. Day and night on a surface come from that: you land under the vessel, so you arrive in the local time there, and the sun moves across the sky as the planet turns.
- Planets differ in size, shape (oval Technova with a moon, flattened Arena, ringed Cosmos), gravity (0.24 g to 1.08 g), air and wind.
- The star stands for you: granulation, spots, prominences and a corona, with an "about you" card (placeholders) while you orbit it. Too hot to land.
- Surfaces are 12 km across, streamed around you: detailed ground near you, a coarse skirt to the horizon, grass, flowers, trees and rocks, and a large landmark on each world (the Foundry, the Amphitheatre, the Grand Arena, the Great Telescope).
- The lander flies: the same engine on every world, so thrust against gravity, the air's drag and the wind make each one handle differently. Legs have springs; touchdowns are measured.
- The astronaut has a jointed suit, walks, runs, jumps, slides on low-gravity ground and lopes on Cosmos. Helmet lamps and lander headlights come on at night.
- Mission Control has an inside: the Great Chart room, with an orrery and windows onto the real station.

## Not in it yet

Real content in the places you visit, real music, Spotify. Not yet measured on real phones.

## Screenshot presets

`?shot=surface-arena&landed&sun=-12` (sun height in degrees; `&walk` to step out, `&fly=30` to hover), `system`, `starclose`, `undock`, `approach`, `rcs`, `inspect-arena`, `planet-ekatva`, `planet-arena`, `night-arena`, `planet-technova`, `planet-cosmos`, `cockpit`, `warp`, `design-0` … `design-2`, `mc`.

Test parameters: `&q=low|medium|high` forces a graphics level; `&bake=64` uses small planet maps (fast in software
rendering); `&touch` shows the touch controls; `&errors` shows script errors on the page.
