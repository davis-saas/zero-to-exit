# Zero to Exit

A cartoony, phone-friendly idle game about growing a business from a broke idea to selling the company.

You start with $3,000 and a phone full of contacts. Tap to reach out, tune your offer, set your price, get leads, close sales, hire a team, niche down, launch a premium product, fight fires, build specialist teams, place one big bet, and finally sell at **The Summit**. Every choice card shows a **ghost timeline** of how the road not taken would have played out, and the **Founder's Notebook** collects 53 short lessons with quizzes.

**Play it:** https://davis-saas.github.io/zero-to-exit/

## Levels

| # | Level | Your job | The boss |
|---|-------|----------|----------|
| 1 | Garage | Researcher | Nobody knows you |
| 2 | Hustle | Starter | You make no money |
| 3 | Megaphone | Doer | Customers come in unevenly |
| 4 | Crew | Trainer | Too much for one person |
| 5 | Focus | Manager | Trying to serve everyone |
| 6 | Product Line | Director | Too little money per customer |
| 7 | Tune-Up | Leader | Everything is inefficient |
| 8 | Org Chart | Executive | Every system is overwhelmed |
| 9 | Specialists | President | Nobody can know everything |
| 10 | Empire | Chairman | Growth stalls: one big bet, then sell |

## Run it locally

No build step and no dependencies. Open `index.html` in a browser, or serve the folder:

```bash
node tools/serve.js 8765
```

then visit http://localhost:8765.

## Project layout

- `index.html`, `css/styles.css`: the page and its styles
- `js/engine.js`, `js/engine-late.js`: the simulation (pure JavaScript, also runs in Node)
- `js/content/*.js`: levels, cards, upgrades, lessons and late-game systems
- `js/ui.js`, `js/fx.js`: rendering, input, sound and confetti
- `tools/`: content validator, balance simulator, card checker, local server
- `docs/`: design specs

## Checks

```bash
node tools/validate-content.js
```

```bash
node tools/balance-sim.js
```

```bash
node tools/card-check.js
```

## Note

An independent learning project inspired by popular business-growth books. Not affiliated with or endorsed by any author or company. All game text is original.
