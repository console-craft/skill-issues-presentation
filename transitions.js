import { fragments } from './assets/transition-shaders.js';

export function createTransitions(document) {
  const stage = document.createElement('div');
  stage.id = 'slide-transition';
  stage.hidden = true;
  stage.setAttribute('aria-hidden', 'true');
  stage.style.cssText = 'position:absolute;inset:0;width:1920px;height:1080px;z-index:100;pointer-events:none';
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  const gl = canvas.getContext('webgl', { alpha: false });
  if (!gl) return null;
  const captureCanvas = document.createElement('canvas');
  captureCanvas.width = canvas.width;
  captureCanvas.height = canvas.height;
  const context = captureCanvas.getContext('2d');
  if (!context) return null;

  function compile(source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  const programs = {};
  try {
    const vertex = compile('attribute vec2 a_pos; varying vec2 v_uv; void main(){v_uv=a_pos*.5+.5;v_uv.y=1.-v_uv.y;gl_Position=vec4(a_pos,0.,1.);}', gl.VERTEX_SHADER);
    for (const [name, source] of Object.entries(fragments)) {
      const fragment = compile(source, gl.FRAGMENT_SHADER);
      const program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      programs[name] = {
        program,
        position: gl.getAttribLocation(program, 'a_pos'),
        from: gl.getUniformLocation(program, 'u_from'),
        to: gl.getUniformLocation(program, 'u_to'),
        progress: gl.getUniformLocation(program, 'u_progress'),
        resolution: gl.getUniformLocation(program, 'u_resolution'),
      };
    }
    gl.deleteShader(vertex);
  } catch (error) {
    console.warn('Slide transitions unavailable; using cuts.', error.message);
    for (const { program } of Object.values(programs)) gl.deleteProgram(program);
    return null;
  }
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.viewport(0, 0, canvas.width, canvas.height);
  stage.append(canvas);
  document.body.append(stage);
  let available = true;
  let running = false;
  let animation;
  let resolvePlayback;
  let fromTexture;
  let toTexture;
  let liveSource;

  function finish(completed) {
    cancelAnimationFrame(animation);
    stage.hidden = true;
    liveSource?.remove();
    liveSource = null;
    running = false;
    if (fromTexture) gl.deleteTexture(fromTexture);
    if (toTexture) gl.deleteTexture(toTexture);
    fromTexture = toTexture = null;
    resolvePlayback?.(completed);
    resolvePlayback = null;
  }
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    available = false;
    finish(false);
  });

  function upload(texture, scene) {
    // shortcut: background-only textures; add foreground capture if content should distort with transitions.
    const image = scene.querySelector(':scope > picture img');
    if (!image?.complete || !image.naturalWidth) return false;
    const rect = image.getBoundingClientRect();
    const cover = Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
    const width = image.naturalWidth * cover;
    const height = image.naturalHeight * cover;
    context.setTransform(canvas.width / 1920, 0, 0, canvas.height / 1080, 0, 0);
    context.fillStyle = '#080b19';
    context.fillRect(0, 0, 1920, 1080);
    context.drawImage(image, rect.left + (rect.width - width) / 2, rect.top + (rect.height - height) / 2, width, height);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, captureCanvas);
    return true;
  }

  function capture(scene) {
    if (!available) return null;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (upload(texture, scene)) {
      const image = scene.querySelector(':scope > picture img');
      const live = image.cloneNode();
      live.removeAttribute('id');
      live.src = image.currentSrc;
      const style = document.defaultView.getComputedStyle(image);
      live.style.cssText = `position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:${style.transform};transform-origin:${style.transformOrigin}`;
      return { texture, live };
    }
    gl.deleteTexture(texture);
    return null;
  }

  function play(source, destination, effect, duration) {
    finish(false);
    fromTexture = source?.texture;
    toTexture = capture(destination)?.texture;
    if (!fromTexture || !toTexture) { finish(false); return Promise.resolve(false); }
    const state = programs[effect];
    stage.dataset.effect = effect;
    liveSource = source.live;
    stage.prepend(liveSource);
    running = true;
    stage.hidden = false;
    const playback = new Promise(resolve => { resolvePlayback = resolve; });
    const start = performance.now();
    function frame(now) {
      if (!running) return;
      try {
        gl.useProgram(state.program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, fromTexture);
        gl.uniform1i(state.from, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, toTexture);
        gl.uniform1i(state.to, 1);
        const progress = Math.min((now - start) / duration, 1);
        // Canvas holds GIF keyframes; live DOM images handle entry and the final landing.
        canvas.style.opacity = String(Math.min(progress / .2, (1 - progress) / .2, 1));
        liveSource.style.opacity = progress < .25 ? '1' : '0';
        gl.uniform1f(state.progress, progress);
        gl.uniform2f(state.resolution, canvas.width, canvas.height);
        gl.bindBuffer(gl.ARRAY_BUFFER, quad);
        gl.enableVertexAttribArray(state.position);
        gl.vertexAttribPointer(state.position, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        if (progress === 1) finish(true);
        else animation = requestAnimationFrame(frame);
      } catch (error) {
        console.warn('Transition interrupted; using a cut.', error.message);
        finish(false);
      }
    }
    frame(start);
    return playback;
  }
  return { capture, play, cancel: () => finish(false), get running() { return running; } };
}
