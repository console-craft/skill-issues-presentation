import assert from 'node:assert/strict';

export async function checkTransitionShaders(frame) {
  const samples = await frame.evaluate(async () => {
    const { fragments } = await import('../assets/transition-shaders.js');
    const canvas = document.createElement('canvas');
    const width = 160, height = 90;
    canvas.width = 160;
    canvas.height = 90;
    const gl = canvas.getContext('webgl');
    const compile = (source, type) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    const vertex = compile('attribute vec2 a_pos; varying vec2 v_uv; void main(){v_uv=a_pos*.5+.5;v_uv.y=1.-v_uv.y;gl_Position=vec4(a_pos,0.,1.);}', gl.VERTEX_SHADER);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    function texture(unit, gradient) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const pixels = new Uint8Array(width * height * 4);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const stripe = Math.floor(x / 8) % 2 * 255;
        pixels.set(gradient === 'stripes' ? [stripe, stripe, stripe, 255] : unit ? [0, 0, 255, 255] : [255, 0, 0, 255], (y * width + x) * 4);
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    }
    const result = {};
    for (const name of ['whip', 'crt']) {
      if (!fragments[name]) { result[name] = null; continue; }
      gl.viewport(0, 0, width, height);
      const program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, compile(fragments[name], gl.FRAGMENT_SHADER));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      const position = gl.getAttribLocation(program, 'a_pos');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1i(gl.getUniformLocation(program, 'u_from'), 0);
      gl.uniform1i(gl.getUniformLocation(program, 'u_to'), 1);
      gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), width, height);
      texture(0, false);
      texture(1, false);
      function draw(progress) {
        gl.uniform1f(gl.getUniformLocation(program, 'u_progress'), progress);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        const pixels = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        return pixels;
      }
      const pixel = (pixels, x, y) => [...pixels.slice((y * width + x) * 4, (y * width + x) * 4 + 3)];
      const start = draw(0), end = draw(1), middle = draw(.5);
      result[name] = {
        start: pixel(start, 80, 45), end: pixel(end, 80, 45),
        cleanStart: start.every((value, i) => value === [255, 0, 0, 255][i % 4]),
        cleanEnd: end.every((value, i) => value === [0, 0, 255, 255][i % 4]),
        middleMax: middle.reduce((maximum, value, i) => i % 4 === 3 ? maximum : Math.max(maximum, value), 0),
      };
      if (name === 'whip') {
        result[name].left = pixel(middle, 8, 45);
        result[name].right = pixel(middle, 152, 45);
        texture(0, 'stripes');
        texture(1, 'stripes');
        const blurred = draw(.3);
        result[name].blurredPixels = blurred.filter((value, i) => i % 4 === 1 && value > 20 && value < 235).length;
      }
      if (name === 'crt') {
        const collapsed = draw(.4);
        result[name].line = pixel(collapsed, 80, 45);
        result[name].offLine = pixel(collapsed, 80, 8);
      }
      gl.deleteProgram(program);
    }
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return result;
  });
  for (const [name, sample] of Object.entries(samples)) {
    assert.ok(sample, `${name} must provide a working transition shader`);
    assert.deepEqual(sample.start, [255, 0, 0], `${name} must start on the outgoing scene`);
    assert.deepEqual(sample.end, [0, 0, 255], `${name} must end on the incoming scene`);
    assert.equal(sample.cleanStart, true, `${name} must cover the entire outgoing frame without seams`);
    assert.equal(sample.cleanEnd, true, `${name} must cover the entire incoming frame without leftovers`);
  }
  assert.deepEqual(samples.whip.left, [255, 0, 0], 'The whip must carry the outgoing scene to the left');
  assert.deepEqual(samples.whip.right, [0, 0, 255], 'The whip must bring the incoming scene from the right');
  assert.ok(samples.whip.blurredPixels > 160 * 90 * .4, 'The whip must smear fine details into horizontal motion blur');
  assert.equal(samples.crt.middleMax, 0, 'CRT must include a full blackout between scenes');
  assert.ok(samples.crt.line[1] > 40 && samples.crt.line[2] > 40, 'CRT must collapse into a cyan line');
  assert.deepEqual(samples.crt.offLine, [0, 0, 0], 'The collapsed CRT must be dark away from its line');
}
