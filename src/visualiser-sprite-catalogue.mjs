// Pinned FrameRudiments sprite metadata; image bytes stay in separate lazy assets.
export const SPRITE_ATLASES = Object.freeze({
  "lcd": Object.freeze({"file":"lcd.png","sha256":"0b899ad24ea639ec86a7731118720cec68a64f288c50b39ae3a596ae876a2b2d","width":768,"height":768,"columns":8,"rows":8}),
  "lcd-green": Object.freeze({"file":"lcd-green.png","sha256":"2d9b9491e08d0e8cc35f3d891251742860473b9867ca1011f123b88dead73243","width":768,"height":768,"columns":8,"rows":8}),
  "lcd-amber": Object.freeze({"file":"lcd-amber.png","sha256":"dfaf23a923ab05891453f03da87244be1cc3bd0c617ef1a8b2cb1f4d570436ed","width":768,"height":768,"columns":8,"rows":8}),
  "led": Object.freeze({"file":"led.png","sha256":"ae40562cb9d8c800404fc41b72ae8e4554df80c686d6f66e32ad4810fa2d03bb","width":768,"height":768,"columns":8,"rows":8}),
  "vfd": Object.freeze({"file":"vfd.png","sha256":"ae40562cb9d8c800404fc41b72ae8e4554df80c686d6f66e32ad4810fa2d03bb","width":768,"height":768,"columns":8,"rows":8}),
  "arcade": Object.freeze({"file":"arcade.png","sha256":"c44328561110a9c98d248259cec54f42b544f9773aa210ad06e7aa49fde15b27","width":768,"height":768,"columns":8,"rows":8}),
  "neon": Object.freeze({"file":"neon.png","sha256":"ae40562cb9d8c800404fc41b72ae8e4554df80c686d6f66e32ad4810fa2d03bb","width":768,"height":768,"columns":8,"rows":8}),
  "glass": Object.freeze({"file":"glass.png","sha256":"d362762c552d27ad65487b25821b8185511158fd31a76a3997aeb6bb5ea356c7","width":768,"height":768,"columns":8,"rows":8}),
  "metal": Object.freeze({"file":"metal.png","sha256":"61b2593b70b5904c481947dad427b68347b47f661c9a9cc38cde865c96875021","width":768,"height":768,"columns":8,"rows":8}),
  "crystal": Object.freeze({"file":"crystal.png","sha256":"a94bb82e1bec5b33fa23136f6ff22e0a107886d22375da830c720582402955ff","width":768,"height":768,"columns":8,"rows":8}),
  "pixel": Object.freeze({"file":"pixel.png","sha256":"8d659e7c556bfd8da2935aee82b560c29b0cae6f0579b91a130d3e6689c9d9db","width":768,"height":768,"columns":8,"rows":8}),
  "hud": Object.freeze({"file":"hud.png","sha256":"2c2368594ee681869cc1955998e38d5982154209860943132f6463264b48c528","width":768,"height":768,"columns":8,"rows":8}),
  "plasma": Object.freeze({"file":"plasma.png","sha256":"ae40562cb9d8c800404fc41b72ae8e4554df80c686d6f66e32ad4810fa2d03bb","width":768,"height":768,"columns":8,"rows":8}),
  "fire": Object.freeze({"file":"fire.png","sha256":"cb0940dc22dda4b0b0ed8936b9820196a2ab9f33456629760c207839309d01af","width":768,"height":768,"columns":8,"rows":8}),
  "ice": Object.freeze({"file":"ice.png","sha256":"31e93bd6ba878f7bafb67e6f62c347c7f76d2bf39ec3a10dcc9303e3e1d208b8","width":768,"height":768,"columns":8,"rows":8}),
  "mono": Object.freeze({"file":"mono.png","sha256":"0f91781c14da45261c7dc02d269493179721bf81f4276b646975b0df0b6b6a84","width":768,"height":768,"columns":8,"rows":8}),
  "generated-neon": Object.freeze({"file":"generated-neon.png","sha256":"3e077af675e6724e850f85d70087f0c80593b5572de2fe48166fe976d818ed07","width":768,"height":768,"columns":8,"rows":8})
});
export const SPRITE_THEMES = Object.freeze(Object.keys(SPRITE_ATLASES));

/** A browser URL replaces an offline project path; the source digest stays mandatory. */
export function validateSpriteAsset(input) {
  if (input === undefined || input === null) return null;
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input)))
    throw new TypeError('sprite_asset must be a pinned {url, sha256} reference');
  const keys = Object.keys(input);
  if (keys.some(key => !['url', 'path', 'sha256'].includes(key)) || keys.length !== 2 ||
      Number(Object.hasOwn(input, 'url')) + Number(Object.hasOwn(input, 'path')) !== 1)
    throw new TypeError('sprite_asset requires exactly one url/path and a sha256');
  const url = input.url ?? input.path;
  if (typeof url !== 'string' || !url.trim() || url.length > 4096 || /[\u0000-\u001f\u007f]/.test(url))
    throw new TypeError('Sprite atlas URL must be a bounded HTTP(S) or relative URL');
  const parsed = new URL(url, 'https://dancemoves.invalid/');
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password)
    throw new TypeError('Sprite atlas URL must be HTTP(S) without credentials');
  if (typeof input.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(input.sha256))
    throw new TypeError('Sprite atlas sha256 must contain 64 hexadecimal characters');
  return Object.freeze({url: url.trim(), sha256: input.sha256.toLowerCase()});
}
