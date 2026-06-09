# Data Sources & Methodology

`golf_balls.csv` aggregates the publicly stated performance characteristics of current
(2023–2025) golf balls from the major manufacturers into one common tabular format. The
goal is to capture **what the manufacturers themselves say** a ball is for, so the quiz
can match a player to a ball the way a manufacturer's own fitting flow would.

## Columns

| Column | Meaning |
| --- | --- |
| `brand` / `model` / `year` | Ball identity and lineup year used. |
| `pieces` | Number of construction layers the manufacturer advertises. |
| `cover` | Cover material (Urethane = tour/greenside-spin cover; Ionomer/Surlyn = durable distance cover). |
| `compression` | Compression rating. See note below. |
| `driver_spin` | Full-swing / long-game spin the manufacturer markets: `low`, `mid`, `high`. Low = straighter, less hook/slice, more roll. |
| `greenside_spin` | Short-game / wedge spin & stopping power: `low`, `mid`, `high`. |
| `launch` | Marketed ball flight / trajectory: `low`, `mid`, `high`. |
| `feel` | Marketed feel at impact: `soft`, `mid`, `firm`. |
| `swing_speed_min_mph` / `swing_speed_max_mph` | Driver swing-speed window the ball is fit for, per the manufacturer's fitting guidance and general industry guidance. |
| `price_usd` | Approximate street price per dozen (USD), used only for budget filtering. |
| `price_tier` | `premium` / `mid` / `value`. |
| `category` | `tour` (urethane, all-around performance), `distance` (low-spin, max carry/roll), `soft-distance` (low-compression soft feel). |
| `url` | Manufacturer product page. |

## A note on compression

Most manufacturers do **not** officially publish a compression number. Titleist in
particular argues compression is not a useful fitting input and instead fits by feel,
trajectory, and greenside spin. The compression values here are the widely cited
third-party measured figures (e.g. MyGolfSpy Ball Lab, Golf Sidekick, Plugged In Golf
charts) and are used as one input among several, not the sole determinant.

## Manufacturer fitting logic encoded in the quiz

- **Bridgestone** fits explicitly by driver swing speed: the **Tour B X / XS** are built
  for swings **over ~105 mph**, while the **Tour B RX / RXS** are built for swings
  **under ~105 mph**. Within each pair, the **X / RX** prioritize distance and a stable,
  lower-spinning flight, while the **XS / RXS** prioritize soft feel and added greenside
  spin ("feel junkies"). This maps directly onto our `swing_speed_*`, `driver_spin`,
  `greenside_spin`, and `feel` columns.
- **Titleist** distinguishes its tour balls by feel / flight / greenside spin rather than
  compression: **Pro V1** is softer with a slightly higher flight; **Pro V1x** is firmer,
  flies higher and spins a touch more around the green; **AVX** is the soft, low-spin,
  low-flight option for players chasing distance and wind-cutting trajectory.
- **General industry guidance** ties compression to swing speed: under ~85 mph favors
  lower compression, ~85–100 mph mid compression, and over ~100 mph higher compression.

## Reference sources

- Bridgestone Golf — Tour B series product pages and fitting program
  (https://www.bridgestonegolf.com/en-us/balls/tour-series)
- Titleist — Pro V1, Pro V1x, AVX, Tour Speed, Tour Soft, Velocity, TruFeel product pages
  (https://www.titleist.com)
- TaylorMade — TP5 / TP5x / Tour Response product pages (https://www.taylormadegolf.com)
- Callaway — Chrome Tour / Chrome Soft / Supersoft product pages (https://www.callawaygolf.com)
- Srixon — Z-Star / Q-Star Tour product pages (https://www.srixon.com)
- MyGolfSpy Ball Lab & Golf Ball Test (compression / spin measurements) (https://mygolfspy.com)
- Plugged In Golf, Golf Sidekick, Golferspeak — published compression charts

Values are approximate and intended for an educational/recommendation quiz, not for
official club-fitting. Always confirm with a manufacturer fitting tool or in-person fitting.
