/**
 * Turboşaft (M5a P7): halka giriş + parçacık ayırıcı, önden çıkışlı mil ve
 * flanş, isteğe bağlı redüktör, ortak gaz jeneratörü (gasgen.js). Pervane,
 * çene S-kanalı ve pal açısı (`setPitch`) yok; önden görünen kademe HPC
 * (`bladeCount = hpc.blades[0]`). PartId: `outputShaft`, `engineCase`.
 *
 * P0: taslak. Yerleşim (design/layouts/turboshaft.ts) READY olana dek
 * tipli hata atar; model kayıt defterinde (models.ts) yer tutar.
 */

/**
 * @param {import('./models').Materials} _materials
 * @param {import('./models').VisualSource} src
 * @returns {import('./models').EngineModel}
 */
export function buildTurboshaft(_materials, src) {
  throw new Error(`Turboşaft modeli henüz yok (P7): ${src.built.graph.name}`);
}
