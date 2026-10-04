# 3D model credits

## robot-expressive.glb — SWEAT scene gym buddy

- **Model:** "RobotExpressive" by Tomás Laulhé ([Quaternius](https://quaternius.com)), with facial-expression
  morph targets (Angry / Surprised / Sad) added by [Don McCurdy](https://donmccurdy.com/).
- **Source:** https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive
  (downloaded unmodified from `examples/models/gltf/RobotExpressive/RobotExpressive.glb`, 464 KB).
- **Licence:** [CC0 1.0 Universal (public domain)](https://creativecommons.org/publicdomain/zero/1.0/) — free to use,
  modify and redistribute, no attribution required (credited here anyway). Consider supporting the creator:
  https://www.patreon.com/quaternius
- **Clips used:** Idle, Wave (ringing), ThumbsUp (VENT starts talking), No (error). The jumping jacks are procedural
  (bones rotated in code in `src/components/scenes/sweat/gym-bot.ts`), and the materials are recoloured at runtime
  (cobalt shell, hot-pink sweatband and wristbands).

## gym-bot-cover.png

A still render of the model above (mid jumping-jack), made with the same `gym-bot.ts` renderer in headless Chromium
and saved with a transparent background. Same CC0 licence.
