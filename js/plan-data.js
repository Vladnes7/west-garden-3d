// West Garden, кв. 103 (пр-т Генерала Дорохова 39 к2). Units: mm. x → east, y → south. Origin: inner NW corner (living).
// Walls measured from the montage plan (sheet 7) raster, calibrated against dimensions: 5.702 mm/px x, 5.666 mm/px y
// (interior area check 43.24 m² vs 43.33 m² in the explication). Rectangles only: the plan is orthogonal.
const R = (x0, x1, y0, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

export const WALLS = [
  R(-445, 0, -435, 8045),        // west facade
  R(-445, 80, -435, 0),          // north facade piers / window openings 80..2350, 3445..5725
  R(2350, 3445, -435, 0),
  R(5725, 6610, -435, 0),
  R(6165, 6610, 0, 4885),        // east facade (bedroom)
  R(6125, 6610, 4885, 8045),     // east facade + bathroom lining
  R(3045, 3200, 0, 4295),        // living | bedroom partition (TV wall)
  R(3045, 3155, 4295, 4420),     // partition end stub
  R(4020, 4410, 4285, 4420),     // bedroom door pier
  R(4255, 4410, 4420, 4885),     // corridor | bedroom wardrobe bay
  R(4255, 6165, 4885, 5010),     // bedroom | bathroom
  R(4255, 4395, 5010, 5745),     // hall | bathroom (door 5745..6440)
  R(4255, 4395, 6440, 7640),
  R(0, 582, 5290, 5361),         // kitchen niche wing walls (ВГКЛ2 71 mm)
  R(1778, 2350, 5290, 5361),
  R(2350, 3130, 5280, 5400),     // wall above the hall wardrobe niche
  R(2350, 2510, 5400, 6735),     // kitchen | hall wardrobe niche
  R(2350, 3090, 6735, 7370),     // electrical panels block
  R(-445, 3090, 7370, 8045),     // south facade (kitchen)
  R(3090, 3140, 7640, 8045),     // entry jamb (entry opening 3140..4220)
  R(4220, 6610, 7640, 8045),
  R(4395, 5216, 7608, 7640),     // shower back wall
  R(5216, 6125, 7065, 7640),     // service shafts (bathroom SE)
  R(5216, 5430, 6565, 7065),     // shower side wall runs to the glass line (the screen needs a wall to fix to)
];

// Windows on the north facade: opening a..b (mm along x), sill height, frame members (mm along x).
export const WINDOWS = [
  { side: 'N', a: 80, b: 2350, sill: 490, room: 'living' },
  { side: 'N', a: 3445, b: 5725, sill: 510, room: 'bed' },
];
