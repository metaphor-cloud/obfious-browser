import type { Collector } from '../types.js';

/**
 * WebRTC capabilities: media device counts (not labels) and supported codecs.
 */
export const collectWebrtc: Collector = async () => {
  try {
    const parts: string[] = [];

    // Media device counts (not labels — privacy-safe)
    if (navigator.mediaDevices?.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioin = devices.filter((d) => d.kind === 'audioinput').length;
      const videoin = devices.filter((d) => d.kind === 'videoinput').length;
      const audioout = devices.filter((d) => d.kind === 'audiooutput').length;
      parts.push(`devices:${audioin},${videoin},${audioout}`);
    }

    // RTCPeerConnection existence and supported codecs
    if (typeof RTCPeerConnection !== 'undefined') {
      parts.push('rtc:1');

      if (typeof RTCRtpSender !== 'undefined' && RTCRtpSender.getCapabilities) {
        const audioCodecs = RTCRtpSender.getCapabilities('audio')?.codecs
          ?.map((c) => c.mimeType)
          .sort()
          .join(',');
        const videoCodecs = RTCRtpSender.getCapabilities('video')?.codecs
          ?.map((c) => c.mimeType)
          .sort()
          .join(',');
        if (audioCodecs) parts.push('acodecs:' + audioCodecs);
        if (videoCodecs) parts.push('vcodecs:' + videoCodecs);
      }
    } else {
      parts.push('rtc:0');
    }

    return parts.join('|');
  } catch {
    return null;
  }
};
