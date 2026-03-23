import type { Collector } from '../types.js';

/**
 * WebGL renderer, vendor, extensions, and parameter fingerprint.
 * Different GPUs expose different capabilities and driver strings.
 */
export const collectWebgl: Collector = async () => {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl || !(gl instanceof WebGLRenderingContext)) return null;

    const parts: string[] = [];

    // Unmasked renderer/vendor via debug extension
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      parts.push('renderer:' + (gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) ?? ''));
      parts.push('vendor:' + (gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) ?? ''));
    }

    // Key parameters
    parts.push('version:' + (gl.getParameter(gl.VERSION) ?? ''));
    parts.push('shadingLanguage:' + (gl.getParameter(gl.SHADING_LANGUAGE_VERSION) ?? ''));
    parts.push('maxTextureSize:' + gl.getParameter(gl.MAX_TEXTURE_SIZE));
    parts.push('maxRenderbufferSize:' + gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
    parts.push('maxViewportDims:' + gl.getParameter(gl.MAX_VIEWPORT_DIMS));
    parts.push('maxVertexAttribs:' + gl.getParameter(gl.MAX_VERTEX_ATTRIBS));
    parts.push('maxVertexUniformVectors:' + gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS));
    parts.push('maxFragmentUniformVectors:' + gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS));
    parts.push('maxVaryingVectors:' + gl.getParameter(gl.MAX_VARYING_VECTORS));
    parts.push('aliasedLineWidthRange:' + gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE));
    parts.push('aliasedPointSizeRange:' + gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE));

    // Supported extensions (sorted for determinism)
    const extensions = gl.getSupportedExtensions();
    if (extensions) {
      parts.push('extensions:' + [...extensions].sort().join(','));
    }

    return parts.join('|');
  } catch {
    return null;
  }
};
