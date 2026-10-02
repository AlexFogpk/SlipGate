# Звуки

Все записанные звуки взяты из бесплатных наборов под лицензией **CC0** (общественное достояние):
их можно использовать, менять и распространять без ограничений и без указания авторства.
Тем не менее перечисляем авторов — спасибо им.

| Набор | Автор | Где взят | Для каких звуков |
|---|---|---|---|
| Sci-fi Sounds | Kenney | https://kenney.nl/assets/sci-fi-sounds | burn, chainsaw, charge, crush, door, explode, fireball, jumppad, laser, lift, lightning, powerup, shield, zap |
| Impact Sounds | Kenney | https://kenney.nl/assets/impact-sounds | armor, axehit, bounce, crush, grenade, land, ric |
| RPG Audio | Kenney | https://kenney.nl/assets/rpg-audio | armor, axe, pickup, sword |
| Interface Sounds | Kenney | https://kenney.nl/assets/interface-sounds | health, menu, menuok, noammo, tick |
| Digital Audio | Kenney | https://kenney.nl/assets/digital-audio | charge, jumppad, powerdown, powerup, teleport, zap, zapsmall |
| 80 CC0 creature SFX | rubberduck | https://opengameart.org/content/80-cc0-creature-sfx | bark, gasp, mpain, sight, spit |
| 80 CC0 creature SFX #2 | rubberduck | https://opengameart.org/content/80-cc0-creture-sfx-2 | mdeath, mpain, sight |
| 25 CC0 bang / firework SFX | rubberduck | https://opengameart.org/content/25-cc0-bang-firework-sfx | explode, grenade, nail, rocket, sshotgun |
| 40 CC0 water / splash / slime SFX | rubberduck | https://opengameart.org/content/40-cc0-water-splash-slime-sfx | gib, gurgle, health, splash, splat |
| 100 CC0 SFX | rubberduck | https://opengameart.org/content/100-cc0-sfx | button, chainsaw, checkpoint, crush, door, key, lift, secret |
| 50 CC0 Sci-Fi SFX | rubberduck | https://opengameart.org/content/50-cc0-sci-fi-sfx | rocket, teleport, voreball |
| 15 vocal male strain/hurt/pain/jump sounds | qubodup | https://opengameart.org/content/15-vocal-male-strainhurtpainjump-sounds | jump, pain |
| grunts of male death and pain | thebardofblasphemy | https://opengameart.org/content/grunts-male-death-and-pain | death |
| Fleshy Bone Break/Snap SFX | Zane Little Music | https://opengameart.org/content/fleshy-bone-breaksnap-sfx | axehit, gib |
| Big scary troll sounds | Darsycho | https://opengameart.org/content/big-scary-troll-sounds | roar |
| CC0 Deep Monster Roar | trazzz123 | https://opengameart.org/content/cc0-deep-monster-roar | roar |
| 16 Monster Growls | StarNinjas | https://opengameart.org/content/16-monster-growls | sight |
| Dog sounds | pauliuw | https://opengameart.org/content/dog-sounds | bark |
| Gunshot Sounds | Tabasco | https://opengameart.org/content/gunshot-sounds | shotgun, sshotgun |
| Gunshots | kurt | https://opengameart.org/content/gunshots | gunshot |
| Shotgun Reload Sound effects | zer0_sol | https://opengameart.org/content/shotgun-reload-sound-effects | weapon |

## Как собраны

Исходники нарезаны (из длинных записей взяты отдельные выстрелы, рыки и крики), часть звуков
сведена из двух-трёх слоёв (например, взрыв — «хруст» плюс низкочастотный удар), громкость
выровнена по среднему уровню, всё переведено в моно MP3 32 кГц, 64 кбит/с.
Файлы называются `<звук>_<вариант>.mp3`; варианты одного звука чередуются, а у голосов монстров
вариант выбирается по «голосу» монстра — от низких к высоким.

После правки файлов здесь пересоберите встроенную копию: `node tools/pack-sounds.js`.

## Какой звук из чего

| Звук | Вариантов | Исходные файлы |
|---|---|---|
| `shotgun` | 2 | shotty.wav |
| `sshotgun` | 1 | cannon_02.ogg, shotty.wav |
| `gunshot` | 2 | Black Powder.wav |
| `nail` | 2 | shot_02.ogg, shot_03.ogg |
| `ric` | 3 | impactMetal_light_000.ogg, impactMetal_light_002.ogg, impactMetal_light_004.ogg |
| `grenade` | 1 | bang_03.ogg, impactMetal_medium_001.ogg |
| `bounce` | 2 | impactPlate_light_000.ogg, impactPlate_light_002.ogg |
| `rocket` | 1 | cannon_04.ogg, rocket_01.ogg |
| `explode` | 3 | bang_09.ogg, explosionCrunch_001.ogg, explosionCrunch_003.ogg, explosionCrunch_004.ogg, lowFrequency_explosion_000.ogg, lowFrequency_explosion_001.ogg |
| `lightning` | 3 | forceField_000.ogg, forceField_001.ogg, forceField_002.ogg |
| `zap` | 1 | explosionCrunch_002.ogg, zap2.ogg |
| `zapsmall` | 1 | zap1.ogg |
| `laser` | 3 | laserLarge_000.ogg, laserLarge_001.ogg, laserLarge_002.ogg |
| `axe` | 2 | knifeSlice.ogg, knifeSlice2.ogg |
| `axehit` | 3 | Wet Break 2.wav, Wet Break 5.wav, Wet Break 8.wav, impactPunch_heavy_000.ogg, impactPunch_heavy_002.ogg, impactPunch_heavy_004.ogg |
| `sword` | 3 | drawKnife1.ogg, drawKnife2.ogg, drawKnife3.ogg |
| `chainsaw` | 1 | machine_02.ogg, spaceEngineSmall_000.ogg |
| `jump` | 2 | slightscream-11.flac, slightscream-12.flac |
| `land` | 3 | footstep_concrete_000.ogg, footstep_concrete_002.ogg, footstep_concrete_004.ogg |
| `pain` | 4 | slightscream-01.flac, slightscream-03.flac, slightscream-08.flac, slightscream-14.flac |
| `death` | 3 | death pain grunts.wav |
| `gasp` | 1 | breath.ogg |
| `gurgle` | 3 | bubble_01.ogg, bubble_02.ogg, bubble_03.ogg |
| `splash` | 3 | splash_01.ogg, splash_03.ogg, splash_05.ogg |
| `burn` | 1 | thrusterFire_001.ogg |
| `gib` | 3 | Wet Break 1.wav, Wet Break 4.wav, Wet Break 7.wav, slime_05.ogg, slime_10.ogg, slime_13.ogg |
| `splat` | 3 | slime_01.ogg, slime_03.ogg, slime_07.ogg |
| `spit` | 3 | spit_01.ogg, spit_02.ogg, spit_03.ogg |
| `pickup` | 2 | beltHandle1.ogg, metalClick.ogg |
| `health` | 1 | bubble_02.ogg, maximize_006.ogg |
| `armor` | 1 | cloth1.ogg, impactPlate_medium_000.ogg |
| `weapon` | 1 | Rack.mp3 |
| `powerup` | 1 | forceField_002.ogg, powerUp1.ogg |
| `powerdown` | 1 | phaserDown1.ogg |
| `key` | 1 | bell_02.ogg, key_open_01.ogg |
| `door` | 1 | door_01.ogg, spaceEngineLow_000.ogg |
| `crush` | 1 | impactMetal_heavy_000.ogg, lowFrequency_explosion_001.ogg, slam_03.ogg |
| `jumppad` | 1 | phaserUp1.ogg, thrusterFire_000.ogg |
| `shield` | 1 | forceField_001.ogg |
| `lift` | 1 | machine_01.ogg, spaceEngineLow_001.ogg |
| `checkpoint` | 1 | gong_01.ogg |
| `button` | 1 | switch_01.ogg |
| `secret` | 1 | bell_01.ogg, bell_03.ogg |
| `teleport` | 2 | phaserUp2.ogg, teleport_01.ogg, teleport_02.ogg |
| `noammo` | 1 | click_002.ogg |
| `menu` | 1 | click_001.ogg |
| `menuok` | 1 | confirmation_002.ogg |
| `tick` | 1 | tick_001.ogg |
| `sight` | 10 | grunt_07.ogg, monster.13.ogg, monster.9.ogg, monster_03.ogg, monster_04.ogg, monster_06.ogg, monster_12.ogg, roar_02.ogg, roar_04.ogg, troll_02.ogg |
| `mpain` | 7 | grunt_06.ogg, hurt_01.ogg, hurt_02.ogg, hurt_03.ogg, hurt_04.ogg, hurt_05.ogg, troll_03.ogg |
| `mdeath` | 6 | die_01.ogg, die_02.ogg, die_03.ogg, die_04.ogg, grunt_08.ogg, roar_06.ogg |
| `roar` | 4 | monster_roar.wav, troll-roars_0.ogg |
| `bark` | 3 | Dog Bark 1.wav, Dog Bark.wav, barking_01.ogg |
| `fireball` | 1 | thrusterFire_002.ogg |
| `charge` | 1 | forceField_000.ogg, phaserUp1.ogg |
| `voreball` | 1 | misc_03.ogg |
