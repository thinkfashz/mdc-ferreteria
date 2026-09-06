// Descarga imágenes de productos de ferretería desde Pexels (API libre)
const KEY = "yELz1GtdgjP9X5ByYSWkjO7j8vzjaXYcTGOXTUQfUI1IDnEqH917a2o3";
const QUERIES = [
  ["taladro", "power drill tool"],
  ["martillo", "claw hammer"],
  ["amoladora", "angle grinder"],
  ["sierra-circular", "circular saw"],
  ["destornilladores", "screwdriver set"],
  ["llaves", "wrench set tools"],
  ["casco", "construction safety helmet"],
  ["guantes", "work gloves safety"],
  ["pintura", "paint buckets roller"],
  ["tuberias", "pvc pipes fittings"],
  ["cemento", "cement bag construction"],
  ["focos", "led light bulbs"],
  ["extension", "extension cord power"],
  ["alicates", "pliers tool"],
  ["huincha", "tape measure"],
  ["escalera", "aluminum ladder"],
  ["sierra-manual", "hand saw wood"],
  ["nivel", "spirit level tool"],
  ["clavos", "nails screws hardware"],
  ["madera", "lumber wood planks"],
  ["llave-inglesa", "adjustable wrench"],
  ["pinza", "locking pliers"],
  ["soldadora", "welding machine worker"],
  ["espatula", "putty knife plaster"],
];

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let ok = 0, fail = [];
  for (const [file, query] of QUERIES) {
    try {
      const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
      const res = await fetch(url, { headers: { Authorization: KEY } });
      const data = await res.json();
      const photo = data.photos && data.photos[0];
      if (!photo) { fail.push(file + ":no-results"); continue; }
      const imgRes = await fetch(photo.src.large);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      await import("fs").then((fs) => fs.promises.writeFile(`C:/mdc-app/public/productos/${file}.jpg`, buf));
      ok++;
      console.log(`ok: ${file}`);
    } catch (e) {
      fail.push(file + ":" + e.message.slice(0, 50));
    }
    await delay(400);
  }
  console.log(`\nDONE ok=${ok} fail=${fail.length}`);
  if (fail.length) console.log("fails:", fail.join(", "));
})();